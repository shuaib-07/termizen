use std::collections::HashMap;
use aes_gcm::aead::rand_core::RngCore;
use aes_gcm::aead::{Aead, AeadCore, KeyInit, OsRng};
use aes_gcm::{Aes256Gcm, Nonce};
use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::vault::{decrypt, encrypt, VaultState};

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct BackupManifest {
    pub format: String, // "termizen-backup-v1"
    pub app_version: String,
    pub exported_at: String,
    pub categories: Vec<String>,
    pub data: BackupData,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct BackupData {
    pub profiles: Vec<BackupProfile>,
    pub keys: Vec<BackupKey>,
    pub profile_services: Vec<BackupProfileService>,
    pub macros: Vec<BackupMacro>,
    pub macro_groups: Vec<BackupMacroGroup>,
    pub workspaces: Vec<BackupWorkspace>,
    pub folder_metadata: Option<serde_json::Value>,
    pub settings: Option<serde_json::Value>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct BackupProfile {
    pub name: String,
    pub folder: Option<String>,
    pub kind: String,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub auth_method: String,
    pub shell: Option<String>,
    pub pinned: bool,
    pub key_name: Option<String>,
    pub bg_monitoring: bool,
    pub web_log_path: Option<String>,
    pub password: Option<String>,
    pub key_path: Option<String>,
    pub key_data: Option<String>,
    pub passphrase: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct BackupKey {
    pub name: String,
    pub key_data: String,
    pub passphrase: Option<String>,
    pub comment: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct BackupProfileService {
    pub profile_name: String,
    pub name: String,
    pub service_type: String,
    pub target: String,
    pub color: Option<String>,
    pub paused: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct BackupMacro {
    pub name: String,
    pub run_mode: String,
    pub halt_on_error: bool,
    pub steps: Vec<String>,
    pub profile_name: Option<String>,
    pub folder: Option<String>,
    pub shell: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct BackupMacroGroup {
    pub name: String,
    pub folder: Option<String>,
    pub halt_on_error: bool,
    pub macro_names: Vec<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct BackupWorkspace {
    pub name: String,
    pub folder: Option<String>,
    pub layout_mode: String,
    pub terminals: Vec<BackupWorkspaceTerminal>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct BackupWorkspaceTerminal {
    pub position: i64,
    pub title: String,
    pub target_kind: String,
    pub profile_name: Option<String>,
    pub shell: Option<String>,
    pub cwd: Option<String>,
    pub startup_command: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct BackupSummary {
    pub format: String,
    pub app_version: String,
    pub exported_at: String,
    pub categories: Vec<String>,
    pub server_count: usize,
    pub key_count: usize,
    pub macro_count: usize,
    pub macro_group_count: usize,
    pub workspace_count: usize,
    pub has_settings: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ImportResult {
    pub servers_imported: usize,
    pub keys_imported: usize,
    pub macros_imported: usize,
    pub workspaces_imported: usize,
    pub folder_metadata: Option<serde_json::Value>,
    pub settings: Option<serde_json::Value>,
}

fn derive_backup_key(password: &str, salt: &[u8; 16]) -> [u8; 32] {
    let mut key = [0u8; 32];
    pbkdf2::pbkdf2_hmac::<sha2::Sha256>(password.as_bytes(), salt, 100_000, &mut key);
    key
}

fn encrypt_payload(data_json: &str, password: &str) -> Result<String, String> {
    let mut salt = [0u8; 16];
    OsRng.fill_bytes(&mut salt);

    let key = derive_backup_key(password, &salt);
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| e.to_string())?;
    let nonce = Aes256Gcm::generate_nonce(&mut OsRng);
    let ciphertext = cipher
        .encrypt(&nonce, data_json.as_bytes())
        .map_err(|e| format!("Encryption error: {}", e))?;

    let mut payload = Vec::with_capacity(16 + 12 + ciphertext.len());
    payload.extend_from_slice(&salt);
    payload.extend_from_slice(nonce.as_slice());
    payload.extend_from_slice(&ciphertext);

    Ok(format!("TZBK1${}", BASE64.encode(payload)))
}

fn decrypt_payload(encrypted_str: &str, password: &str) -> Result<String, String> {
    let trimmed = encrypted_str.trim();
    let b64_str = if let Some(stripped) = trimmed.strip_prefix("TZBK1$") {
        stripped
    } else {
        trimmed
    };

    let raw = BASE64
        .decode(b64_str)
        .map_err(|_| "Invalid backup format: Not a valid Termizen backup file".to_string())?;

    if raw.len() < 16 + 12 + 16 {
        return Err("Corrupted or incomplete backup file".to_string());
    }

    let salt: [u8; 16] = raw[0..16].try_into().unwrap();
    let nonce = Nonce::from_slice(&raw[16..28]);
    let ciphertext = &raw[28..];

    let key = derive_backup_key(password, &salt);
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| e.to_string())?;

    let plaintext = cipher.decrypt(nonce, ciphertext).map_err(|_| {
        "Incorrect backup password or corrupted backup file".to_string()
    })?;

    String::from_utf8(plaintext).map_err(|e| format!("Invalid UTF-8 payload: {}", e))
}

#[tauri::command]
pub fn vault_export_backup(
    vault: State<VaultState>,
    password: String,
    categories: Vec<String>,
    folder_metadata: Option<serde_json::Value>,
    settings: Option<serde_json::Value>,
) -> Result<String, String> {
    if password.trim().is_empty() {
        return Err("A backup password is required to encrypt your data.".into());
    }

    let conn = vault.conn.lock().unwrap();
    let mut data = BackupData::default();

    let inc_servers = categories.contains(&"servers".to_string());
    let inc_keys = categories.contains(&"keys".to_string()) || inc_servers;
    let inc_macros = categories.contains(&"macros".to_string());
    let inc_workspaces = categories.contains(&"workspaces".to_string());
    let inc_settings = categories.contains(&"settings".to_string());

    // 1. Export Keys
    let mut key_id_to_name: HashMap<i64, String> = HashMap::new();
    if inc_keys {
        let mut k_stmt = conn
            .prepare("SELECT id, name, secret_key_data, secret_passphrase, comment FROM keys")
            .map_err(|e| e.to_string())?;
        let rows = k_stmt
            .query_map([], |row| {
                let id: i64 = row.get(0)?;
                let name: String = row.get(1)?;
                let enc_data: Vec<u8> = row.get(2)?;
                let enc_pass: Option<Vec<u8>> = row.get(3)?;
                let comment: Option<String> = row.get(4)?;
                Ok((id, name, enc_data, enc_pass, comment))
            })
            .map_err(|e| e.to_string())?;

        for item in rows {
            let (id, name, enc_data, enc_pass, comment) = item.map_err(|e| e.to_string())?;
            key_id_to_name.insert(id, name.clone());

            let key_data = decrypt(&vault.key, &enc_data).unwrap_or_default();
            let passphrase = enc_pass.and_then(|p| decrypt(&vault.key, &p).ok());

            data.keys.push(BackupKey {
                name,
                key_data,
                passphrase,
                comment,
            });
        }
    }

    // 2. Export Profiles
    let mut profile_id_to_name: HashMap<i64, String> = HashMap::new();
    if inc_servers {
        let mut p_stmt = conn
            .prepare(
                "SELECT id, name, folder, host, port, username, auth_method,
                        secret_password, secret_key_path, secret_passphrase,
                        kind, shell, pinned, key_id, secret_key_data, bg_monitoring, web_log_path
                 FROM profiles",
            )
            .map_err(|e| e.to_string())?;

        let rows = p_stmt
            .query_map([], |row| {
                let id: i64 = row.get(0)?;
                let name: String = row.get(1)?;
                let folder: Option<String> = row.get(2)?;
                let host: String = row.get(3)?;
                let port: u16 = row.get::<_, i64>(4)? as u16;
                let username: String = row.get(5)?;
                let auth_method: String = row.get(6)?;
                let sec_pass: Option<Vec<u8>> = row.get(7)?;
                let sec_kpath: Option<Vec<u8>> = row.get(8)?;
                let sec_kpass: Option<Vec<u8>> = row.get(9)?;
                let kind: String = row.get(10)?;
                let shell: Option<String> = row.get(11)?;
                let pinned: bool = row.get::<_, i64>(12)? != 0;
                let key_id: Option<i64> = row.get(13)?;
                let sec_kdata: Option<Vec<u8>> = row.get(14)?;
                let bg_monitoring: bool = row.get::<_, i64>(15)? != 0;
                let web_log_path: Option<String> = row.get(16)?;
                Ok((
                    id, name, folder, host, port, username, auth_method,
                    sec_pass, sec_kpath, sec_kpass, kind, shell, pinned,
                    key_id, sec_kdata, bg_monitoring, web_log_path,
                ))
            })
            .map_err(|e| e.to_string())?;

        for item in rows {
            let (
                id, name, folder, host, port, username, auth_method,
                sec_pass, sec_kpath, sec_kpass, kind, shell, pinned,
                key_id, sec_kdata, bg_monitoring, web_log_path,
            ) = item.map_err(|e| e.to_string())?;

            profile_id_to_name.insert(id, name.clone());

            let password = sec_pass.and_then(|b| decrypt(&vault.key, &b).ok());
            let key_path = sec_kpath.and_then(|b| decrypt(&vault.key, &b).ok());
            let key_data = sec_kdata.and_then(|b| decrypt(&vault.key, &b).ok());
            let passphrase = sec_kpass.and_then(|b| decrypt(&vault.key, &b).ok());

            let key_name = key_id.and_then(|kid| key_id_to_name.get(&kid).cloned());

            data.profiles.push(BackupProfile {
                name,
                folder,
                kind,
                host,
                port,
                username,
                auth_method,
                shell,
                pinned,
                key_name,
                bg_monitoring,
                web_log_path,
                password,
                key_path,
                key_data,
                passphrase,
            });
        }

        // 2b. Export Profile Services
        let mut s_stmt = conn
            .prepare("SELECT profile_id, name, service_type, target, color, paused FROM profile_services")
            .map_err(|e| e.to_string())?;
        let s_rows = s_stmt
            .query_map([], |row| {
                let pid: i64 = row.get(0)?;
                let name: String = row.get(1)?;
                let service_type: String = row.get(2)?;
                let target: String = row.get(3)?;
                let color: Option<String> = row.get(4)?;
                let paused: bool = row.get::<_, i64>(5)? != 0;
                Ok((pid, name, service_type, target, color, paused))
            })
            .map_err(|e| e.to_string())?;

        for item in s_rows {
            let (pid, name, service_type, target, color, paused) = item.map_err(|e| e.to_string())?;
            if let Some(pname) = profile_id_to_name.get(&pid) {
                data.profile_services.push(BackupProfileService {
                    profile_name: pname.clone(),
                    name,
                    service_type,
                    target,
                    color,
                    paused,
                });
            }
        }
    }

    // 3. Export Macros & Pipelines
    let mut macro_id_to_name: HashMap<i64, String> = HashMap::new();
    if inc_macros {
        let mut m_stmt = conn
            .prepare("SELECT id, name, run_mode, halt_on_error, profile_id, folder, shell FROM macros")
            .map_err(|e| e.to_string())?;

        let m_rows = m_stmt
            .query_map([], |row| {
                let id: i64 = row.get(0)?;
                let name: String = row.get(1)?;
                let run_mode: String = row.get(2)?;
                let halt: bool = row.get::<_, i64>(3)? != 0;
                let pid: Option<i64> = row.get(4)?;
                let folder: Option<String> = row.get(5)?;
                let shell: Option<String> = row.get(6)?;
                Ok((id, name, run_mode, halt, pid, folder, shell))
            })
            .map_err(|e| e.to_string())?;

        for item in m_rows {
            let (id, name, run_mode, halt, pid, folder, shell) = item.map_err(|e| e.to_string())?;
            macro_id_to_name.insert(id, name.clone());

            let mut step_stmt = conn
                .prepare("SELECT command FROM macro_steps WHERE macro_id = ?1 ORDER BY position")
                .map_err(|e| e.to_string())?;
            let steps = step_stmt
                .query_map(params![id], |r| r.get(0))
                .map_err(|e| e.to_string())?
                .collect::<Result<Vec<String>, _>>()
                .map_err(|e| e.to_string())?;

            let profile_name = pid.and_then(|p| profile_id_to_name.get(&p).cloned());

            data.macros.push(BackupMacro {
                name,
                run_mode,
                halt_on_error: halt,
                steps,
                profile_name,
                folder,
                shell,
            });
        }

        // Export Macro Groups
        let mut g_stmt = conn
            .prepare("SELECT id, name, folder, halt_on_error FROM macro_groups")
            .map_err(|e| e.to_string())?;
        let g_rows = g_stmt
            .query_map([], |row| {
                let id: i64 = row.get(0)?;
                let name: String = row.get(1)?;
                let folder: Option<String> = row.get(2)?;
                let halt: bool = row.get::<_, i64>(3)? != 0;
                Ok((id, name, folder, halt))
            })
            .map_err(|e| e.to_string())?;

        for item in g_rows {
            let (gid, name, folder, halt) = item.map_err(|e| e.to_string())?;
            let mut i_stmt = conn
                .prepare("SELECT macro_id FROM macro_group_items WHERE group_id = ?1 ORDER BY position")
                .map_err(|e| e.to_string())?;
            let macro_ids = i_stmt
                .query_map(params![gid], |r| r.get::<_, i64>(0))
                .map_err(|e| e.to_string())?
                .collect::<Result<Vec<i64>, _>>()
                .map_err(|e| e.to_string())?;

            let macro_names = macro_ids
                .into_iter()
                .filter_map(|mid| macro_id_to_name.get(&mid).cloned())
                .collect();

            data.macro_groups.push(BackupMacroGroup {
                name,
                folder,
                halt_on_error: halt,
                macro_names,
            });
        }
    }

    // 4. Export Workspaces
    if inc_workspaces {
        let mut w_stmt = conn
            .prepare("SELECT id, name, folder, layout_mode FROM workspaces")
            .map_err(|e| e.to_string())?;
        let w_rows = w_stmt
            .query_map([], |row| {
                let id: i64 = row.get(0)?;
                let name: String = row.get(1)?;
                let folder: Option<String> = row.get(2)?;
                let layout: String = row.get(3)?;
                Ok((id, name, folder, layout))
            })
            .map_err(|e| e.to_string())?;

        for item in w_rows {
            let (wid, name, folder, layout_mode) = item.map_err(|e| e.to_string())?;
            let mut wt_stmt = conn
                .prepare(
                    "SELECT position, title, target_kind, profile_id, shell, cwd, startup_command
                     FROM workspace_terminals WHERE workspace_id = ?1 ORDER BY position",
                )
                .map_err(|e| e.to_string())?;

            let terminals = wt_stmt
                .query_map(params![wid], |r| {
                    let position: i64 = r.get(0)?;
                    let title: String = r.get(1)?;
                    let target_kind: String = r.get(2)?;
                    let pid: Option<i64> = r.get(3)?;
                    let shell: Option<String> = r.get(4)?;
                    let cwd: Option<String> = r.get(5)?;
                    let startup: Option<String> = r.get(6)?;
                    let profile_name = pid.and_then(|p| profile_id_to_name.get(&p).cloned());

                    Ok(BackupWorkspaceTerminal {
                        position,
                        title,
                        target_kind,
                        profile_name,
                        shell,
                        cwd,
                        startup_command: startup,
                    })
                })
                .map_err(|e| e.to_string())?
                .collect::<Result<Vec<BackupWorkspaceTerminal>, _>>()
                .map_err(|e| e.to_string())?;

            data.workspaces.push(BackupWorkspace {
                name,
                folder,
                layout_mode,
                terminals,
            });
        }
    }

    if inc_settings {
        data.folder_metadata = folder_metadata;
        data.settings = settings;
    }

    let manifest = BackupManifest {
        format: "termizen-backup-v1".to_string(),
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        exported_at: chrono_like_now(),
        categories,
        data,
    };

    let json_str = serde_json::to_string(&manifest)
        .map_err(|e| format!("Failed to serialize backup: {}", e))?;

    encrypt_payload(&json_str, &password)
}

#[tauri::command]
pub fn vault_inspect_backup(
    encrypted_data: String,
    password: String,
) -> Result<BackupSummary, String> {
    let json_str = decrypt_payload(&encrypted_data, &password)?;
    let manifest: BackupManifest = serde_json::from_str(&json_str)
        .map_err(|_| "Invalid backup format: Cannot read backup data manifest".to_string())?;

    Ok(BackupSummary {
        format: manifest.format,
        app_version: manifest.app_version,
        exported_at: manifest.exported_at,
        categories: manifest.categories,
        server_count: manifest.data.profiles.len(),
        key_count: manifest.data.keys.len(),
        macro_count: manifest.data.macros.len(),
        macro_group_count: manifest.data.macro_groups.len(),
        workspace_count: manifest.data.workspaces.len(),
        has_settings: manifest.data.settings.is_some() || manifest.data.folder_metadata.is_some(),
    })
}

#[tauri::command]
pub fn vault_import_backup(
    vault: State<VaultState>,
    encrypted_data: String,
    password: String,
    mode: String, // "merge" or "replace"
) -> Result<ImportResult, String> {
    let json_str = decrypt_payload(&encrypted_data, &password)?;
    let manifest: BackupManifest = serde_json::from_str(&json_str)
        .map_err(|_| "Invalid backup format: Cannot read backup data manifest".to_string())?;

    let is_replace = mode.to_lowercase() == "replace";
    let conn = vault.conn.lock().unwrap();

    if is_replace {
        // Clear all tables
        let _ = conn.execute("DELETE FROM workspace_terminals", []);
        let _ = conn.execute("DELETE FROM workspaces", []);
        let _ = conn.execute("DELETE FROM macro_group_items", []);
        let _ = conn.execute("DELETE FROM macro_groups", []);
        let _ = conn.execute("DELETE FROM macro_steps", []);
        let _ = conn.execute("DELETE FROM macros", []);
        let _ = conn.execute("DELETE FROM profile_services", []);
        let _ = conn.execute("DELETE FROM profiles", []);
        let _ = conn.execute("DELETE FROM keys", []);
    }

    let mut key_name_to_id: HashMap<String, i64> = HashMap::new();
    let mut profile_name_to_id: HashMap<String, i64> = HashMap::new();
    let mut macro_name_to_id: HashMap<String, i64> = HashMap::new();

    // Pre-populate existing keys/profiles if merging
    {
        let mut k_stmt = conn.prepare("SELECT id, name FROM keys").map_err(|e| e.to_string())?;
        let rows = k_stmt.query_map([], |r| Ok((r.get(0)?, r.get(1)?))).unwrap();
        for item in rows.flatten() {
            key_name_to_id.insert(item.1, item.0);
        }

        let mut p_stmt = conn.prepare("SELECT id, name FROM profiles").map_err(|e| e.to_string())?;
        let p_rows = p_stmt.query_map([], |r| Ok((r.get(0)?, r.get(1)?))).unwrap();
        for item in p_rows.flatten() {
            profile_name_to_id.insert(item.1, item.0);
        }

        let mut m_stmt = conn.prepare("SELECT id, name FROM macros").map_err(|e| e.to_string())?;
        let m_rows = m_stmt.query_map([], |r| Ok((r.get(0)?, r.get(1)?))).unwrap();
        for item in m_rows.flatten() {
            macro_name_to_id.insert(item.1, item.0);
        }
    }

    let mut keys_imported = 0;
    let mut servers_imported = 0;
    let mut macros_imported = 0;
    let mut workspaces_imported = 0;

    // 1. Import Keys
    for k in manifest.data.keys {
        let enc_data = encrypt(&vault.key, &k.key_data);
        let enc_pass = k.passphrase.as_deref().map(|p| encrypt(&vault.key, p));

        if let Some(&existing_id) = key_name_to_id.get(&k.name) {
            if is_replace {
                let _ = conn.execute(
                    "UPDATE keys SET secret_key_data = ?1, secret_passphrase = ?2, comment = ?3 WHERE id = ?4",
                    params![enc_data, enc_pass, k.comment, existing_id],
                );
            }
        } else {
            conn.execute(
                "INSERT INTO keys (name, secret_key_data, secret_passphrase, comment) VALUES (?1, ?2, ?3, ?4)",
                params![k.name, enc_data, enc_pass, k.comment],
            )
            .map_err(|e| e.to_string())?;
            let new_id = conn.last_insert_rowid();
            key_name_to_id.insert(k.name, new_id);
            keys_imported += 1;
        }
    }

    // 2. Import Profiles
    for p in manifest.data.profiles {
        let sec_pass = p.password.as_deref().map(|s| encrypt(&vault.key, s));
        let sec_kpath = p.key_path.as_deref().map(|s| encrypt(&vault.key, s));
        let sec_kdata = p.key_data.as_deref().map(|s| encrypt(&vault.key, s));
        let sec_kpass = p.passphrase.as_deref().map(|s| encrypt(&vault.key, s));
        let key_id = p.key_name.and_then(|kn| key_name_to_id.get(&kn).copied());

        if let Some(&existing_id) = profile_name_to_id.get(&p.name) {
            if is_replace {
                let _ = conn.execute(
                    "UPDATE profiles SET folder = ?1, host = ?2, port = ?3, username = ?4, auth_method = ?5,
                            secret_password = ?6, secret_key_path = ?7, secret_passphrase = ?8, kind = ?9,
                            shell = ?10, pinned = ?11, key_id = ?12, secret_key_data = ?13, bg_monitoring = ?14,
                            web_log_path = ?15
                     WHERE id = ?16",
                    params![
                        p.folder, p.host, p.port as i64, p.username, p.auth_method,
                        sec_pass, sec_kpath, sec_kpass, p.kind, p.shell,
                        if p.pinned { 1 } else { 0 }, key_id, sec_kdata,
                        if p.bg_monitoring { 1 } else { 0 }, p.web_log_path, existing_id
                    ],
                );
            }
        } else {
            conn.execute(
                "INSERT INTO profiles (
                    name, folder, host, port, username, auth_method,
                    secret_password, secret_key_path, secret_passphrase,
                    kind, shell, pinned, key_id, secret_key_data, bg_monitoring, web_log_path
                 ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)",
                params![
                    p.name, p.folder, p.host, p.port as i64, p.username, p.auth_method,
                    sec_pass, sec_kpath, sec_kpass, p.kind, p.shell,
                    if p.pinned { 1 } else { 0 }, key_id, sec_kdata,
                    if p.bg_monitoring { 1 } else { 0 }, p.web_log_path
                ],
            )
            .map_err(|e| e.to_string())?;
            let new_id = conn.last_insert_rowid();
            profile_name_to_id.insert(p.name, new_id);
            servers_imported += 1;
        }
    }

    // 2b. Import Profile Services
    for s in manifest.data.profile_services {
        if let Some(&pid) = profile_name_to_id.get(&s.profile_name) {
            let _ = conn.execute(
                "INSERT INTO profile_services (profile_id, name, service_type, target, color, paused)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![pid, s.name, s.service_type, s.target, s.color, if s.paused { 1 } else { 0 }],
            );
        }
    }

    // 3. Import Macros
    for m in manifest.data.macros {
        let assigned_pid = m.profile_name.and_then(|pn| profile_name_to_id.get(&pn).copied());

        if let Some(&existing_id) = macro_name_to_id.get(&m.name) {
            if is_replace {
                let _ = conn.execute(
                    "UPDATE macros SET run_mode = ?1, halt_on_error = ?2, profile_id = ?3, folder = ?4, shell = ?5 WHERE id = ?6",
                    params![m.run_mode, if m.halt_on_error { 1 } else { 0 }, assigned_pid, m.folder, m.shell, existing_id],
                );
                let _ = conn.execute("DELETE FROM macro_steps WHERE macro_id = ?1", params![existing_id]);
                for (pos, step) in m.steps.iter().enumerate() {
                    let _ = conn.execute(
                        "INSERT INTO macro_steps (macro_id, position, command) VALUES (?1, ?2, ?3)",
                        params![existing_id, pos as i64, step],
                    );
                }
            }
        } else {
            conn.execute(
                "INSERT INTO macros (name, run_mode, halt_on_error, profile_id, folder, shell)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![m.name, m.run_mode, if m.halt_on_error { 1 } else { 0 }, assigned_pid, m.folder, m.shell],
            )
            .map_err(|e| e.to_string())?;

            let new_mid = conn.last_insert_rowid();
            macro_name_to_id.insert(m.name, new_mid);

            for (pos, step) in m.steps.iter().enumerate() {
                conn.execute(
                    "INSERT INTO macro_steps (macro_id, position, command) VALUES (?1, ?2, ?3)",
                    params![new_mid, pos as i64, step],
                )
                .map_err(|e| e.to_string())?;
            }
            macros_imported += 1;
        }
    }

    // 3b. Import Macro Groups
    for g in manifest.data.macro_groups {
        conn.execute(
            "INSERT INTO macro_groups (name, folder, halt_on_error) VALUES (?1, ?2, ?3)",
            params![g.name, g.folder, if g.halt_on_error { 1 } else { 0 }],
        )
        .map_err(|e| e.to_string())?;

        let gid = conn.last_insert_rowid();
        for (pos, mn) in g.macro_names.iter().enumerate() {
            if let Some(&mid) = macro_name_to_id.get(mn) {
                let _ = conn.execute(
                    "INSERT INTO macro_group_items (group_id, macro_id, position) VALUES (?1, ?2, ?3)",
                    params![gid, mid, pos as i64],
                );
            }
        }
    }

    // 4. Import Workspaces
    for w in manifest.data.workspaces {
        conn.execute(
            "INSERT INTO workspaces (name, folder, layout_mode) VALUES (?1, ?2, ?3)",
            params![w.name, w.folder, w.layout_mode],
        )
        .map_err(|e| e.to_string())?;

        let wid = conn.last_insert_rowid();
        for t in w.terminals {
            let pid = t.profile_name.and_then(|pn| profile_name_to_id.get(&pn).copied());
            let _ = conn.execute(
                "INSERT INTO workspace_terminals (workspace_id, position, title, target_kind, profile_id, shell, cwd, startup_command)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                params![wid, t.position, t.title, t.target_kind, pid, t.shell, t.cwd, t.startup_command],
            );
        }
        workspaces_imported += 1;
    }

    Ok(ImportResult {
        servers_imported,
        keys_imported,
        macros_imported,
        workspaces_imported,
        folder_metadata: manifest.data.folder_metadata,
        settings: manifest.data.settings,
    })
}

fn chrono_like_now() -> String {
    // Generate ISO 8601 UTC timestamp using std::time
    let now = std::time::SystemTime::now();
    let duration = now.duration_since(std::time::UNIX_EPOCH).unwrap_or_default();
    let secs = duration.as_secs();

    // Rough UTC representation without external heavy chrono dependency
    let days = secs / 86400;
    let rem_secs = secs % 86400;
    let hours = rem_secs / 3600;
    let mins = (rem_secs % 3600) / 60;
    let s = rem_secs % 60;

    // Approximate year/month from days (1970 Epoch)
    let mut y = 1970;
    let mut d = days;
    loop {
        let leap = (y % 4 == 0 && y % 100 != 0) || (y % 400 == 0);
        let days_in_year = if leap { 366 } else { 365 };
        if d < days_in_year {
            break;
        }
        d -= days_in_year;
        y += 1;
    }
    let leap = (y % 4 == 0 && y % 100 != 0) || (y % 400 == 0);
    let month_days = [31, if leap { 29 } else { 28 }, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let mut m = 1;
    for &md in &month_days {
        if d < md {
            break;
        }
        d -= md;
        m += 1;
    }
    let day = d + 1;

    format!("{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z", y, m, day, hours, mins, s)
}

