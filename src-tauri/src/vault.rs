use std::sync::Mutex;

use aes_gcm::aead::{Aead, AeadCore, KeyInit, OsRng};
use aes_gcm::{Aes256Gcm, Nonce};
use rusqlite::{params, Connection};
use serde::Serialize;
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Manager, State};
use winreg::enums::HKEY_LOCAL_MACHINE;
use winreg::RegKey;

use crate::ssh::{self, SshState};

pub struct VaultState {
    conn: Mutex<Connection>,
    key: [u8; 32],
}

impl VaultState {
    pub fn init(app: &AppHandle) -> rusqlite::Result<Self> {
        let mut dir = app.path().app_data_dir().expect("app data dir resolvable");
        std::fs::create_dir_all(&dir).expect("create app data dir");
        dir.push("vault.db");

        let conn = Connection::open(dir)?;
        conn.execute(
            "CREATE TABLE IF NOT EXISTS profiles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                folder TEXT,
                host TEXT NOT NULL,
                port INTEGER NOT NULL,
                username TEXT NOT NULL,
                auth_method TEXT NOT NULL,
                secret_password BLOB,
                secret_key_path BLOB,
                secret_passphrase BLOB,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            )",
            [],
        )?;
        conn.execute(
            "CREATE TABLE IF NOT EXISTS keys (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                secret_key_data BLOB NOT NULL,
                secret_passphrase BLOB,
                comment TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            )",
            [],
        )?;

        // Migration: local-shell profiles added after the table already
        // existed for some users. ADD COLUMN errors if it's already there --
        // that's expected on every run after the first, so it's ignored.
        let _ = conn.execute("ALTER TABLE profiles ADD COLUMN kind TEXT NOT NULL DEFAULT 'ssh'", []);
        let _ = conn.execute("ALTER TABLE profiles ADD COLUMN shell TEXT", []);
        let _ = conn.execute("ALTER TABLE profiles ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0", []);
        let _ = conn.execute("ALTER TABLE profiles ADD COLUMN key_id INTEGER REFERENCES keys(id) ON DELETE SET NULL", []);
        let _ = conn.execute("ALTER TABLE profiles ADD COLUMN secret_key_data BLOB", []);
        let _ = conn.execute("ALTER TABLE profiles ADD COLUMN bg_monitoring INTEGER NOT NULL DEFAULT 0", []);
        let _ = conn.execute("ALTER TABLE profiles ADD COLUMN web_log_path TEXT", []);

        conn.execute(
            "CREATE TABLE IF NOT EXISTS profile_services (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
                name TEXT NOT NULL,
                service_type TEXT NOT NULL,
                target TEXT NOT NULL,
                color TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            )",
            [],
        )?;
        let _ = conn.execute("ALTER TABLE profile_services ADD COLUMN paused INTEGER NOT NULL DEFAULT 0", []);

        conn.execute(
            "CREATE TABLE IF NOT EXISTS macros (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                run_mode TEXT NOT NULL CHECK (run_mode IN ('exec', 'pty')),
                halt_on_error INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            )",
            [],
        )?;
        conn.execute(
            "CREATE TABLE IF NOT EXISTS macro_steps (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                macro_id INTEGER NOT NULL REFERENCES macros(id) ON DELETE CASCADE,
                position INTEGER NOT NULL,
                command TEXT NOT NULL
            )",
            [],
        )?;
        // Migration: optional macro->profile assignment added after macros
        // already existed for some users. NULL means "global" (usable
        // against/within any profile), matching the pre-migration behavior.
        let _ = conn.execute("ALTER TABLE macros ADD COLUMN profile_id INTEGER REFERENCES profiles(id) ON DELETE SET NULL", []);
        // Migration: macro folder grouping, same flat-tag model profiles
        // already use (shares the namespace -- a folder groups whichever
        // profiles/macros are tagged with that string, no separate tree).
        let _ = conn.execute("ALTER TABLE macros ADD COLUMN folder TEXT", []);
        // Migration: default shell for local execution (powershell vs cmd)
        let _ = conn.execute("ALTER TABLE macros ADD COLUMN shell TEXT", []);

        conn.execute("PRAGMA foreign_keys = ON", [])?;

        Ok(Self { conn: Mutex::new(conn), key: machine_key() })
    }
}

