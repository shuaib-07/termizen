# Product Specification & Architecture Plan: Termina (Working Title)

A lightweight, ultra-fast, Windows-native SSH manager and local terminal featuring saved connection profiles, dynamic tab layouts (horizontal/vertical), and macro/command-group execution pipelines.

This revision resolves the open design questions from v1 of the plan (auth model, macro execution semantics, reconnect behavior, vault key derivation, scope cuts) into concrete, buildable decisions. Each section below states the decision and, where it isn't obvious, the reasoning and the alternative that was rejected.

---

## 1. System Overview & Core Stack

Termina is an installable, 100% offline-capable, **Windows-only** native application with zero telemetry or cloud dependencies. Cross-platform support is explicitly out of scope for v1 — it would require OS-abstracted credential storage and per-OS local shell handling for no immediate benefit.

### Technology Stack
* **Desktop Shell & Native Backend:** **Tauri v2** (Rust)
  * Memory footprint: ~15–30 MB baseline
  * Native asynchronous event bus for low-latency IPC streaming
  * **Auto-update:** Tauri's built-in updater plugin, signed releases, static JSON manifest hosted on GitHub Releases. In-app "Update available" prompt → download → install → restart.
* **Frontend Framework:** **React 18 / Vite + TypeScript**
* **Styling & Design System:** **Tailwind CSS + Sargam Icons** (minimalist, dark-mode native, high contrast)
* **Virtual Terminal Engine:** **`xterm.js`** + `@xterm/addon-fit` + `@xterm/addon-webgl` (hardware-accelerated rendering)
* **SSH & PTY Stream Engine:** Rust `russh` (both PTY-mode sessions and non-interactive exec-channel sessions — see §3.2) + `portable-pty` (local PowerShell/cmd/WSL sessions)
* **Local Database & Secure Storage:** **SQLite (via `rusqlite`)**, encrypted at rest with **AES-256-GCM**. Deviates from the original `sqlx` choice: the profile/macro schema is a handful of small tables with no concurrent writers, so sqlx's async + compile-time-checked-query machinery (DATABASE_URL or a committed offline query cache) was build-infrastructure tax without a payoff at this scale. rusqlite is synchronous, single-dependency, no macro ceremony.

### Window model (v1)
Single OS window. All tabs, splits, and panes live inside it. Chrome-style "drag a tab out into its own window" is real IDE/browser behavior but adds meaningful Tauri multi-window/state-sync complexity — deferred to v2.

---

## 2. Layout & UI Architecture

### 2.1 Tab Management System
* **Dual-Mode Layout Switcher:**
  * **Horizontal Mode (Chrome/Explorer style):** top tab bar, active status indicators, close buttons, drag-and-drop reordering.
  * **Vertical Mode (Edge/Arc style):** collapsible left sidebar listing open sessions with metadata (Server Name, Host IP, Live Latency, Active/Idle status).
* **Multi-Pane Viewport:**
  * Side-by-side splits (horizontal & vertical) within a tab.
  * **Any pane can independently host any profile** — a split is a viewport region, not a mirror of another pane's session. You can put `prod-api` in the left pane and `staging-api` in the right pane of the same tab.

### 2.2 Session restore on launch
A Settings toggle — **"On launch: Restore last session / Start fresh"** — controls whether closing and reopening the app reconnects all previously-open tabs/splits/layout-mode, or starts empty. Defaults to prompting on first run, then remembers the choice until changed. (Rejected: prompting every single launch — too much friction for daily use; rejected: silently deciding for the user either way — this is a real preference split.)

### 2.3 Navigation Hierarchy
* **Left Navigation Rail (Collapsible):**
  * **Profiles Explorer:** Tree view (`Folder → Server → Connection Profile`) for both SSH and local-shell profiles (see §3.1).
  * **Workspaces (optional layer):** A named, saved *group* of profiles that open together as a multi-tab/multi-split layout in one click (e.g. "Prod stack" → opens 3 SSH tabs). Distinct from the profile tree itself — the tree organizes individual profiles; a workspace is an optional bundle on top, not required to use the app.
  * **Macros Library:** Reusable macro templates (see §3.2), independent of any single profile.
  * **Vault / Credentials Manager:** `.pem`/`.ppk`/OpenSSH key management, passphrases.
  * **Settings:** appearance, fonts, keyboard shortcuts, session-restore behavior, vault lock timer, default macro run mode.

---

## 3. Core Feature Workflows

### 3.1 Profiles

Two profile types share one tree and one macro system:

* **SSH Profile**
  * Host (IP/domain), Port (default `22`), Username
  * Auth: **Password**, or **Private Key** (`.pem`, `id_rsa`, stored encrypted in-vault or referenced by file path). *SSH agent forwarding and jump-host/bastion (ProxyJump) support are real, commonly-needed features but are cut from v1 to keep the auth surface small — first candidates for v1.1.*
  * Startup Working Directory (e.g. `/var/www/my-app`)
  * Initial Command / env setup (e.g. `nvm use 20`)
  * Reconnect policy (see §3.4)
* **Local Shell Profile** — first-class, not a fallback. PowerShell, cmd, or a specific WSL distro, organized in the same folder tree, can run macros exactly like an SSH profile (useful for local build/deploy scripts).

### 3.2 Macros (Sequential Command Groups)

