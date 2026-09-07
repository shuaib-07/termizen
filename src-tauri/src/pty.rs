use std::collections::HashMap;
use std::io::Write;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Mutex;

use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use serde::Serialize;
use tauri::{AppHandle, Emitter, State};

struct PtySession {
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    child: Box<dyn Child + Send + Sync>,
}

#[derive(Default)]
pub struct PtyState {
    sessions: Mutex<HashMap<u32, PtySession>>,
    next_id: AtomicU32,
}

#[derive(Clone, Serialize)]
struct PtyOutputPayload {
    id: u32,
    data: String,
}

#[derive(Clone, Serialize)]
struct PtyExitPayload {
    id: u32,
}

#[tauri::command]
pub fn pty_spawn(
    app: AppHandle,
    state: State<PtyState>,
    cols: u16,
    rows: u16,
    shell: Option<String>,
) -> Result<u32, String> {
    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| e.to_string())?;

    // ponytail: only powershell/cmd resolved by friendly name; WSL distros
    // (`wsl.exe -d <distro>`) not wired up yet -- add when a profile needs one.
    let exe = match shell.as_deref() {
        Some("cmd") => "cmd.exe",
        Some("powershell") | None => "powershell.exe",
        Some(other) => other,
    };
    let cmd = CommandBuilder::new(exe);
    let child = pair
        .slave
        .spawn_command(cmd)
        .map_err(|e| e.to_string())?;
    drop(pair.slave);

    let reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
    let writer = pair.master.take_writer().map_err(|e| e.to_string())?;

    let id = state.next_id.fetch_add(1, Ordering::SeqCst);

    state.sessions.lock().unwrap().insert(
        id,
        PtySession {
            master: pair.master,
            writer,
            child,
        },
    );

    std::thread::spawn(move || {
        let mut reader = reader;
        let mut buf = [0u8; 4096];
        loop {
            match std::io::Read::read(&mut reader, &mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    let data = String::from_utf8_lossy(&buf[..n]).into_owned();
                    if app.emit("pty-output", PtyOutputPayload { id, data }).is_err() {
                        break;
                    }
                }
                Err(_) => break,
            }
        }
        let _ = app.emit("pty-exit", PtyExitPayload { id });
    });

    Ok(id)
}

#[tauri::command]
pub fn pty_write(state: State<PtyState>, id: u32, data: String) -> Result<(), String> {
    let mut sessions = state.sessions.lock().unwrap();
    let session = sessions.get_mut(&id).ok_or("no such pty session")?;
    session
        .writer
        .write_all(data.as_bytes())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn pty_resize(state: State<PtyState>, id: u32, cols: u16, rows: u16) -> Result<(), String> {
    let sessions = state.sessions.lock().unwrap();
    let session = sessions.get(&id).ok_or("no such pty session")?;
    session
        .master
        .resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn pty_kill(state: State<PtyState>, id: u32) -> Result<(), String> {
    let mut sessions = state.sessions.lock().unwrap();
    if let Some(mut session) = sessions.remove(&id) {
        let _ = session.child.kill();
    }
    Ok(())
}
