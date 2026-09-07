use russh::ChannelMsg;
use serde::Serialize;
use std::collections::HashSet;
use tauri::State;

use crate::ssh;
use crate::vault::{self, VaultState};

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscoveredService {
    pub name: String,
    pub service_type: String,
    pub target: String,
    pub description: String,
}

const DISCOVER_CMD: &str = r#"sh -c '
echo "===PM2==="
pm2 jlist 2>/dev/null
for d in /home/*/.pm2 /root/.pm2; do
  if [ -d "$d" ]; then
    PM2_HOME="$d" pm2 jlist 2>/dev/null
  fi
done

echo "===DOCKER==="
docker ps --format "{{.Names}}\t{{.Image}}\t{{.Status}}" 2>/dev/null

echo "===SYSTEMD==="
systemctl list-units --type=service --state=running --no-pager --no-legend 2>/dev/null | awk "{print \$1}"
ls /etc/systemd/system/*.service 2>/dev/null | xargs -n 1 basename 2>/dev/null

echo "===LOGFILES==="
ls -1t /home/*/.pm2/logs/*-out.log /home/*/.pm2/logs/*-error.log /root/.pm2/logs/*-out.log /var/log/nginx/access.log /var/log/nginx/error.log /home/*/logs/*.log 2>/dev/null | head -n 10
'"#;

fn is_os_system_daemon(name: &str) -> bool {
    let lower = name.to_lowercase();
    let daemons = [
        "systemd-", "dbus", "cron", "getty", "serial-getty", "udev", "rsyslog", "polkit",
        "snapd", "multipathd", "ssh", "ufw", "unattended", "accounts", "irqbalance",
        "networkmanager", "networkd", "modemmanager", "wpa_supplicant", "bluetooth",
        "user@", "session-", "emergency", "rescue", "sys-", "plymouth", "apparmor",
        "keyboard", "console", "lvm2", "cryptdisks", "proc-sys", "iscsi", "open-iscsi",
        "qemu-guest", "cloud-", "walinuxagent", "chrony", "monarx", "cloud-init",
        "syslog", "pm2-root", "pm2-ubuntu",
    ];

    for d in daemons {
        if lower.starts_with(d) || lower == d {
            return true;
        }
    }
    false
}

#[tauri::command]
pub async fn discover_services(
    vault: State<'_, VaultState>,
    profile_id: i64,
) -> Result<Vec<DiscoveredService>, String> {
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
    channel.exec(true, DISCOVER_CMD.as_bytes()).await.map_err(|e| e.to_string())?;

    let (mut read_half, _write_half) = channel.split();
    let mut output = String::new();

    while let Some(msg) = read_half.wait().await {
        match msg {
            ChannelMsg::Data { data } => {
                output.push_str(&String::from_utf8_lossy(&data));
            }
            ChannelMsg::Close | ChannelMsg::Eof => break,
            _ => {}
        }
    }

    let _ = handle.disconnect(russh::Disconnect::ByApplication, "", "English").await;

    let mut services = Vec::new();
    let mut seen_targets = HashSet::new();
    let mut current_section = "";
    let mut pm2_json = String::new();

    for line in output.lines() {
        let trimmed = line.trim();
        if trimmed == "===PM2===" {
            current_section = "PM2";
            continue;
        } else if trimmed == "===DOCKER===" {
            current_section = "DOCKER";
            continue;
        } else if trimmed == "===SYSTEMD===" {
            current_section = "SYSTEMD";
            continue;
        } else if trimmed == "===LOGFILES===" {
            current_section = "LOGFILES";
            continue;
        }

        match current_section {
            "PM2" => {
                pm2_json.push_str(line);
                pm2_json.push('\n');
            }
            "DOCKER" => {
                if !trimmed.is_empty() {
                    let parts: Vec<&str> = trimmed.split('\t').collect();
                    if !parts.is_empty() {
                        let name = parts[0];
                        let image = parts.get(1).copied().unwrap_or("");
                        let target = name.to_string();
                        if seen_targets.insert(format!("docker:{}", target)) {
                            services.push(DiscoveredService {
                                name: format!("Docker: {}", name),
                                service_type: "docker".to_string(),
                                target,
                                description: format!("Image: {}", image),
                            });
                        }
                    }
                }
            }
            "SYSTEMD" => {
                if !trimmed.is_empty() {
                    let target = trimmed.trim();
                    let clean_name = target.strip_suffix(".service").unwrap_or(target);

                    // Skip OS background daemons
                    if is_os_system_daemon(clean_name) {
                        continue;
                    }

                    if seen_targets.insert(format!("systemd:{}", clean_name)) {
                        let lower = clean_name.to_lowercase();
                        let desc = if lower.contains("frontend") || lower.contains("web") || lower.contains("ui") {
                            "Frontend Web App (Systemd)"
                        } else if lower.contains("backend") || lower.contains("api") || lower.contains("server") {
                            "Backend API Service (Systemd)"
                        } else if lower.contains("nginx") || lower.contains("caddy") || lower.contains("apache") {
                            "Web Server / Reverse Proxy"
                        } else if lower.contains("postgres") || lower.contains("mysql") || lower.contains("redis") || lower.contains("mongo") {
                            "Database / Cache Service"
                        } else {
                            "Application Service"
                        };

                        services.push(DiscoveredService {
                            name: format!("Systemd: {}", clean_name),
                            service_type: "systemd".to_string(),
                            target: clean_name.to_string(),
                            description: desc.to_string(),
                        });
                    }
                }
            }
            "LOGFILES" => {
                if !trimmed.is_empty() && trimmed.starts_with('/') {
                    let file_path = trimmed;
                    let filename = file_path.rsplit('/').next().unwrap_or(file_path);
                    
                    let display_name = if filename.contains("access.log") {
                        "Nginx Access Log".to_string()
                    } else if filename.contains("error.log") {
                        "Nginx Error Log".to_string()
                    } else if filename.contains("-out.log") {
                        format!("PM2 Out: {}", filename.replace("-out.log", ""))
                    } else if filename.contains("-error.log") {
                        format!("PM2 Error: {}", filename.replace("-error.log", ""))
                    } else {
                        format!("Log: {}", filename)
                    };

                    let desc = if filename.contains("access.log") {
                        "Live HTTP Request Stream".to_string()
                    } else {
                        format!("Log File ({})", file_path)
                    };

                    if seen_targets.insert(format!("tail:{}", file_path)) {
                        services.push(DiscoveredService {
                            name: display_name,
                            service_type: "tail".to_string(),
                            target: file_path.to_string(),
                            description: desc,
                        });
                    }
                }
            }
            _ => {}
        }
    }

    // Parse all PM2 output streams (handles multi-user concatenated JSON streams)
    let deserializer = serde_json::Deserializer::from_str(&pm2_json).into_iter::<serde_json::Value>();
    for val in deserializer.flatten() {
        if let Some(arr) = val.as_array() {
            for item in arr {
                if let Some(name) = item.get("name").and_then(|v| v.as_str()) {
                    let status = item
                        .get("pm2_env")
                        .and_then(|e| e.get("status"))
                        .and_then(|s| s.as_str())
                        .unwrap_or("online");
                    let mem = item
                        .get("monit")
                        .and_then(|m| m.get("memory"))
                        .and_then(|m| m.as_u64())
                        .map(|m| format!(" ({:.1} MB)", m as f64 / 1024.0 / 1024.0))
                        .unwrap_or_default();

                    let lower = name.to_lowercase();
                    let desc = if lower.contains("front") || lower.contains("web") || lower.contains("ui") {
                        format!("Frontend Web App • PM2 ({}{})", status, mem)
                    } else if lower.contains("back") || lower.contains("api") || lower.contains("server") {
                        format!("Backend API Service • PM2 ({}{})", status, mem)
                    } else {
                        format!("PM2 App • Status: {}{}", status, mem)
                    };

                    if seen_targets.insert(format!("pm2:{}", name)) {
                        services.push(DiscoveredService {
                            name: format!("PM2: {}", name),
                            service_type: "pm2".to_string(),
                            target: name.to_string(),
                            description: desc,
                        });
                    }
                }
            }
        }
    }

    Ok(services)
}