// ponytail: no Master PIN layer -- plan.md calls it optional and off by
// default, so this machine+user-bound key is the only KDF source for v1.
// Add Argon2id-over-PIN as a second layer if/when that setting ships.
fn machine_key() -> [u8; 32] {
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    let guid: String = hklm
        .open_subkey("SOFTWARE\\Microsoft\\Cryptography")
        .and_then(|k| k.get_value("MachineGuid"))
        .unwrap_or_else(|_| "termizen-fallback-guid".to_string());
    let user = std::env::var("USERNAME").unwrap_or_default();

    let mut hasher = Sha256::new();
    hasher.update(guid.as_bytes());
    hasher.update(b"|");
    hasher.update(user.as_bytes());
    hasher.update(b"|termizen-vault-v1");
    hasher.finalize().into()
}

fn encrypt(key: &[u8; 32], plaintext: &str) -> Vec<u8> {
    let cipher = Aes256Gcm::new_from_slice(key).expect("32-byte key");
    let nonce = Aes256Gcm::generate_nonce(&mut OsRng);
    let ciphertext = cipher.encrypt(&nonce, plaintext.as_bytes()).expect("encryption failure");
    let mut out = nonce.to_vec();
    out.extend(ciphertext);
    out
}

fn decrypt(key: &[u8; 32], blob: &[u8]) -> Result<String, String> {
    if blob.len() < 12 {
        return Err("corrupt vault entry".into());
    }
    let (nonce_bytes, ciphertext) = blob.split_at(12);
    let cipher = Aes256Gcm::new_from_slice(key).map_err(|e| e.to_string())?;
    let plaintext = cipher
        .decrypt(Nonce::from_slice(nonce_bytes), ciphertext)
        .map_err(|_| "vault decryption failed".to_string())?;
    String::from_utf8(plaintext).map_err(|e| e.to_string())
}

#[derive(Serialize, serde::Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct KeySummary {
    pub id: i64,
    pub name: String,
    pub comment: Option<String>,
    pub created_at: String,
}

#[derive(Serialize, serde::Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProfileSummary {
    pub id: i64,
    pub name: String,
    pub folder: Option<String>,
    pub kind: String,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub auth_method: String,
    pub shell: Option<String>,
    pub pinned: bool,
    pub key_id: Option<i64>,
    pub bg_monitoring: bool,
    pub web_log_path: Option<String>,
}

#[derive(Serialize, serde::Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProfileService {
    pub id: i64,
    pub profile_id: i64,
    pub name: String,
    pub service_type: String,
    pub target: String,
    pub color: Option<String>,
    pub paused: bool,
}

#[tauri::command]
pub fn key_save(
    vault: State<VaultState>,
    name: String,
    key_data: String,
    passphrase: Option<String>,
    comment: Option<String>,
) -> Result<i64, String> {
    let enc_key_data = encrypt(&vault.key, &key_data);
    let enc_passphrase = passphrase.map(|p| encrypt(&vault.key, &p));
    let conn = vault.conn.lock().unwrap();
    conn.execute(
        "INSERT INTO keys (name, secret_key_data, secret_passphrase, comment) VALUES (?1, ?2, ?3, ?4)",
        params![name, enc_key_data, enc_passphrase, comment],
    )
    .map_err(|e| e.to_string())?;
    Ok(conn.last_insert_rowid())
}

