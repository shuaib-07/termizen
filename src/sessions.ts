import { invoke } from "@tauri-apps/api/core";
import type { TerminalSession } from "./Terminal";

const localSessionCache = new Map<string, TerminalSession>();

export function localSession(shell?: string): TerminalSession {
  const key = shell || "default";
  if (!localSessionCache.has(key)) {
    localSessionCache.set(key, {
      spawn: (cols, rows) => invoke<number>("pty_spawn", { cols, rows, shell }),
      write: (id, data) => invoke("pty_write", { id, data }),
      resize: (id, cols, rows) => invoke("pty_resize", { id, cols, rows }),
      kill: (id) => invoke("pty_kill", { id }),
      outputEvent: "pty-output",
      exitEvent: "pty-exit",
    });
  }
  return localSessionCache.get(key)!;
}

export interface SshConnectParams {
  host: string;
  port: number;
  username: string;
  authMethod: "password" | "key";
  password?: string;
  keyPath?: string;
  keyData?: string;
  keyId?: number;
  passphrase?: string;
}

export function sshSession(params: SshConnectParams): TerminalSession {
  return {
    spawn: (cols, rows) =>
      invoke<number>("ssh_connect", {
        host: params.host,
        port: params.port,
        username: params.username,
        authMethod: params.authMethod,
        password: params.password,
        keyPath: params.keyPath,
        keyData: params.keyData,
        passphrase: params.passphrase,
        cols,
        rows,
      }),
    write: (id, data) => invoke("ssh_write", { id, data }),
    resize: (id, cols, rows) => invoke("ssh_resize", { id, cols, rows }),
    kill: (id) => invoke("ssh_kill", { id }),
    outputEvent: "ssh-output",
    exitEvent: "ssh-exit",
  };
}

export interface ProfileSummary {
  id: number;
  name: string;
  folder?: string;
  kind: "ssh" | "local";
  host: string;
  port: number;
  username: string;
  authMethod: "password" | "key" | "none";
  shell?: string;
  pinned: boolean;
  keyId?: number;
  bgMonitoring?: boolean;
  webLogPath?: string;
}

export type SaveProfileParams = SshConnectParams & { name: string; folder?: string };
export interface SaveLocalProfileParams {
  name: string;
  folder?: string;
  shell: string;
}

export const listProfiles = () => invoke<ProfileSummary[]>("profile_list");
export const deleteProfile = (id: number) => invoke<void>("profile_delete", { id });
export const setProfilePinned = (id: number, pinned: boolean) =>
  invoke<void>("profile_set_pinned", { id, pinned });
export const setProfileBgMonitoring = (id: number, enabled: boolean) =>
  invoke<void>("profile_set_bg_monitoring", { id, enabled });
export const getProfilePassword = (id: number) =>
  invoke<string | null>("profile_get_password", { id });

export const saveProfile = (params: SaveProfileParams) =>
  invoke<number>("profile_save", {
    name: params.name,
    folder: params.folder,
    kind: "ssh",
    host: params.host,
    port: params.port,
    username: params.username,
    authMethod: params.authMethod,
    password: params.password,
    keyPath: params.keyPath,
    keyData: params.keyData,
    keyId: params.keyId,
    passphrase: params.passphrase,
  });

export const updateProfile = (id: number, params: SaveProfileParams) =>
  invoke<void>("profile_update", {
    id,
    name: params.name,
    folder: params.folder,
    kind: "ssh",
    host: params.host,
    port: params.port,
    username: params.username,
    authMethod: params.authMethod,
    password: params.password,
    keyPath: params.keyPath,
    keyData: params.keyData,
    keyId: params.keyId,
    passphrase: params.passphrase,
  });

export const listKeys = () => invoke<import("./types").KeySummary[]>("key_list");
export const saveKey = (params: import("./types").SaveKeyParams) =>
  invoke<number>("key_save", {
    name: params.name,
    keyData: params.keyData,
    passphrase: params.passphrase,
    comment: params.comment,
  });
export const deleteKey = (id: number) => invoke<void>("key_delete", { id });

export const saveLocalProfile = (params: SaveLocalProfileParams) =>
  invoke<number>("profile_save", {
    name: params.name,
    folder: params.folder,
    kind: "local",
    shell: params.shell,
  });

export function sshProfileSession(id: number): TerminalSession {
  return {
    spawn: (cols, rows) => invoke<number>("profile_connect", { id, cols, rows }),
    write: (sessionId, data) => invoke("ssh_write", { id: sessionId, data }),
    resize: (sessionId, cols, rows) => invoke("ssh_resize", { id: sessionId, cols, rows }),
    kill: (sessionId) => invoke("ssh_kill", { id: sessionId }),
    outputEvent: "ssh-output",
    exitEvent: "ssh-exit",
  };
}

export function profileSession(profile: ProfileSummary): TerminalSession {
  return profile.kind === "local" ? localSession(profile.shell) : sshProfileSession(profile.id);
}

export interface MacroSummary {
  id: number;
  name: string;
  runMode: "exec" | "pty";
  haltOnError: boolean;
  stepCount: number;
  profileId?: number;
  folder?: string;
  shell?: string;
}

export interface SaveMacroParams {
  name: string;
  runMode: "exec" | "pty";
  haltOnError: boolean;
  steps: string[];
  profileId?: number;
  folder?: string;
  shell?: string;
}

