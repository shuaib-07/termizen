use std::process::Command;
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use tokio::io::AsyncWriteExt;

#[derive(Clone, Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DownloadProgress {
    pub downloaded_bytes: u64,
    pub total_bytes: Option<u64>,
    pub percent: f64,
    pub speed_bytes_per_sec: u64,
}

#[derive(Clone, Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DownloadInstallParams {
    pub asset_url: String,
    pub version: String,
    pub passive: Option<bool>,
}

#[tauri::command]
pub async fn app_download_and_install_update(
    app: AppHandle,
    params: DownloadInstallParams,
) -> Result<(), String> {
    // 1. Resolve temp destination path: %TEMP%\termizen_setup_<version>.exe
    let temp_dir = std::env::temp_dir();
    let clean_version = params.version.trim().trim_start_matches('v');
    let file_name = format!("termizen_setup_{}.exe", clean_version);
    let dest_path = temp_dir.join(file_name);

    // 2. Fetch the asset using reqwest (automatically follows redirects)
    let client = reqwest::Client::builder()
        .user_agent("termizen-updater")
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let response = client
        .get(&params.asset_url)
        .send()
        .await
        .map_err(|e| format!("Failed to connect to update asset: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Download failed with HTTP status: {}", response.status()));
    }

    let total_bytes = response.content_length();

    // 3. Open temporary file for writing
    let mut file = tokio::fs::File::create(&dest_path)
        .await
        .map_err(|e| format!("Failed to create installer file: {}", e))?;

    let mut stream = response.bytes_stream();
    let mut downloaded_bytes = 0u64;
    let mut last_emit = std::time::Instant::now();
    let mut bytes_since_last_emit = 0u64;
    let mut current_speed = 0u64;

    while let Some(chunk_result) = stream.next().await {
        let chunk = chunk_result.map_err(|e| format!("Error downloading chunk: {}", e))?;
        file.write_all(&chunk)
            .await
            .map_err(|e| format!("Error writing chunk to disk: {}", e))?;

        downloaded_bytes += chunk.len() as u64;
        bytes_since_last_emit += chunk.len() as u64;

        if last_emit.elapsed().as_millis() >= 120 {
            let elapsed_secs = last_emit.elapsed().as_secs_f64();
            if elapsed_secs > 0.0 {
                current_speed = (bytes_since_last_emit as f64 / elapsed_secs) as u64;
            }
            bytes_since_last_emit = 0;
            last_emit = std::time::Instant::now();

            let percent = if let Some(tot) = total_bytes {
                if tot > 0 {
                    ((downloaded_bytes as f64 / tot as f64) * 100.0).min(99.9)
                } else {
                    0.0
                }
            } else {
                0.0
            };

            let _ = app.emit(
                "update-download-progress",
                DownloadProgress {
                    downloaded_bytes,
                    total_bytes,
                    percent,
                    speed_bytes_per_sec: current_speed,
                },
            );
        }
    }

    // Flush and close file
    file.flush()
        .await
        .map_err(|e| format!("Failed to flush installer file: {}", e))?;
    drop(file);

    // Final 100% progress emit
    let _ = app.emit(
        "update-download-progress",
        DownloadProgress {
            downloaded_bytes,
            total_bytes: Some(downloaded_bytes),
            percent: 100.0,
            speed_bytes_per_sec: 0,
        },
    );

    let _ = app.emit("update-download-complete", ());

    // 4. Launch the installer
    // If passive is true (default), runs with `/passive` for smooth hands-free install
    let is_passive = params.passive.unwrap_or(true);
    let mut cmd = Command::new(&dest_path);
    if is_passive {
        cmd.arg("/passive");
    }

    cmd.spawn()
        .map_err(|e| format!("Failed to launch installer ({}): {}", dest_path.display(), e))?;

    // 5. Exit Termizen so installer can replace executable files cleanly
    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
    app.exit(0);

    Ok(())
}

