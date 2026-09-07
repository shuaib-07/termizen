use std::collections::HashMap;
use russh::ChannelMsg;
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::ssh;
use crate::vault::{self, VaultState};

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TopEndpoint {
    pub path: String,
    pub count: u32,
    pub percent: f32,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TopClientIp {
    pub ip: String,
    pub count: u32,
    pub percent: f32,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecentRequest {
    pub timestamp: String,
    pub method: String,
    pub path: String,
    pub status: u16,
    pub client_ip: String,
    pub bytes_sent: u64,
}

#[derive(Clone, Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct TrafficStatusBreakdown {
    pub count_2xx: u32,
    pub count_3xx: u32,
    pub count_4xx: u32,
    pub count_5xx: u32,
    pub code_counts: HashMap<String, u32>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WebTrafficMetrics {
    pub active_log_path: Option<String>,
    pub detected_logs: Vec<String>,
    pub total_sampled: u32,
    pub requests_per_sec: f32,
    pub success_rate: f32,
    pub status: TrafficStatusBreakdown,
    pub top_endpoints: Vec<TopEndpoint>,
    pub top_client_ips: Vec<TopClientIp>,
    pub recent_requests: Vec<RecentRequest>,
    pub timestamp: u64,
}

async fn execute_ssh_cmd(
    handle: &russh::client::Handle<ssh::SshClientHandler>,
    cmd: &str,
) -> Result<String, String> {
    let channel = handle.channel_open_session().await.map_err(|e| e.to_string())?;
    channel.exec(true, cmd.as_bytes()).await.map_err(|e| e.to_string())?;

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

    Ok(output)
}

struct ParsedLine {
    ip: String,
    timestamp: String,
    method: String,
    path: String,
    status: u16,
    bytes: u64,
}

fn parse_combined_log_line(line: &str) -> Option<ParsedLine> {
    let trimmed = line.trim();
    if trimmed.is_empty() {
        return None;
    }

    // Check if JSON log format (e.g. Caddy JSON)
    if trimmed.starts_with('{') && trimmed.ends_with('}') {
        if let Ok(val) = serde_json::from_str::<serde_json::Value>(trimmed) {
            let status = val.get("status").and_then(|s| s.as_u64()).unwrap_or(200) as u16;
            let bytes = val.get("size").and_then(|s| s.as_u64()).unwrap_or(0);
            let ip = val.get("request")
                .and_then(|r| r.get("remote_ip"))
                .and_then(|s| s.as_str())
                .unwrap_or("127.0.0.1")
                .to_string();
            let method = val.get("request")
                .and_then(|r| r.get("method"))
                .and_then(|s| s.as_str())
                .unwrap_or("GET")
                .to_string();
            let path = val.get("request")
                .and_then(|r| r.get("uri"))
                .and_then(|s| s.as_str())
                .unwrap_or("/")
                .to_string();
            let timestamp = val.get("ts").map(|t| t.to_string()).unwrap_or_else(|| "recent".into());

            return Some(ParsedLine {
                ip,
                timestamp,
                method,
                path,
                status,
                bytes,
            });
        }
    }

    // Standard Combined / Nginx / Apache Log Format:
    // 187.53.130.18 - - [06/Sep/2026:21:40:12 +0000] "GET /api/v1/users HTTP/1.1" 200 1420 "..." "..."
    let ip = trimmed.split_whitespace().next()?.to_string();

    let open_bracket = trimmed.find('[')?;
    let close_bracket = trimmed.find(']')?;
    if close_bracket <= open_bracket {
        return None;
    }
    let timestamp = trimmed[open_bracket + 1..close_bracket].to_string();

    let first_quote = trimmed.find('"')?;
    let remaining_after_quote = &trimmed[first_quote + 1..];
    let second_quote = remaining_after_quote.find('"')?;
    let request_str = &remaining_after_quote[..second_quote];

    let mut req_parts = request_str.split_whitespace();
    let method = req_parts.next().unwrap_or("GET").to_string();
    let mut path = req_parts.next().unwrap_or("/").to_string();
    if let Some(idx) = path.find('?') {
        path.truncate(idx); // strip query params for grouping
    }

    let tail_after_req = &remaining_after_quote[second_quote + 1..].trim();
    let mut tail_tokens = tail_after_req.split_whitespace();
    let status_str = tail_tokens.next().unwrap_or("200");
    let status = status_str.parse::<u16>().unwrap_or(200);
    let bytes_str = tail_tokens.next().unwrap_or("0");
    let bytes = bytes_str.parse::<u64>().unwrap_or(0);

    Some(ParsedLine {
        ip,
        timestamp,
        method,
        path,
        status,
        bytes,
    })
}

pub fn parse_traffic_output(raw: &str) -> WebTrafficMetrics {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64;

    let mut detected_logs = Vec::new();
    let mut active_log = None;
    let mut log_lines = Vec::new();

    let mut current_section = "";
    for line in raw.lines() {
        if line.starts_with("===DETECTED_LIST===") {
            current_section = "DETECTED";
            continue;
        } else if line.starts_with("===ACTIVE_LOG===") {
            current_section = "ACTIVE";
            continue;
        } else if line.starts_with("===TAIL===") {
            current_section = "TAIL";
            continue;
        }

        match current_section {
            "DETECTED" => {
                let trimmed = line.trim();
                if !trimmed.is_empty() && trimmed.starts_with('/') {
                    detected_logs.push(trimmed.to_string());
                }
            }
            "ACTIVE" => {
                let trimmed = line.trim();
                if !trimmed.is_empty() && trimmed.starts_with('/') {
                    active_log = Some(trimmed.to_string());
                }
            }
            "TAIL" => {
                let trimmed = line.trim();
                if !trimmed.is_empty() {
                    log_lines.push(trimmed);
                }
            }
            _ => {}
        }
    }

    let mut parsed_requests = Vec::new();
    let mut status_breakdown = TrafficStatusBreakdown::default();
    let mut endpoint_counts: HashMap<String, u32> = HashMap::new();
    let mut ip_counts: HashMap<String, u32> = HashMap::new();

    for line in &log_lines {
        if let Some(req) = parse_combined_log_line(line) {
            if req.status >= 200 && req.status < 300 {
                status_breakdown.count_2xx += 1;
            } else if req.status >= 300 && req.status < 400 {
                status_breakdown.count_3xx += 1;
            } else if req.status >= 400 && req.status < 500 {
                status_breakdown.count_4xx += 1;
            } else if req.status >= 500 {
                status_breakdown.count_5xx += 1;
            }

            *status_breakdown.code_counts.entry(req.status.to_string()).or_insert(0) += 1;
            *endpoint_counts.entry(req.path.clone()).or_insert(0) += 1;
            *ip_counts.entry(req.ip.clone()).or_insert(0) += 1;

            parsed_requests.push(req);
        }
    }

    let total = parsed_requests.len() as u32;
    let success_rate = if total > 0 {
        ((status_breakdown.count_2xx as f32 / total as f32) * 100.0 * 10.0).round() / 10.0
    } else {
        100.0
    };

    // Calculate requests per second based on sample density (sample window ~ 60s)
    let rps = if total > 0 {
        ((total as f32 / 60.0) * 10.0).round() / 10.0
    } else {
        0.0
    };

    // Top endpoints
    let mut sorted_endpoints: Vec<TopEndpoint> = endpoint_counts
        .into_iter()
        .map(|(path, count)| {
            let percent = if total > 0 {
                ((count as f32 / total as f32) * 100.0 * 10.0).round() / 10.0
            } else {
                0.0
            };
            TopEndpoint { path, count, percent }
        })
        .collect();
    sorted_endpoints.sort_by(|a, b| b.count.cmp(&a.count));
    sorted_endpoints.truncate(10);

    // Top visitor IPs
    let mut sorted_ips: Vec<TopClientIp> = ip_counts
        .into_iter()
        .map(|(ip, count)| {
            let percent = if total > 0 {
                ((count as f32 / total as f32) * 100.0 * 10.0).round() / 10.0
            } else {
                0.0
            };
            TopClientIp { ip, count, percent }
        })
        .collect();
    sorted_ips.sort_by(|a, b| b.count.cmp(&a.count));
    sorted_ips.truncate(10);

    // Recent requests tail (up to 30 requests, newest first)
    let recent_requests: Vec<RecentRequest> = parsed_requests
        .into_iter()
        .rev()
        .take(30)
        .map(|r| RecentRequest {
            timestamp: r.timestamp,
            method: r.method,
            path: r.path,
            status: r.status,
            client_ip: r.ip,
            bytes_sent: r.bytes,
        })
        .collect();

    WebTrafficMetrics {
        active_log_path: active_log,
        detected_logs,
        total_sampled: total,
        requests_per_sec: rps,
        success_rate,
        status: status_breakdown,
        top_endpoints: sorted_endpoints,
        top_client_ips: sorted_ips,
        recent_requests,
        timestamp: now,
    }
}

#[tauri::command]
pub async fn web_traffic_detect_logs(
    vault: State<'_, VaultState>,
    profile_id: i64,
) -> Result<Vec<String>, String> {
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

    let cmd = r#"sh -c '
for p in \
  /var/log/nginx/access.log \
  /var/log/nginx/*access*.log \
  /var/log/nginx/*.log \
  /var/log/caddy/*.log \
  /var/log/caddy/access.log \
  /var/log/apache2/*access*.log \
  /var/log/apache2/*.log \
  /var/log/httpd/*access*.log \
  /var/log/httpd/*.log \
  /home/*/.pm2/logs/*out.log \
  /home/*/logs/*.log \
  /var/log/*access*.log; do
  if [ -f "$p" ] && [ -r "$p" ]; then
    echo "$p"
  fi
done | sort -u | grep -v "error" | head -n 30
'"#;

    let output = execute_ssh_cmd(&handle, cmd).await?;
    let _ = handle.disconnect(russh::Disconnect::ByApplication, "", "English").await;

    let logs = output
        .lines()
        .map(|l| l.trim().to_string())
        .filter(|l| !l.is_empty() && l.starts_with('/'))
        .collect();

    Ok(logs)
}

#[tauri::command]
pub async fn web_traffic_probe(
    vault: State<'_, VaultState>,
    profile_id: i64,
    custom_log_path: Option<String>,
) -> Result<WebTrafficMetrics, String> {
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

    // Determine target log path
    let target = custom_log_path
        .or_else(|| vault::get_profile_web_log_path(&vault, profile_id).ok().flatten())
        .unwrap_or_default();

    let cmd = format!(
        r#"sh -c '
DETECTED=""
for p in \
  /var/log/nginx/access.log \
  /var/log/nginx/*access*.log \
  /var/log/nginx/*.log \
  /var/log/caddy/*.log \
  /var/log/caddy/access.log \
  /var/log/apache2/*access*.log \
  /var/log/apache2/*.log \
  /var/log/httpd/*access*.log; do
  if [ -f "$p" ] && [ -r "$p" ]; then
    DETECTED="$DETECTED\n$p"
  fi
done

TARGET_LOG="{}"
if [ -z "$TARGET_LOG" ] || [ ! -f "$TARGET_LOG" ]; then
  for p in /var/log/nginx/access.log /var/log/caddy/access.log /var/log/apache2/access.log /var/log/httpd/access_log; do
    if [ -f "$p" ]; then
      TARGET_LOG="$p"
      break
    fi
  done
fi

echo "===DETECTED_LIST==="
echo -e "$DETECTED" | sort -u | grep -v "^$" | head -n 25
echo "===ACTIVE_LOG==="
echo "$TARGET_LOG"
echo "===TAIL==="
if [ -n "$TARGET_LOG" ] && [ -f "$TARGET_LOG" ]; then
  tail -n 300 "$TARGET_LOG" 2>/dev/null
fi
'"#,
        target
    );

    let output = execute_ssh_cmd(&handle, &cmd).await?;
    let _ = handle.disconnect(russh::Disconnect::ByApplication, "", "English").await;

    let metrics = parse_traffic_output(&output);
    Ok(metrics)
}
