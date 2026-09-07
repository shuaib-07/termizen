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
pub struct MacroExecState {
    runs: Mutex<HashMap<u32, Handle<SshClientHandler>>>,
    next_id: AtomicU32,
}

#[derive(Clone, Serialize)]
struct MacroOutputPayload {
    run_id: u32,
    data: String,
}

#[derive(Clone, Serialize)]
struct MacroStepPayload {
    run_id: u32,
    index: usize,
    command: String,
}

#[derive(Clone, Serialize)]
struct MacroStepDonePayload {
    run_id: u32,
    index: usize,
    exit_status: u32,
}

#[derive(Clone, Serialize)]
struct MacroExitPayload {
    run_id: u32,
    success: bool,
    error: Option<String>,
}

#[tauri::command]
pub async fn macro_run_exec(
    app: AppHandle,
    vault: State<'_, VaultState>,
    macro_state: State<'_, MacroExecState>,
    profile_id: i64,
    macro_id: i64,
) -> Result<u32, String> {
    let creds = vault::load_ssh_credentials(&vault, profile_id)?;
    let (run_mode, halt_on_error, steps) = vault::load_macro(&vault, macro_id)?;
    if run_mode != "exec" {
        return Err(format!("macro {macro_id} is not an exec-mode macro"));
    }

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

    let run_id = macro_state.next_id.fetch_add(1, Ordering::SeqCst);
    macro_state.runs.lock().await.insert(run_id, handle);

    tauri::async_runtime::spawn(async move {
        let state = app.state::<MacroExecState>();
        let mut success = true;
        let mut error = None;

        for (index, command) in steps.iter().enumerate() {
            let _ = app.emit("macro-step", MacroStepPayload { run_id, index, command: command.clone() });

            let channel_result = {
                let runs = state.runs.lock().await;
                match runs.get(&run_id) {
                    Some(handle) => handle.channel_open_session().await,
                    None => {
                        error = Some("macro stopped".to_string());
                        break;
                    }
                }
            };
            let channel = match channel_result {
                Ok(c) => c,
                Err(e) => {
                    success = false;
                    error = Some(e.to_string());
                    break;
                }
            };
            if let Err(e) = channel.exec(true, command.as_bytes()).await {
                success = false;
                error = Some(e.to_string());
                break;
            }

            let (mut read_half, _write_half) = channel.split();
            let mut exit_status = None;
            while let Some(msg) = read_half.wait().await {
                match msg {
                    ChannelMsg::Data { data } => {
                        let data = String::from_utf8_lossy(&data).into_owned();
                        let _ = app.emit("macro-output", MacroOutputPayload { run_id, data });
                    }
                    ChannelMsg::ExitStatus { exit_status: code } => exit_status = Some(code),
                    ChannelMsg::Close | ChannelMsg::Eof => break,
                    _ => {}
                }
            }

            let exit_status = exit_status.unwrap_or(1);
            let _ = app.emit("macro-step-done", MacroStepDonePayload { run_id, index, exit_status });

            if halt_on_error && exit_status != 0 {
                success = false;
                break;
            }
        }

        if let Some(handle) = state.runs.lock().await.remove(&run_id) {
            let _ = handle.disconnect(Disconnect::ByApplication, "", "English").await;
        }
        let _ = app.emit("macro-exit", MacroExitPayload { run_id, success, error });
    });

    Ok(run_id)
}

#[tauri::command]
pub async fn macro_stop(macro_state: State<'_, MacroExecState>, run_id: u32) -> Result<(), String> {
    let handle = macro_state.runs.lock().await.remove(&run_id);
    if let Some(handle) = handle {
        let _ = handle.disconnect(Disconnect::ByApplication, "", "English").await;
    }
    Ok(())
}