#[tauri::command]
pub fn key_list(vault: State<VaultState>) -> Result<Vec<KeySummary>, String> {
    let conn = vault.conn.lock().unwrap();
    let mut stmt = conn
        .prepare("SELECT id, name, comment, created_at FROM keys ORDER BY name")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(KeySummary {
                id: row.get(0)?,
                name: row.get(1)?,
                comment: row.get(2)?,
                created_at: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn key_delete(vault: State<VaultState>, id: i64) -> Result<(), String> {
    vault
        .conn
        .lock()
        .unwrap()
        .execute("DELETE FROM keys WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub fn profile_save(
    vault: State<VaultState>,
    name: String,
    folder: Option<String>,
    kind: String,
    host: Option<String>,
    port: Option<u16>,
    username: Option<String>,
    auth_method: Option<String>,
    password: Option<String>,
    key_path: Option<String>,
    key_data: Option<String>,
    key_id: Option<i64>,
    passphrase: Option<String>,
    shell: Option<String>,
) -> Result<i64, String> {
    let enc_password = password.map(|p| encrypt(&vault.key, &p));
    let enc_key_path = key_path.map(|p| encrypt(&vault.key, &p));
    let enc_key_data = key_data.map(|p| encrypt(&vault.key, &p));
    let enc_passphrase = passphrase.map(|p| encrypt(&vault.key, &p));

    // Local-shell profiles have no host/port/username/auth -- the columns
    // stay NOT NULL (added back when ssh profiles already existed, so
    // widening them would mean a full table rebuild) and get placeholders.
    let host = host.unwrap_or_default();
    let port = port.unwrap_or(0);
    let username = username.unwrap_or_default();
    let auth_method = auth_method.unwrap_or_else(|| "none".to_string());

    let conn = vault.conn.lock().unwrap();
    conn.execute(
        "INSERT INTO profiles (name, folder, kind, host, port, username, auth_method, secret_password, secret_key_path, secret_passphrase, shell, pinned, key_id, secret_key_data)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, 0, ?12, ?13)",
        params![name, folder, kind, host, port, username, auth_method, enc_password, enc_key_path, enc_passphrase, shell, key_id, enc_key_data],
    )
    .map_err(|e| e.to_string())?;
    Ok(conn.last_insert_rowid())
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub fn profile_update(
    vault: State<VaultState>,
    id: i64,
    name: String,
    folder: Option<String>,
    kind: String,
    host: Option<String>,
    port: Option<u16>,
    username: Option<String>,
    auth_method: Option<String>,
    password: Option<String>,
    key_path: Option<String>,
    key_data: Option<String>,
    key_id: Option<i64>,
    passphrase: Option<String>,
    shell: Option<String>,
) -> Result<(), String> {
    let host = host.unwrap_or_default();
    let port = port.unwrap_or(0);
    let username = username.unwrap_or_default();
    let auth_method = auth_method.unwrap_or_else(|| "none".to_string());

    let conn = vault.conn.lock().unwrap();

    if let Some(pwd) = password {
        if !pwd.is_empty() {
            let enc = encrypt(&vault.key, &pwd);
            let _ = conn.execute("UPDATE profiles SET secret_password = ?1 WHERE id = ?2", params![enc, id]);
        }
    }
    if let Some(kd) = key_data {
        if !kd.is_empty() {
            let enc = encrypt(&vault.key, &kd);
            let _ = conn.execute("UPDATE profiles SET secret_key_data = ?1 WHERE id = ?2", params![enc, id]);
        }
    }
    if let Some(kp) = key_path {
        if !kp.is_empty() {
            let enc = encrypt(&vault.key, &kp);
            let _ = conn.execute("UPDATE profiles SET secret_key_path = ?1 WHERE id = ?2", params![enc, id]);
        }
    }
    if let Some(pp) = passphrase {
        if !pp.is_empty() {
            let enc = encrypt(&vault.key, &pp);
            let _ = conn.execute("UPDATE profiles SET secret_passphrase = ?1 WHERE id = ?2", params![enc, id]);
        }
    }

    conn.execute(
        "UPDATE profiles SET name = ?1, folder = ?2, kind = ?3, host = ?4, port = ?5, username = ?6, auth_method = ?7, shell = ?8, key_id = ?9 WHERE id = ?10",
        params![name, folder, kind, host, port, username, auth_method, shell, key_id, id],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn profile_list(vault: State<VaultState>) -> Result<Vec<ProfileSummary>, String> {
    let conn = vault.conn.lock().unwrap();
    let mut stmt = conn
        .prepare("SELECT id, name, folder, kind, host, port, username, auth_method, shell, COALESCE(pinned, 0), key_id, COALESCE(bg_monitoring, 0), web_log_path FROM profiles ORDER BY folder, name")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(ProfileSummary {
                id: row.get(0)?,
                name: row.get(1)?,
                folder: row.get(2)?,
                kind: row.get(3)?,
                host: row.get(4)?,
                port: row.get::<_, i64>(5)? as u16,
                username: row.get(6)?,
                auth_method: row.get(7)?,
                shell: row.get(8)?,
                pinned: row.get::<_, i64>(9)? != 0,
                key_id: row.get(10)?,
                bg_monitoring: row.get::<_, i64>(11)? != 0,
                web_log_path: row.get(12)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

pub fn get_profile_web_log_path(vault: &State<VaultState>, id: i64) -> Result<Option<String>, String> {
    let conn = vault.conn.lock().unwrap();
    let mut stmt = conn
        .prepare("SELECT web_log_path FROM profiles WHERE id = ?1")
        .map_err(|e| e.to_string())?;
    let path: Option<String> = stmt
        .query_row(params![id], |row| row.get(0))
        .unwrap_or(None);
    Ok(path)
}

#[tauri::command]
pub fn profile_set_web_log_path(vault: State<VaultState>, id: i64, path: Option<String>) -> Result<(), String> {
    let conn = vault.conn.lock().unwrap();
    conn.execute("UPDATE profiles SET web_log_path = ?1 WHERE id = ?2", params![path, id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn profile_set_bg_monitoring(vault: State<VaultState>, id: i64, enabled: bool) -> Result<(), String> {
    let conn = vault.conn.lock().unwrap();
    conn.execute("UPDATE profiles SET bg_monitoring = ?1 WHERE id = ?2", params![if enabled { 1 } else { 0 }, id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn profile_set_pinned(vault: State<VaultState>, id: i64, pinned: bool) -> Result<(), String> {
    let conn = vault.conn.lock().unwrap();
    conn.execute("UPDATE profiles SET pinned = ?1 WHERE id = ?2", params![if pinned { 1 } else { 0 }, id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn profile_delete(vault: State<VaultState>, id: i64) -> Result<(), String> {
    vault.conn.lock().unwrap().execute("DELETE FROM profiles WHERE id = ?1", params![id]).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn profile_service_save(
    vault: State<VaultState>,
    profile_id: i64,
    name: String,
    service_type: String,
    target: String,
    color: Option<String>,
) -> Result<i64, String> {
    let conn = vault.conn.lock().unwrap();
    conn.execute(
        "INSERT INTO profile_services (profile_id, name, service_type, target, color) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![profile_id, name, service_type, target, color],
    )
    .map_err(|e| e.to_string())?;
    Ok(conn.last_insert_rowid())
}

#[tauri::command]
pub fn profile_service_update(
    vault: State<VaultState>,
    id: i64,
    name: String,
    service_type: String,
    target: String,
    color: Option<String>,
) -> Result<(), String> {
    let conn = vault.conn.lock().unwrap();
    conn.execute(
        "UPDATE profile_services SET name = ?1, service_type = ?2, target = ?3, color = ?4 WHERE id = ?5",
        params![name, service_type, target, color, id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn profile_service_delete(vault: State<VaultState>, id: i64) -> Result<(), String> {
    let conn = vault.conn.lock().unwrap();
    conn.execute("DELETE FROM profile_services WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn profile_service_set_paused(vault: State<VaultState>, id: i64, paused: bool) -> Result<(), String> {
    let conn = vault.conn.lock().unwrap();
    conn.execute("UPDATE profile_services SET paused = ?1 WHERE id = ?2", params![if paused { 1 } else { 0 }, id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn profile_service_list(vault: State<VaultState>, profile_id: i64) -> Result<Vec<ProfileService>, String> {
    let conn = vault.conn.lock().unwrap();
    let mut stmt = conn
        .prepare("SELECT id, profile_id, name, service_type, target, color, COALESCE(paused, 0) FROM profile_services WHERE profile_id = ?1 ORDER BY id")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![profile_id], |row| {
            Ok(ProfileService {
                id: row.get(0)?,
                profile_id: row.get(1)?,
                name: row.get(2)?,
                service_type: row.get(3)?,
                target: row.get(4)?,
                color: row.get(5)?,
                paused: row.get::<_, i64>(6)? != 0,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

pub struct SshCredentials {
    pub host: String,
    pub port: u16,
    pub username: String,
    pub auth_method: String,
    pub password: Option<String>,
    pub key_path: Option<String>,
    pub key_data: Option<String>,
    pub passphrase: Option<String>,
}

// Shared by profile_connect (interactive tab) and macro_exec::run (exec-mode
// macros) -- both need a saved SSH profile's decrypted credentials.
pub fn load_ssh_credentials(vault: &VaultState, id: i64) -> Result<SshCredentials, String> {
    let conn = vault.conn.lock().unwrap();
    let (
        host,
        port,
        username,
        auth_method,
        enc_password,
        enc_key_path,
        enc_passphrase,
        key_id,
        enc_key_data,
    ): (
        String,
        u16,
        String,
        String,
        Option<Vec<u8>>,
        Option<Vec<u8>>,
        Option<Vec<u8>>,
        Option<i64>,
        Option<Vec<u8>>,
    ) = conn
        .query_row(
            "SELECT host, port, username, auth_method, secret_password, secret_key_path, secret_passphrase, key_id, secret_key_data
             FROM profiles WHERE id = ?1 AND kind = 'ssh'",
            params![id],
            |row| {
                Ok((
                    row.get(0)?,
                    row.get::<_, i64>(1)? as u16,
                    row.get(2)?,
                    row.get(3)?,
                    row.get(4)?,
                    row.get(5)?,
                    row.get(6)?,
                    row.get(7)?,
                    row.get(8)?,
                ))
            },
        )
        .map_err(|e| e.to_string())?;

    let (key_data, key_passphrase) = if let Some(k_id) = key_id {
        let (k_enc_data, k_enc_pass): (Vec<u8>, Option<Vec<u8>>) = conn
            .query_row(
                "SELECT secret_key_data, secret_passphrase FROM keys WHERE id = ?1",
                params![k_id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .map_err(|e| e.to_string())?;
        (
            Some(decrypt(&vault.key, &k_enc_data)?),
            k_enc_pass.map(|b| decrypt(&vault.key, &b)).transpose()?,
        )
    } else if let Some(ref data_blob) = enc_key_data {
        (
            Some(decrypt(&vault.key, data_blob)?),
            enc_passphrase.map(|b| decrypt(&vault.key, &b)).transpose()?,
        )
    } else {
        (
            None,
            enc_passphrase.map(|b| decrypt(&vault.key, &b)).transpose()?,
        )
    };

    Ok(SshCredentials {
        host,
        port,
        username,
        auth_method,
        password: enc_password.map(|b| decrypt(&vault.key, &b)).transpose()?,
        key_path: enc_key_path.map(|b| decrypt(&vault.key, &b)).transpose()?,
        key_data,
        passphrase: key_passphrase,
    })
}

#[tauri::command]
pub fn profile_get_password(vault: State<VaultState>, id: i64) -> Result<Option<String>, String> {
    let creds = load_ssh_credentials(&vault, id)?;
    Ok(creds.password)
}

#[tauri::command]
pub async fn profile_connect(
    app: AppHandle,
    vault: State<'_, VaultState>,
    ssh_state: State<'_, SshState>,
    id: i64,
    cols: u16,
    rows: u16,
) -> Result<u32, String> {
    let creds = load_ssh_credentials(&vault, id)?;
    ssh::connect_ssh(
        app,
        ssh_state,
        creds.host,
        creds.port,
        creds.username,
        creds.auth_method,
        creds.password,
        creds.key_path,
        creds.key_data,
        creds.passphrase,
        cols,
        rows,
    )
    .await
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MacroSummary {
    id: i64,
    name: String,
    run_mode: String,
    halt_on_error: bool,
    step_count: i64,
    profile_id: Option<i64>,
    folder: Option<String>,
    shell: Option<String>,
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub fn macro_save(
    vault: State<VaultState>,
    name: String,
    run_mode: String,
    halt_on_error: bool,
    steps: Vec<String>,
    profile_id: Option<i64>,
    folder: Option<String>,
    shell: Option<String>,
) -> Result<i64, String> {
    let mut conn = vault.conn.lock().unwrap();
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    tx.execute(
        "INSERT INTO macros (name, run_mode, halt_on_error, profile_id, folder, shell) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![name, run_mode, halt_on_error, profile_id, folder, shell],
    )
    .map_err(|e| e.to_string())?;
    let macro_id = tx.last_insert_rowid();
    for (i, command) in steps.iter().enumerate() {
        tx.execute(
            "INSERT INTO macro_steps (macro_id, position, command) VALUES (?1, ?2, ?3)",
            params![macro_id, i as i64, command],
        )
        .map_err(|e| e.to_string())?;
    }
    tx.commit().map_err(|e| e.to_string())?;
    Ok(macro_id)
}

// Full replace, not a diff -- matches how the editor already treats steps as
// one wholesale textarea, so there's no per-step identity to preserve anyway.
#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub fn macro_update(
    vault: State<VaultState>,
    id: i64,
    name: String,
    run_mode: String,
    halt_on_error: bool,
    steps: Vec<String>,
    profile_id: Option<i64>,
    folder: Option<String>,
    shell: Option<String>,
) -> Result<(), String> {
    let mut conn = vault.conn.lock().unwrap();
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    tx.execute(
        "UPDATE macros SET name = ?1, run_mode = ?2, halt_on_error = ?3, profile_id = ?4, folder = ?5, shell = ?6 WHERE id = ?7",
        params![name, run_mode, halt_on_error, profile_id, folder, shell, id],
    )
    .map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM macro_steps WHERE macro_id = ?1", params![id]).map_err(|e| e.to_string())?;
    for (i, command) in steps.iter().enumerate() {
        tx.execute(
            "INSERT INTO macro_steps (macro_id, position, command) VALUES (?1, ?2, ?3)",
            params![id, i as i64, command],
        )
        .map_err(|e| e.to_string())?;
    }
    tx.commit().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn macro_list(vault: State<VaultState>) -> Result<Vec<MacroSummary>, String> {
    let conn = vault.conn.lock().unwrap();
    let mut stmt = conn
        .prepare(
            "SELECT m.id, m.name, m.run_mode, m.halt_on_error, COUNT(s.id), m.profile_id, m.folder, m.shell
             FROM macros m LEFT JOIN macro_steps s ON s.macro_id = m.id
             GROUP BY m.id ORDER BY m.name",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(MacroSummary {
                id: row.get(0)?,
                name: row.get(1)?,
                run_mode: row.get(2)?,
                halt_on_error: row.get(3)?,
                step_count: row.get(4)?,
                profile_id: row.get(5)?,
                folder: row.get(6)?,
                shell: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn macro_delete(vault: State<VaultState>, id: i64) -> Result<(), String> {
    vault.conn.lock().unwrap().execute("DELETE FROM macros WHERE id = ?1", params![id]).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn load_macro(vault: &VaultState, id: i64) -> Result<(String, bool, Vec<String>), String> {
    let conn = vault.conn.lock().unwrap();
    let (run_mode, halt_on_error): (String, bool) = conn
        .query_row("SELECT run_mode, halt_on_error FROM macros WHERE id = ?1", params![id], |row| {
            Ok((row.get(0)?, row.get(1)?))
        })
        .map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT command FROM macro_steps WHERE macro_id = ?1 ORDER BY position")
        .map_err(|e| e.to_string())?;
    let steps = stmt
        .query_map(params![id], |row| row.get::<_, String>(0))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok((run_mode, halt_on_error, steps))
}

#[tauri::command]
pub fn macro_steps(vault: State<VaultState>, id: i64) -> Result<Vec<String>, String> {
    Ok(load_macro(&vault, id)?.2)
}


