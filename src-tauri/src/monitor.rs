use std::collections::HashMap;
use std::sync::Arc;
use std::time::Instant;

use russh::ChannelMsg;
use serde::{Deserialize, Serialize};
use tauri::State;
use tokio::sync::Mutex;

use crate::ssh;
use crate::vault::{self, VaultState};

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CpuMetrics {
    pub overall: f32,
    pub cores: Vec<f32>,
    pub model_name: String,
    pub user_percent: f32,
    pub system_percent: f32,
    pub idle_percent: f32,
    pub iowait_percent: f32,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MemoryMetrics {
    pub total_bytes: u64,
    pub used_bytes: u64,
    pub free_bytes: u64,
    pub available_bytes: u64,
    pub cached_bytes: u64,
    pub swap_total_bytes: u64,
    pub swap_used_bytes: u64,
    pub swap_free_bytes: u64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiskDevice {
    pub device: String,
    pub mount_point: String,
    pub total_bytes: u64,
    pub used_bytes: u64,
    pub free_bytes: u64,
    pub used_percent: f32,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiskMetrics {
    pub total_bytes: u64,
    pub used_bytes: u64,
    pub free_bytes: u64,
    pub used_percent: f32,
    pub mount_point: String,
    pub read_bytes_sec: f64,
    pub write_bytes_sec: f64,
    pub devices: Vec<DiskDevice>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkInterfaceMetrics {
    pub name: String,
    pub rx_bytes_sec: f64,
    pub tx_bytes_sec: f64,
    pub total_rx_bytes: u64,
    pub total_tx_bytes: u64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkMetrics {
    pub rx_bytes_sec: f64,
    pub tx_bytes_sec: f64,
    pub total_rx_bytes: u64,
    pub total_tx_bytes: u64,
    pub interface: String,
    pub interfaces: Vec<NetworkInterfaceMetrics>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HostMetrics {
    pub hostname: String,
    pub os_name: String,
    pub kernel: String,
    pub uptime_seconds: u64,
    pub load_avg: [f32; 3],
    pub public_ip: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerMetrics {
    pub cpu: CpuMetrics,
    pub memory: MemoryMetrics,
    pub disk: DiskMetrics,
    pub network: NetworkMetrics,
    pub host: HostMetrics,
    pub timestamp: u64,
}

#[derive(Clone, Debug)]
struct CpuTimes {
    idle: u64,
    total: u64,
}

#[derive(Clone, Debug, Default)]
struct CpuBreakdownTimes {
    user: u64,
    system: u64,
    idle: u64,
    iowait: u64,
    total: u64,
}

#[derive(Clone, Debug)]
pub(crate) struct PrevSample {
    timestamp: Instant,
    overall_breakdown: CpuBreakdownTimes,
    core_cpus: Vec<CpuTimes>,
    rx_bytes: u64,
    tx_bytes: u64,
    iface_bytes: HashMap<String, (u64, u64)>,
    disk_read_bytes: u64,
    disk_write_bytes: u64,
}

#[derive(Default)]
pub struct MonitorState {
    prev_samples: Arc<Mutex<HashMap<i64, PrevSample>>>,
}

const PROBE_CMD: &str = r#"sh -c '
echo "===STAT==="
cat /proc/stat 2>/dev/null | grep "^cpu"
echo "===MEM==="
cat /proc/meminfo 2>/dev/null
echo "===NET==="
cat /proc/net/dev 2>/dev/null
echo "===DISKSTATS==="
grep -E " (sd[a-z]|nvme[0-9]n[0-9]|vd[a-z]) " /proc/diskstats 2>/dev/null || cat /proc/diskstats 2>/dev/null
echo "===DF==="
df -B1 -x tmpfs -x devtmpfs -x squashfs -x overlay 2>/dev/null | tail -n +2
echo "===UPTIME==="
cat /proc/uptime 2>/dev/null
uptime 2>/dev/null
echo "===HOST==="
uname -s -r -m -n 2>/dev/null
cat /etc/os-release 2>/dev/null | grep "^PRETTY_NAME="
echo "===CPUINFO==="
grep -m1 "model name" /proc/cpuinfo 2>/dev/null
echo "===PUBLIC_IP==="
curl -s -m 1 https://api.ipify.org 2>/dev/null || echo ""
'"#;

pub async fn execute_probe(handle: &russh::client::Handle<ssh::SshClientHandler>) -> Result<String, String> {
    let channel = handle.channel_open_session().await.map_err(|e| e.to_string())?;
    channel.exec(true, PROBE_CMD.as_bytes()).await.map_err(|e| e.to_string())?;

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

fn parse_cpu_line(line: &str) -> Option<CpuTimes> {
    let parts: Vec<&str> = line.split_whitespace().collect();
    if parts.len() < 5 {
        return None;
    }
    let vals: Vec<u64> = parts[1..].iter().filter_map(|s| s.parse::<u64>().ok()).collect();
    if vals.len() < 4 {
        return None;
    }
    let idle = vals.get(3).copied().unwrap_or(0) + vals.get(4).copied().unwrap_or(0); // idle + iowait
    let total: u64 = vals.iter().sum();
    Some(CpuTimes { idle, total })
}

fn parse_cpu_breakdown(line: &str) -> Option<CpuBreakdownTimes> {
    let parts: Vec<&str> = line.split_whitespace().collect();
    if parts.len() < 6 {
        return None;
    }
    let vals: Vec<u64> = parts[1..].iter().filter_map(|s| s.parse::<u64>().ok()).collect();
    if vals.len() < 5 {
        return None;
    }
    let user = vals.get(0).copied().unwrap_or(0) + vals.get(1).copied().unwrap_or(0); // user + nice
    let system = vals.get(2).copied().unwrap_or(0) + vals.get(5).copied().unwrap_or(0) + vals.get(6).copied().unwrap_or(0); // sys + irq + softirq
    let idle = vals.get(3).copied().unwrap_or(0);
    let iowait = vals.get(4).copied().unwrap_or(0);
    let total: u64 = vals.iter().sum();
    Some(CpuBreakdownTimes {
        user,
        system,
        idle,
        iowait,
        total,
    })
}

fn calculate_cpu_percent(prev: &CpuTimes, curr: &CpuTimes) -> f32 {
    let total_delta = curr.total.saturating_sub(prev.total);
    let idle_delta = curr.idle.saturating_sub(prev.idle);
    if total_delta == 0 {
        return 0.0;
    }
    let used_delta = total_delta.saturating_sub(idle_delta);
    ((used_delta as f64 / total_delta as f64) * 100.0) as f32
}

pub fn parse_metrics(
    raw: &str,
    prev_sample: Option<PrevSample>,
) -> (ServerMetrics, PrevSample) {
    let now = Instant::now();
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64;

    let mut sections: HashMap<&str, Vec<&str>> = HashMap::new();
    let mut current_section = "";

    for line in raw.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("===") && trimmed.ends_with("===") {
            current_section = &trimmed[3..trimmed.len() - 3];
            continue;
        }
        if !current_section.is_empty() {
            sections.entry(current_section).or_default().push(trimmed);
        }
    }

    // Parse STAT
    let mut curr_breakdown = CpuBreakdownTimes::default();
    let mut curr_core_cpus = Vec::new();

    if let Some(lines) = sections.get("STAT") {
        for line in lines {
            if line.starts_with("cpu ") {
                if let Some(bd) = parse_cpu_breakdown(line) {
                    curr_breakdown = bd;
                }
            } else if line.starts_with("cpu") {
                if let Some(ct) = parse_cpu_line(line) {
                    curr_core_cpus.push(ct);
                }
            }
        }
    }

    let (overall_cpu_pct, user_pct, sys_pct, idle_pct, io_pct, core_cpu_pcts) = if let Some(ref prev) = prev_sample {
        let total_delta = curr_breakdown.total.saturating_sub(prev.overall_breakdown.total) as f64;
        if total_delta > 0.0 {
            let u = (curr_breakdown.user.saturating_sub(prev.overall_breakdown.user) as f64 / total_delta * 100.0) as f32;
            let s = (curr_breakdown.system.saturating_sub(prev.overall_breakdown.system) as f64 / total_delta * 100.0) as f32;
            let idl = (curr_breakdown.idle.saturating_sub(prev.overall_breakdown.idle) as f64 / total_delta * 100.0) as f32;
            let io = (curr_breakdown.iowait.saturating_sub(prev.overall_breakdown.iowait) as f64 / total_delta * 100.0) as f32;
            let ovr = (100.0 - idl).clamp(0.0, 100.0);
            let cores = curr_core_cpus
                .iter()
                .enumerate()
                .map(|(i, curr)| {
                    if let Some(prev_core) = prev.core_cpus.get(i) {
                        calculate_cpu_percent(prev_core, curr)
                    } else {
                        0.0
                    }
                })
                .collect();
            (ovr, u, s, idl, io, cores)
        } else {
            (0.0, 0.0, 0.0, 100.0, 0.0, vec![0.0; curr_core_cpus.len()])
        }
    } else {
        (0.0, 0.0, 0.0, 100.0, 0.0, vec![0.0; curr_core_cpus.len()])
    };

    // Parse CPUINFO
    let mut model_name = "Generic Processor".to_string();
    if let Some(lines) = sections.get("CPUINFO") {
        for line in lines {
            if line.starts_with("model name") {
                if let Some(idx) = line.find(':') {
                    let name = line[idx + 1..].trim();
                    if !name.is_empty() {
                        model_name = name.to_string();
                        break;
                    }
                }
            }
        }
    }

    // Parse MEM
    let mut mem_map: HashMap<&str, u64> = HashMap::new();
    if let Some(lines) = sections.get("MEM") {
        for line in lines {
            let parts: Vec<&str> = line.split(':').collect();
            if parts.len() == 2 {
                let key = parts[0].trim();
                let val_str = parts[1].trim().split_whitespace().next().unwrap_or("0");
                if let Ok(val) = val_str.parse::<u64>() {
                    mem_map.insert(key, val * 1024); // convert kB to bytes
                }
            }
        }
    }

    let mem_total = *mem_map.get("MemTotal").unwrap_or(&0);
    let mem_free = *mem_map.get("MemFree").unwrap_or(&0);
    let mem_available = *mem_map.get("MemAvailable").unwrap_or(&mem_free);
    let mem_cached = *mem_map.get("Cached").unwrap_or(&0) + *mem_map.get("Buffers").unwrap_or(&0);
    let mem_used = mem_total.saturating_sub(mem_available);

    let swap_total = *mem_map.get("SwapTotal").unwrap_or(&0);
    let swap_free = *mem_map.get("SwapFree").unwrap_or(&0);
    let swap_used = swap_total.saturating_sub(swap_free);

    // Parse NET
    let mut total_rx: u64 = 0;
    let mut total_tx: u64 = 0;
    let mut main_iface = "eth0".to_string();
    let mut max_traffic = 0u64;
    let mut iface_metrics: Vec<NetworkInterfaceMetrics> = Vec::new();
    let mut current_iface_map: HashMap<String, (u64, u64)> = HashMap::new();

    if let Some(lines) = sections.get("NET") {
        for line in lines {
            if let Some(colon_idx) = line.find(':') {
                let iface_name = line[..colon_idx].trim().to_string();
                if iface_name.starts_with("lo") {
                    continue;
                }
                let cols: Vec<u64> = line[colon_idx + 1..]
                    .split_whitespace()
                    .filter_map(|s| s.parse::<u64>().ok())
                    .collect();
                if cols.len() >= 9 {
                    let rx = cols[0];
                    let tx = cols[8];
                    total_rx += rx;
                    total_tx += tx;
                    current_iface_map.insert(iface_name.clone(), (rx, tx));

                    let (iface_rx_spd, iface_tx_spd) = if let Some(ref prev) = prev_sample {
                        let delta_secs = now.duration_since(prev.timestamp).as_secs_f64().max(0.1);
                        if let Some(&(p_rx, p_tx)) = prev.iface_bytes.get(&iface_name) {
                            let r_d = rx.saturating_sub(p_rx);
                            let t_d = tx.saturating_sub(p_tx);
                            (r_d as f64 / delta_secs, t_d as f64 / delta_secs)
                        } else {
                            (0.0, 0.0)
                        }
                    } else {
                        (0.0, 0.0)
                    };

                    if rx + tx > max_traffic {
                        max_traffic = rx + tx;
                        main_iface = iface_name.clone();
                    }

                    iface_metrics.push(NetworkInterfaceMetrics {
                        name: iface_name,
                        rx_bytes_sec: (iface_rx_spd * 10.0).round() / 10.0,
                        tx_bytes_sec: (iface_tx_spd * 10.0).round() / 10.0,
                        total_rx_bytes: rx,
                        total_tx_bytes: tx,
                    });
                }
            }
        }
    }

    let (rx_speed, tx_speed) = if let Some(ref prev) = prev_sample {
        let delta_secs = now.duration_since(prev.timestamp).as_secs_f64().max(0.1);
        let rx_diff = total_rx.saturating_sub(prev.rx_bytes);
        let tx_diff = total_tx.saturating_sub(prev.tx_bytes);
        (rx_diff as f64 / delta_secs, tx_diff as f64 / delta_secs)
    } else {
        (0.0, 0.0)
    };

    // Parse DISKSTATS
    let mut total_disk_read_bytes = 0u64;
    let mut total_disk_write_bytes = 0u64;
    if let Some(lines) = sections.get("DISKSTATS") {
        for line in lines {
            let cols: Vec<&str> = line.split_whitespace().collect();
            if cols.len() >= 10 {
                let dev = cols[2];
                let is_primary = (dev.starts_with("sd") || dev.starts_with("vd") || dev.starts_with("xvd"))
                    && dev.chars().nth(2).map(|c| c.is_alphabetic()).unwrap_or(false)
                    && dev.len() == 3
                    || dev.starts_with("nvme") && !dev.contains('p');
                if is_primary || lines.len() <= 2 {
                    let read_sectors: u64 = cols[5].parse().unwrap_or(0);
                    let write_sectors: u64 = cols[9].parse().unwrap_or(0);
                    total_disk_read_bytes += read_sectors * 512;
                    total_disk_write_bytes += write_sectors * 512;
                }
            }
        }
    }

    let (disk_read_speed, disk_write_speed) = if let Some(ref prev) = prev_sample {
        let delta_secs = now.duration_since(prev.timestamp).as_secs_f64().max(0.1);
        let r_diff = total_disk_read_bytes.saturating_sub(prev.disk_read_bytes);
        let w_diff = total_disk_write_bytes.saturating_sub(prev.disk_write_bytes);
        (r_diff as f64 / delta_secs, w_diff as f64 / delta_secs)
    } else {
        (0.0, 0.0)
    };

    // Parse DF (Disks and Partitions)
    let mut devices: Vec<DiskDevice> = Vec::new();
    let mut primary_total = 0u64;
    let mut primary_used = 0u64;
    let mut primary_free = 0u64;
    let mut primary_pct: f32 = 0.0;
    let mut primary_mount = "/".to_string();

    if let Some(lines) = sections.get("DF") {
        for line in lines {
            let cols: Vec<&str> = line.split_whitespace().collect();
            if cols.len() >= 6 {
                let dev = cols[0].to_string();
                let total = cols[1].parse::<u64>().unwrap_or(0);
                let used = cols[2].parse::<u64>().unwrap_or(0);
                let free = cols[3].parse::<u64>().unwrap_or(0);
                let pct = if total > 0 { ((used as f64 / total as f64) * 100.0) as f32 } else { 0.0 };
                let mount = cols[5].to_string();

                let device = DiskDevice {
                    device: dev,
                    mount_point: mount.clone(),
                    total_bytes: total,
                    used_bytes: used,
                    free_bytes: free,
                    used_percent: (pct * 10.0).round() / 10.0,
                };

                if mount == "/" || devices.is_empty() {
                    primary_total = total;
                    primary_used = used;
                    primary_free = free;
                    primary_pct = pct;
                    primary_mount = mount;
                }

                devices.push(device);
            }
        }
    }

    // Parse UPTIME & LOAD
    let mut uptime_secs = 0;
    let mut load_avg = [0.0f32; 3];

    if let Some(lines) = sections.get("UPTIME") {
        for line in lines {
            if let Some(first_num) = line.split_whitespace().next() {
                if let Ok(secs) = first_num.parse::<f64>() {
                    uptime_secs = secs as u64;
                }
            }
            if line.contains("load average:") || line.contains("load averages:") {
                let parts: Vec<&str> = line.split("load average:").collect();
                if parts.len() == 2 {
                    let loads: Vec<f32> = parts[1]
                        .split(',')
                        .filter_map(|s| s.trim().parse::<f32>().ok())
                        .collect();
                    if loads.len() >= 3 {
                        load_avg = [loads[0], loads[1], loads[2]];
                    }
                }
            }
        }
    }

    // Parse HOST
    let mut hostname = "VPS".to_string();
    let mut kernel = "Linux".to_string();
    let mut os_name = "Linux".to_string();

    if let Some(lines) = sections.get("HOST") {
        for line in lines {
            if line.starts_with("PRETTY_NAME=") {
                os_name = line
                    .trim_start_matches("PRETTY_NAME=")
                    .trim_matches('"')
                    .to_string();
            } else if !line.is_empty() && !line.contains('=') {
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 4 {
                    kernel = format!("{} {} {}", parts[0], parts[1], parts[2]);
                    hostname = parts[3].to_string();
                } else if !parts.is_empty() {
                    kernel = line.to_string();
                }
            }
        }
    }

    // Parse PUBLIC_IP
    let mut public_ip: Option<String> = None;
    if let Some(lines) = sections.get("PUBLIC_IP") {
        for line in lines {
            let trimmed = line.trim();
            if !trimmed.is_empty() && trimmed.chars().all(|c| c.is_ascii_digit() || c == '.' || c == ':') {
                public_ip = Some(trimmed.to_string());
                break;
            }
        }
    }

    let next_sample = PrevSample {
        timestamp: now,
        overall_breakdown: curr_breakdown,
        core_cpus: curr_core_cpus,
        rx_bytes: total_rx,
        tx_bytes: total_tx,
        iface_bytes: current_iface_map,
        disk_read_bytes: total_disk_read_bytes,
        disk_write_bytes: total_disk_write_bytes,
    };

    let metrics = ServerMetrics {
        cpu: CpuMetrics {
            overall: (overall_cpu_pct * 10.0).round() / 10.0,
            cores: core_cpu_pcts.into_iter().map(|c| (c * 10.0).round() / 10.0).collect(),
            model_name,
            user_percent: (user_pct * 10.0).round() / 10.0,
            system_percent: (sys_pct * 10.0).round() / 10.0,
            idle_percent: (idle_pct * 10.0).round() / 10.0,
            iowait_percent: (io_pct * 10.0).round() / 10.0,
        },
        memory: MemoryMetrics {
            total_bytes: mem_total,
            used_bytes: mem_used,
            free_bytes: mem_free,
            available_bytes: mem_available,
            cached_bytes: mem_cached,
            swap_total_bytes: swap_total,
            swap_used_bytes: swap_used,
            swap_free_bytes: swap_free,
        },
        disk: DiskMetrics {
            total_bytes: primary_total,
            used_bytes: primary_used,
            free_bytes: primary_free,
            used_percent: (primary_pct * 10.0).round() / 10.0,
            mount_point: primary_mount,
            read_bytes_sec: (disk_read_speed * 10.0).round() / 10.0,
            write_bytes_sec: (disk_write_speed * 10.0).round() / 10.0,
            devices,
        },
        network: NetworkMetrics {
            rx_bytes_sec: (rx_speed * 10.0).round() / 10.0,
            tx_bytes_sec: (tx_speed * 10.0).round() / 10.0,
            total_rx_bytes: total_rx,
            total_tx_bytes: total_tx,
            interface: main_iface,
            interfaces: iface_metrics,
        },
        host: HostMetrics {
            hostname,
            os_name,
            kernel,
            uptime_seconds: uptime_secs,
            load_avg,
            public_ip,
        },
        timestamp,
    };

    (metrics, next_sample)
}

#[tauri::command]
pub async fn monitor_fetch_metrics(
    vault: State<'_, VaultState>,
    monitor_state: State<'_, MonitorState>,
    profile_id: i64,
) -> Result<ServerMetrics, String> {
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

    let probe_res = tokio::time::timeout(std::time::Duration::from_secs(6), execute_probe(&handle)).await;
    let _ = handle.disconnect(russh::Disconnect::ByApplication, "", "English").await;

    let raw = match probe_res {
        Ok(Ok(raw)) => raw,
        Ok(Err(e)) => return Err(e),
        Err(_) => return Err("Metrics probe timed out".to_string()),
    };

    let prev = {
        let samples = monitor_state.prev_samples.lock().await;
        samples.get(&profile_id).cloned()
    };

    let (metrics, next_sample) = parse_metrics(&raw, prev);
    {
        let mut samples = monitor_state.prev_samples.lock().await;
        samples.insert(profile_id, next_sample);
    }

    Ok(metrics)
}