export const listMacros = () => invoke<MacroSummary[]>("macro_list");
export const deleteMacro = (id: number) => invoke<void>("macro_delete", { id });
export const getMacroSteps = (id: number) => invoke<string[]>("macro_steps", { id });
export const saveMacro = (params: SaveMacroParams) =>
  invoke<number>("macro_save", {
    name: params.name,
    runMode: params.runMode,
    haltOnError: params.haltOnError,
    steps: params.steps,
    profileId: params.profileId,
    folder: params.folder,
    shell: params.shell ?? null,
  });

export const updateMacro = (id: number, params: SaveMacroParams) =>
  invoke<void>("macro_update", {
    id,
    name: params.name,
    runMode: params.runMode,
    haltOnError: params.haltOnError,
    steps: params.steps,
    profileId: params.profileId,
    folder: params.folder,
    shell: params.shell ?? null,
  });

export const updateProfileFolder = (profile: ProfileSummary, folder?: string) =>
  invoke<void>("profile_update", {
    id: profile.id,
    name: profile.name,
    folder: folder ? folder.trim() : null,
    kind: profile.kind,
    host: profile.host,
    port: profile.port,
    username: profile.username,
    authMethod: profile.authMethod,
    keyId: profile.keyId,
    shell: profile.shell,
  });

export const updateMacroFolder = async (macro: MacroSummary, folder?: string) => {
  const steps = await getMacroSteps(macro.id);
  return invoke<void>("macro_update", {
    id: macro.id,
    name: macro.name,
    runMode: macro.runMode,
    haltOnError: macro.haltOnError,
    steps,
    profileId: macro.profileId,
    folder: folder ? folder.trim() : null,
    shell: macro.shell ?? null,
  });
};

// A macro is usable in a given profile's context if it's global (no
// profileId) or explicitly assigned to that profile.
export const macroAppliesToProfile = (macro: MacroSummary, profileId?: number) => macro.profileId == null || macro.profileId === profileId;

export const runMacroExec = (profileId: number, macroId: number) =>
  invoke<number>("macro_run_exec", { profileId, macroId });
export const stopMacroExec = (runId: number) => invoke<void>("macro_stop", { runId });

// Monitoring & Service Logs APIs
export const fetchServerMetrics = (profileId: number) =>
  invoke<import("./types").ServerMetrics>("monitor_fetch_metrics", { profileId });

export const listProfileServices = (profileId: number) =>
  invoke<import("./types").ProfileService[]>("profile_service_list", { profileId });

export const saveProfileService = (params: {
  profileId: number;
  name: string;
  serviceType: string;
  target: string;
  color?: string;
}) => invoke<number>("profile_service_save", params);

export const updateProfileService = (params: {
  id: number;
  name: string;
  serviceType: string;
  target: string;
  color?: string;
}) => invoke<void>("profile_service_update", params);

export const deleteProfileService = (id: number) =>
  invoke<void>("profile_service_delete", { id });

export const discoverServices = (profileId: number) =>
  invoke<import("./types").DiscoveredService[]>("discover_services", { profileId });

export const startLogStream = (params: {
  profileId: number;
  serviceId: number;
  serviceType: string;
  target: string;
  lines?: number;
}) => invoke<number>("log_stream_start", params);

export const stopLogStream = (streamId: number) =>
  invoke<void>("log_stream_stop", { streamId });

export const setProfileServicePaused = (id: number, paused: boolean) =>
  invoke<void>("profile_service_set_paused", { id, paused });

// In-memory global metrics and status chart caches for 0ms SWR instant loading
export const metricsCache = new Map<number, { metrics: import("./types").ServerMetrics; lastUpdated: number }>();
export const monitorHistoryCache = new Map<
  number,
  {
    cpu: number[];
    ram: number[];
    rx: number[];
    tx: number[];
    diskRead?: number[];
    diskWrite?: number[];
  }
>();

export const getCachedMetrics = (profileId: number) => {
  return metricsCache.get(profileId)?.metrics;
};

export const setCachedMetrics = (profileId: number, metrics: import("./types").ServerMetrics) => {
  metricsCache.set(profileId, { metrics, lastUpdated: Date.now() });
};

export const getCachedMonitorHistory = (profileId: number) => {
  return monitorHistoryCache.get(profileId);
};

export const setCachedMonitorHistory = (
  profileId: number,
  history: {
    cpu: number[];
    ram: number[];
    rx: number[];
    tx: number[];
    diskRead?: number[];
    diskWrite?: number[];
  }
) => {
  monitorHistoryCache.set(profileId, history);
};

export const fetchWebTraffic = (profileId: number, customLogPath?: string) =>
  invoke<import("./types").WebTrafficMetrics>("web_traffic_probe", {
    profileId,
    customLogPath: customLogPath || null,
  });

export const detectWebLogs = (profileId: number) =>
  invoke<string[]>("web_traffic_detect_logs", { profileId });

export const setProfileWebLogPath = (id: number, path?: string) =>
  invoke<void>("profile_set_web_log_path", { id, path: path || null });

export const trafficCache = new Map<number, { metrics: import("./types").WebTrafficMetrics; lastUpdated: number }>();
export const getCachedWebTraffic = (profileId: number) => trafficCache.get(profileId)?.metrics;
export const setCachedWebTraffic = (profileId: number, metrics: import("./types").WebTrafficMetrics) => {
  trafficCache.set(profileId, { metrics, lastUpdated: Date.now() });
};

export const appHideToTray = () => invoke<void>("app_hide_to_tray");
export const appShow = () => invoke<void>("app_show");
export const appExit = () => invoke<void>("app_exit");


