use std::collections::HashMap;
use std::sync::atomic::{AtomicU32, AtomicU64, Ordering};
use std::sync::Arc;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, State};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;
use tokio::sync::{broadcast, Mutex, RwLock};

use crate::ssh;
use crate::vault::{self, VaultState};

#[derive(Clone, Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct TunnelSummary {
    pub id: String,
    pub profile_id: i64,
    pub profile_name: String,
    pub local_port: u16,
    pub remote_host: String,
    pub remote_port: u16,
    pub status: String, // "active", "error", "stopped"
    pub error_message: Option<String>,
    pub bytes_tx: u64,
    pub bytes_rx: u64,
    pub connected_clients: u32,
    pub created_at: String,
}

#[derive(Clone, Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct StartTunnelParams {
    pub profile_id: i64,
    pub local_port: u16,
    pub remote_host: String,
    pub remote_port: u16,
    pub profile_name: Option<String>,
}

struct ActiveTunnel {
    pub summary: Arc<RwLock<TunnelSummary>>,
    pub stop_tx: broadcast::Sender<()>,
    pub bytes_tx: Arc<AtomicU64>,
    pub bytes_rx: Arc<AtomicU64>,
    pub active_clients: Arc<AtomicU32>,
}

#[derive(Default)]
pub struct TunnelState {
    tunnels: Mutex<HashMap<String, ActiveTunnel>>,
}

