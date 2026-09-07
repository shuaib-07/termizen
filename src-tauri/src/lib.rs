mod discover;
mod logs;
mod macro_exec;
mod monitor;
mod pty;
mod ssh;
mod traffic;
mod vault;

use logs::LogStreamState;
use macro_exec::MacroExecState;
use monitor::MonitorState;
use pty::PtyState;
use ssh::SshState;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::Manager;
use vault::VaultState;

#[tauri::command]
fn app_hide_to_tray(window: tauri::WebviewWindow) -> Result<(), String> {
    window.hide().map_err(|e| e.to_string())
}

#[tauri::command]
fn app_show(window: tauri::WebviewWindow) -> Result<(), String> {
    let _ = window.show();
    let _ = window.unminimize();
    let _ = window.set_focus();
    Ok(())
}

#[tauri::command]
fn app_exit(app_handle: tauri::AppHandle) {
    app_handle.exit(0);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(PtyState::default())
        .manage(SshState::default())
        .manage(MacroExecState::default())
        .manage(MonitorState::default())
        .manage(LogStreamState::default())
        .setup(|app| {
            let vault = VaultState::init(&app.handle().clone()).expect("vault init");
            app.manage(vault);

            // Real Windows Mica, not CSS: this sets the native DWM backdrop
            // material on the window. tauri.conf.json's "transparent": true
            // makes the webview itself paint nothing where the page doesn't,
            // so the OS-composited Mica shows through. dark=true matches
            // design.md's dark-only theme.
            if let Some(window) = app.get_webview_window("main") {
                let _ = window_vibrancy::apply_mica(&window, Some(true));
                let _ = window.maximize();
            }

            // Setup system tray icon with context menu and click-to-restore
            let show_item = MenuItem::with_id(app, "show", "Show Termizen", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit Termizen", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_item, &quit_item])?;

            let mut tray_builder = TrayIconBuilder::new()
                .tooltip("Termizen")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                        }
                    }
                });

            if let Some(icon) = app.default_window_icon() {
                tray_builder = tray_builder.icon(icon.clone());
            }

            let _ = tray_builder.build(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            pty::pty_spawn,
            pty::pty_write,
            pty::pty_resize,
            pty::pty_kill,
            ssh::ssh_connect,
            ssh::ssh_write,
            ssh::ssh_resize,
            ssh::ssh_kill,
            vault::key_save,
            vault::key_list,
            vault::key_delete,
            vault::profile_save,
            vault::profile_update,
            vault::profile_list,
            vault::profile_set_pinned,
            vault::profile_set_bg_monitoring,
            vault::profile_delete,
            vault::profile_connect,
            vault::profile_get_password,
            vault::profile_service_save,
            vault::profile_service_update,
            vault::profile_service_delete,
            vault::profile_service_list,
            vault::profile_service_set_paused,
            vault::macro_save,
            vault::macro_update,
            vault::macro_list,
            vault::macro_delete,
            vault::macro_steps,
            macro_exec::macro_run_exec,
            macro_exec::macro_stop,
            monitor::monitor_fetch_metrics,
            logs::log_stream_start,
            logs::log_stream_stop,
            discover::discover_services,
            traffic::web_traffic_detect_logs,
            traffic::web_traffic_probe,
            vault::profile_set_web_log_path,
            app_hide_to_tray,
            app_show,
            app_exit,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

