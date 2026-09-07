use std::collections::HashMap;
use std::sync::atomic::{AtomicU32, Ordering};

use russh::client::Handle;
use russh::{ChannelMsg, Disconnect};
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::sync::Mutex;

use crate::ssh::{self, SshClientHandler};
use crate::vault::{self, VaultState};

#[derive(Default)]
pub struct LogStreamState {
    streams: Mutex<HashMap<u32, Handle<SshClientHandler>>>,
    next_id: AtomicU32,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LogStreamDataPayload {
    pub stream_id: u32,
    pub service_id: i64,
    pub data: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LogStreamExitPayload {
    pub stream_id: u32,
    pub service_id: i64,
}

fn build_log_command(service_type: &str, target: &str, lines: u32) -> String {
    let lines = lines.max(10).min(5000);
    match service_type {
        "pm2" => format!(
            "sh -c 'export PATH=\"$PATH:/usr/local/bin:/usr/bin:/bin:/root/.nvm/versions/node/$(ls /root/.nvm/versions/node 2>/dev/null | tail -n 1)/bin\"; if which pm2 >/dev/null 2>&1; then pm2 logs {} --time --lines {}; else for d in /home/*/.pm2 /root/.pm2; do if [ -d \"$d\" ]; then PM2_HOME=\"$d\" pm2 logs {} --time --lines {}; break; fi; done; fi'",
            target, lines, target, lines
        ),
        "docker" => format!("docker logs -f --timestamps --tail {} {}", lines, target),
        "systemd" => format!("journalctl -u {} -f -n {} --no-pager -o short-iso", target, lines),
        "tail" => format!("tail -n {} -f {}", lines, target),
        "custom" => target.to_string(),
        _ => format!("tail -n {} -f {}", lines, target),
    }
}

#[tauri::command]
pub async fn log_stream_start(
    app: AppHandle,
    vault: State<'_, VaultState>,
    log_state: State<'_, LogStreamState>,
    profile_id: i64,
    service_id: i64,
    service_type: String,
    target: String,
    lines: Option<u32>,
) -> Result<u32, String> {
    let creds = vault::load_ssh_credentials(&vault, profile_id)?;
    let handle = ssh::authenticate(
        &creds.host,
        creds.port,
        creds.username,
        &creds.auth_method,
        creds.password,
        creds.key_path,
        creds.key_data,
        creds.passphrase,
    )
    .await?;

    let channel = handle.channel_open_session().await.map_err(|e| e.to_string())?;
    let cmd = build_log_command(&service_type, &target, lines.unwrap_or(150));
    channel.exec(true, cmd.as_bytes()).await.map_err(|e| e.to_string())?;

    let stream_id = log_state.next_id.fetch_add(1, Ordering::SeqCst);
    log_state.streams.lock().await.insert(stream_id, handle);

    let (mut read_half, _write_half) = channel.split();

    tauri::async_runtime::spawn(async move {
        while let Some(msg) = read_half.wait().await {
            match msg {
                ChannelMsg::Data { data } | ChannelMsg::ExtendedData { data, .. } => {
                    let text = String::from_utf8_lossy(&data).into_owned();
                    let _ = app.emit(
                        "log-stream-data",
                        LogStreamDataPayload {
                            stream_id,
                            service_id,
                            data: text,
                        },
                    );
                }
                ChannelMsg::Close | ChannelMsg::Eof => break,
                _ => {}
            }
        }

        let state = app.state::<LogStreamState>();
        if let Some(handle) = state.streams.lock().await.remove(&stream_id) {
            let _ = handle.disconnect(Disconnect::ByApplication, "", "English").await;
        }

        let _ = app.emit(
            "log-stream-exit",
            LogStreamExitPayload {
                stream_id,
                service_id,
            },
        );
    });

    Ok(stream_id)
}

#[tauri::command]
pub async fn log_stream_stop(
    log_state: State<'_, LogStreamState>,
    stream_id: u32,
) -> Result<(), String> {
    let handle = log_state.streams.lock().await.remove(&stream_id);
    if let Some(handle) = handle {
        let _ = handle.disconnect(Disconnect::ByApplication, "", "English").await;
    }
    Ok(())
}