#[tauri::command]
pub async fn tunnel_start(
    app: AppHandle,
    vault: State<'_, VaultState>,
    state: State<'_, TunnelState>,
    params: StartTunnelParams,
) -> Result<TunnelSummary, String> {
    let tunnel_id = format!(
        "tun_{}_{}_{}",
        params.profile_id,
        params.local_port,
        params.remote_port
    );

    // Stop existing if running with same ID
    {
        let mut map = state.tunnels.lock().await;
        if let Some(existing) = map.remove(&tunnel_id) {
            let _ = existing.stop_tx.send(());
        }
    }

    // Load credentials from vault
    let creds = vault::load_ssh_credentials(&vault, params.profile_id)?;
    let profile_name = params.profile_name.unwrap_or_else(|| {
        vault::get_profile_name(&vault, params.profile_id)
            .unwrap_or_else(|_| format!("{}:{}", creds.username, creds.host))
    });

    // Test TCP binding on localhost first
    let listener = TcpListener::bind(("127.0.0.1", params.local_port))
        .await
        .map_err(|e| format!("Failed to bind local port {}: {}", params.local_port, e))?;

    let actual_local_port = listener
        .local_addr()
        .map(|a| a.port())
        .unwrap_or(params.local_port);

    // Authenticate SSH connection
    let ssh_handle = ssh::authenticate(
        &creds.host,
        creds.port,
        creds.username.clone(),
        &creds.auth_method,
        creds.password.clone(),
        creds.key_path.clone(),
        creds.key_data.clone(),
        creds.passphrase.clone(),
    )
    .await
    .map_err(|e| format!("SSH authentication to {} failed: {}", creds.host, e))?;

    let (stop_tx, mut stop_rx) = broadcast::channel::<()>(2);
    let bytes_tx = Arc::new(AtomicU64::new(0));
    let bytes_rx = Arc::new(AtomicU64::new(0));
    let active_clients = Arc::new(AtomicU32::new(0));

    let summary = TunnelSummary {
        id: tunnel_id.clone(),
        profile_id: params.profile_id,
        profile_name,
        local_port: actual_local_port,
        remote_host: params.remote_host.clone(),
        remote_port: params.remote_port,
        status: "active".to_string(),
        error_message: None,
        bytes_tx: 0,
        bytes_rx: 0,
        connected_clients: 0,
        created_at: chrono_now_iso(),
    };
    let summary_arc = Arc::new(RwLock::new(summary.clone()));

    let active_entry = ActiveTunnel {
        summary: summary_arc.clone(),
        stop_tx: stop_tx.clone(),
        bytes_tx: bytes_tx.clone(),
        bytes_rx: bytes_rx.clone(),
        active_clients: active_clients.clone(),
    };

    {
        let mut map = state.tunnels.lock().await;
        map.insert(tunnel_id.clone(), active_entry);
    }

    let b_tx = bytes_tx.clone();
    let b_rx = bytes_rx.clone();
    let act_clients = active_clients.clone();
    let r_host = params.remote_host.clone();
    let r_port = params.remote_port;
    let t_id = tunnel_id.clone();
    let sum_update = summary_arc.clone();
    let app_handle = app.clone();

    // Background tunnel daemon loop
    tokio::spawn(async move {
        let ssh_client = Arc::new(Mutex::new(ssh_handle));

        loop {
            tokio::select! {
                _ = stop_rx.recv() => {
                    break;
                }
                accept_res = listener.accept() => {
                    match accept_res {
                        Ok((mut local_stream, client_addr)) => {
                            act_clients.fetch_add(1, Ordering::SeqCst);
                            let client_port = client_addr.port() as u32;
                            let ssh_client_clone = ssh_client.clone();
                            let remote_h = r_host.clone();
                            let b_tx_c = b_tx.clone();
                            let b_rx_c = b_rx.clone();
                            let act_c = act_clients.clone();

                            tokio::spawn(async move {
                                let channel_res = {
                                    let client_guard = ssh_client_clone.lock().await;
                                    client_guard.channel_open_direct_tcpip(
                                        remote_h,
                                        r_port as u32,
                                        "127.0.0.1",
                                        client_port,
                                    ).await
                                };

                                match channel_res {
                                    Ok(channel) => {
                                        let mut channel_stream = channel.into_stream();
                                        let (mut l_read, mut l_write) = local_stream.split();
                                        let (mut c_read, mut c_write) = tokio::io::split(&mut channel_stream);

                                        let tx_counter = b_tx_c.clone();
                                        let rx_counter = b_rx_c.clone();

                                        let client_to_server = async {
                                            let mut buf = [0u8; 8192];
                                            loop {
                                                match l_read.read(&mut buf).await {
                                                    Ok(0) => break,
                                                    Ok(n) => {
                                                        if c_write.write_all(&buf[..n]).await.is_err() {
                                                            break;
                                                        }
                                                        tx_counter.fetch_add(n as u64, Ordering::Relaxed);
                                                    }
                                                    Err(_) => break,
                                                }
                                            }
                                        };

                                        let server_to_client = async {
                                            let mut buf = [0u8; 8192];
                                            loop {
                                                match c_read.read(&mut buf).await {
                                                    Ok(0) => break,
                                                    Ok(n) => {
                                                        if l_write.write_all(&buf[..n]).await.is_err() {
                                                            break;
                                                        }
                                                        rx_counter.fetch_add(n as u64, Ordering::Relaxed);
                                                    }
                                                    Err(_) => break,
                                                }
                                            }
                                        };

                                        tokio::select! {
                                            _ = client_to_server => {}
                                            _ = server_to_client => {}
                                        }
                                    }
                                    Err(e) => {
                                        eprintln!("[Termizen Tunnel] Failed opening direct-tcpip channel: {}", e);
                                    }
                                }
                                act_c.fetch_sub(1, Ordering::SeqCst);
                            });
                        }
                        Err(e) => {
                            eprintln!("[Termizen Tunnel] Listener accept error: {}", e);
                            break;
                        }
                    }
                }
            }
        }

        // Marked as stopped
        {
            let mut s = sum_update.write().await;
            s.status = "stopped".to_string();
            s.connected_clients = 0;
        }
        let _ = app_handle.emit("tunnel-status-changed", t_id);
    });

    Ok(summary)
}

#[tauri::command]
pub async fn tunnel_stop(
    state: State<'_, TunnelState>,
    id: String,
) -> Result<bool, String> {
    let mut map = state.tunnels.lock().await;
    if let Some(entry) = map.remove(&id) {
        let _ = entry.stop_tx.send(());
        let mut s = entry.summary.write().await;
        s.status = "stopped".to_string();
        Ok(true)
    } else {
        Ok(false)
    }
}

#[tauri::command]
pub async fn tunnel_list(
    state: State<'_, TunnelState>,
) -> Result<Vec<TunnelSummary>, String> {
    let map = state.tunnels.lock().await;
    let mut list = Vec::new();
    for entry in map.values() {
        let mut s = entry.summary.read().await.clone();
        s.bytes_tx = entry.bytes_tx.load(Ordering::Relaxed);
        s.bytes_rx = entry.bytes_rx.load(Ordering::Relaxed);
        s.connected_clients = entry.active_clients.load(Ordering::Relaxed);
        list.push(s);
    }
    list.sort_by(|a, b| a.local_port.cmp(&b.local_port));
    Ok(list)
}

fn chrono_now_iso() -> String {
    let now = std::time::SystemTime::now();
    let duration = now.duration_since(std::time::UNIX_EPOCH).unwrap_or_default();
    format!("{}", duration.as_secs())
}