Macros are **reusable templates**, not bound to a single profile. Define once (e.g. "Full Git Pull & Restart"), attach/run against any compatible profile, instead of duplicating the same 5-step macro per server.

```
1. git fetch --all
2. git pull origin main
3. npm install --prefer-offline
4. npm run build
5. pm2 restart ecosystem.config.js
```

**Run mode — the key architectural decision.** SSH's interactive PTY stream is just raw text; it has no built-in way to report a command's real exit code back to the app, so "halt on non-zero exit" needs one of two transports. Both ship, chosen **per-macro**:

* **Exec mode (recommended default for anything deploy-shaped).** Each step runs on its own non-interactive SSH exec channel (`russh` exec request), which returns a protocol-level exit status — no text-parsing, no ambiguity. Steps are chained (`cd /var/www/my-app && git pull ...`) since each exec channel is stateless and doesn't inherit cwd/env from the previous step or from a live shell. Output streams into a dedicated macro-run panel, separate from any interactive tab, so a macro never collides with whatever the user happens to be doing in their terminal.
* **Live PTY mode (for macros meant to run *in* the visible tab).** Commands are typed into the tab's existing interactive shell with an injected `; echo TERMINA_EXIT:$?` marker parsed out of the stream. This preserves full shell context (cwd, env, activated venvs) and interleaves with manual typing, but is fragile if the shell isn't at a plain prompt when a step fires (mid-`vim`, `su`, `docker exec -it`, etc.) — a per-step timeout treats "no marker seen" as a stall and halts the macro rather than hanging forever.

Rejected: forcing every macro into one mode. Deploy-shaped macros want Exec's reliability; "run this in the shell I'm already looking at" macros want Live PTY's shared context. Making it per-macro (not global, not per-profile-only) lets both coexist without one compromising the other.

**Multi-server fan-out** (running one macro against a whole server group in parallel) is a real, useful feature but is cut from v1 — single-server-at-a-time macros first.

### 3.3 Halt-on-error & Emergency Stop
* **Halt on Non-Zero Exit** (configurable per macro): a failing step aborts remaining steps in both run modes.
* **Emergency Stop:** closing the SSH exec channel sends the equivalent of SIGHUP to the remote process group, actually killing the running remote command (not just stopping the queue) — this is standard SSH exec-channel behavior, not a Termina-specific hack.

### 3.4 Reconnect & Resume
* **Keepalive:** `ServerAliveInterval`-style pings so idle background tabs don't silently die.
* **On mid-macro disconnect (Exec mode):** auto-reconnect, **3 attempts, exponential backoff (~2s / 6s / 18s)**, then give up and mark the step/macro failed with an explicit message.
* **Resume safety:** each macro step has a **"safe to auto-retry on disconnect"** checkbox, **off by default**. Steps marked safe (e.g. `git fetch`, `npm install` — idempotent) auto-resume after reconnect without asking. Unmarked steps (e.g. `npm publish`, a DB migration) pause after reconnect and require explicit user confirmation before retrying, skipping, or aborting — re-running a non-idempotent command automatically is the kind of bug that ships broken state to production.
* **Live PTY mode on disconnect:** the interactive shell's state (cwd, env, whatever was mid-flight) dies with the TCP connection — there is no meaningful "resume," only a fresh shell. Treated as halt-and-mark-failed, no auto-retry, regardless of any per-step flag.

### 3.5 Session Logging
Off by default, **opt-in per profile**. Enabling it writes scrollback to disk — useful for audit trails on production servers, but plaintext logs risk capturing secrets typed into the shell or echoed in command output, so it's never on by default.

---

## 4. Security & Encryption Vault

* All sensitive credentials (passwords, private key strings, passphrases, file paths) live in a local SQLite database in `%APPDATA%/termina/`.
* **Encryption:** AES-256-GCM.
* **Key derivation — two layers:**
  1. **Default (always on):** the vault encryption key is derived from a machine-bound hash, so the vault is usable without any prompt — no PIN required to use the app day-to-day.
  2. **Optional PIN layer:** user can additionally set a Master PIN (Argon2id-derived) in Settings, which adds an idle-lock timer — the vault re-locks and requires the PIN after N minutes of inactivity (configurable). Off by default, matching the "frictionless by default, harden if you want" posture — a machine already behind a Windows login doesn't need a second mandatory password gate by default.
* Raw unencrypted keys never touch disk cache or logs; decrypted in-memory in the Rust backend only when establishing the SSH handshake.

---

## 5. Import / Export

Profiles and macros (folder structure, host/port/username, macro step lists — **not** secrets) are exportable/importable as JSON, for moving to a new machine or sharing a macro with a teammate. Secrets always stay vault-only and are re-entered on the destination machine; they never get written into the exported file.

---

## 6. Explicit v1 Scope Cuts

Cut from v1, revisit after the core terminal/macro engine is solid:

1. **SFTP / file browser drawer** — new protocol surface, no dependency on the terminal/macro engine, biggest standalone chunk of work in the original "suggested improvements" list.
2. **SSH agent forwarding & jump-host/bastion (ProxyJump)** — auth stays password/key-only for v1.
3. **Multi-server macro fan-out** — macros run against one profile at a time.
4. **Detachable tab → new OS window** — single window for v1.

Kept in v1 (small, or load-bearing for the macro engine): **keepalive/auto-reconnect**, **emergency stop**.
