use std::collections::HashMap;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Arc;

use russh::client::{self, Handle};
use russh::keys::*;
use russh::{ChannelMsg, ChannelWriteHalf, Disconnect};
use serde::Serialize;
use tauri::{AppHandle, Emitter, State};
use tokio::sync::Mutex;

pub struct SshClientHandler;

impl client::Handler for SshClientHandler {
    type Error = russh::Error;

    // ponytail: accept any host key for this slice. Real fingerprint
    // verification / known_hosts (russh::keys::check_known_hosts) needed
    // before this leaves prototype — right now it's MITM-able.
    async fn check_server_key(&mut self, _server_public_key: &PublicKey) -> Result<bool, Self::Error> {
        Ok(true)
    }
}

struct SshSession {
    write_half: ChannelWriteHalf<client::Msg>,
    handle: Handle<SshClientHandler>,
}

#[derive(Default)]
pub struct SshState {
    sessions: Mutex<HashMap<u32, SshSession>>,
    next_id: AtomicU32,
}

#[derive(Clone, Serialize)]
struct SshOutputPayload {
    id: u32,
    data: String,
}

#[derive(Clone, Serialize)]
struct SshExitPayload {
    id: u32,
}

#[tauri::command]
pub async fn ssh_connect(
    app: AppHandle,
    state: State<'_, SshState>,
    host: String,
    port: u16,
    username: String,
    auth_method: String,
    password: Option<String>,
    key_path: Option<String>,
    key_data: Option<String>,
    passphrase: Option<String>,
    cols: u16,
    rows: u16,
) -> Result<u32, String> {
    connect_ssh(app, state, host, port, username, auth_method, password, key_path, key_data, passphrase, cols, rows).await
}

// Shared by connect_ssh (interactive tab) and macro_exec::run (exec-mode
// macros) -- both need a fresh, authenticated SSH connection before doing
// anything channel-specific.
pub async fn authenticate(
    host: &str,
    port: u16,
    username: String,
    auth_method: &str,
    password: Option<String>,
    key_path: Option<String>,
    key_data: Option<String>,
    passphrase: Option<String>,
) -> Result<Handle<SshClientHandler>, String> {
    let config = Arc::new(client::Config::default());
    let mut handle = tokio::time::timeout(
        std::time::Duration::from_secs(20),
        client::connect(config, (host, port), SshClientHandler),
    )
    .await
    .map_err(|_| "Connection timed out after 20 seconds".to_string())?
    .map_err(|e| e.to_string())?;

    let authenticated = match auth_method {
        "password" => {
            let password = password.ok_or("password required for password auth")?;
            tokio::time::timeout(
                std::time::Duration::from_secs(20),
                handle.authenticate_password(username, password)
            )
            .await
            .map_err(|_| "Password authentication timed out after 20 seconds".to_string())?
            .map_err(|e| e.to_string())?
            .success()
        }
        "key" => {
            let key_pair = if let Some(ref data) = key_data {
                decode_secret_key(data, passphrase.as_deref()).map_err(|e| e.to_string())?
            } else if let Some(ref path) = key_path {
                load_secret_key(path, passphrase.as_deref()).map_err(|e| e.to_string())?
            } else {
                return Err("key data or key path required for key auth".into());
            };

            let hash_alg = handle
                .best_supported_rsa_hash()
                .await
                .map_err(|e| e.to_string())?
                .flatten();
            tokio::time::timeout(
                std::time::Duration::from_secs(20),
                handle.authenticate_publickey(username, PrivateKeyWithHashAlg::new(Arc::new(key_pair), hash_alg))
            )
            .await
            .map_err(|_| "Key authentication timed out after 20 seconds".to_string())?
            .map_err(|e| e.to_string())?
            .success()
        }
        other => return Err(format!("unknown auth method: {other}")),
    };

    if !authenticated {
        let _ = handle.disconnect(russh::Disconnect::ByApplication, "", "English").await;
        return Err("SSH authentication failed".into());
    }

    Ok(handle)
}

// Shared by the ad-hoc connect form (ssh_connect) and saved profiles
// (vault::profile_connect) -- profiles decrypt their secrets and call
// straight into this, so plaintext credentials never round-trip back out
// to the frontend just to reconnect.
pub async fn connect_ssh(
    app: AppHandle,
    state: State<'_, SshState>,
    host: String,
    port: u16,
    username: String,
    auth_method: String,
    password: Option<String>,
    key_path: Option<String>,
    key_data: Option<String>,
    passphrase: Option<String>,
    cols: u16,
    rows: u16,
) -> Result<u32, String> {
    let handle = authenticate(&host, port, username, &auth_method, password, key_path, key_data, passphrase).await?;

    let channel = handle.channel_open_session().await.map_err(|e| e.to_string())?;
    channel
        .request_pty(false, "xterm-256color", cols as u32, rows as u32, 0, 0, &[])
        .await
        .map_err(|e| e.to_string())?;
    channel.request_shell(false).await.map_err(|e| e.to_string())?;

    let (mut read_half, write_half) = channel.split();

    let id = state.next_id.fetch_add(1, Ordering::SeqCst);
    state
        .sessions
        .lock()
        .await
        .insert(id, SshSession { write_half, handle });

    tauri::async_runtime::spawn(async move {
        while let Some(msg) = read_half.wait().await {
            match msg {
                ChannelMsg::Data { data } => {
                    let data = String::from_utf8_lossy(&data).into_owned();
                    if app.emit("ssh-output", SshOutputPayload { id, data }).is_err() {
                        break;
                    }
                }
                ChannelMsg::Close | ChannelMsg::Eof => break,
                _ => {}
            }
        }
        let _ = app.emit("ssh-exit", SshExitPayload { id });
    });

    Ok(id)
}

#[tauri::command]
pub async fn ssh_write(state: State<'_, SshState>, id: u32, data: String) -> Result<(), String> {
    let sessions = state.sessions.lock().await;
    let session = sessions.get(&id).ok_or("no such ssh session")?;
    session.write_half.data(data.as_bytes()).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn ssh_resize(state: State<'_, SshState>, id: u32, cols: u16, rows: u16) -> Result<(), String> {
    let sessions = state.sessions.lock().await;
    let session = sessions.get(&id).ok_or("no such ssh session")?;
    session
        .write_half
        .window_change(cols as u32, rows as u32, 0, 0)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn ssh_kill(state: State<'_, SshState>, id: u32) -> Result<(), String> {
    let session = state.sessions.lock().await.remove(&id);
    if let Some(session) = session {
        let _ = session.handle.disconnect(Disconnect::ByApplication, "", "English").await;
    }
    Ok(())
}


