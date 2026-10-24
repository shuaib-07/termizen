import type { TerminalSession } from "./Terminal";
export type { ProfileSummary, MacroSummary, SaveProfileParams, SshConnectParams, SaveLocalProfileParams } from "./sessions";

export interface CpuMetrics {
  overall: number;
  cores: number[];
  modelName?: string;
  userPercent?: number;
  systemPercent?: number;
  idlePercent?: number;
  iowaitPercent?: number;
}

export interface MemoryMetrics {
  totalBytes: number;
  usedBytes: number;
  freeBytes: number;
  availableBytes: number;
  cachedBytes: number;
  swapTotalBytes: number;
  swapUsedBytes: number;
  swapFreeBytes: number;
}

export interface DiskDevice {
  device: string;
  mountPoint: string;
  totalBytes: number;
  usedBytes: number;
  freeBytes: number;
  usedPercent: number;
}

export interface DiskMetrics {
  totalBytes: number;
  usedBytes: number;
  freeBytes: number;
  usedPercent: number;
  mountPoint: string;
  readBytesSec?: number;
  writeBytesSec?: number;
  devices?: DiskDevice[];
}

export interface NetworkInterfaceMetrics {
  name: string;
  rxBytesSec: number;
  txBytesSec: number;
  totalRxBytes: number;
  totalTxBytes: number;
}

export interface NetworkMetrics {
  rxBytesSec: number;
  txBytesSec: number;
  totalRxBytes: number;
  totalTxBytes: number;
  interface: string;
  interfaces?: NetworkInterfaceMetrics[];
}

export interface HostMetrics {
  hostname: string;
  osName: string;
  kernel: string;
  uptimeSeconds: number;
  loadAvg: [number, number, number];
  publicIp?: string;
}

export interface ServerMetrics {
  cpu: CpuMetrics;
  memory: MemoryMetrics;
  disk: DiskMetrics;
  network: NetworkMetrics;
  host: HostMetrics;
  timestamp: number;
}

export interface ProfileService {
  id: number;
  profileId: number;
  name: string;
  serviceType: "pm2" | "docker" | "systemd" | "tail" | "custom";
  target: string;
  color?: string;
  paused?: boolean;
}

export interface DiscoveredService {
  name: string;
  serviceType: "pm2" | "docker" | "systemd";
  target: string;
  description: string;
}

export interface KeySummary {
  id: number;
  name: string;
  comment?: string;
  createdAt: string;
}

export interface SaveKeyParams {
  name: string;
  keyData: string;
  passphrase?: string;
  comment?: string;
}

export interface TopEndpoint {
  path: string;
  count: number;
  percent: number;
}

export interface TopClientIp {
  ip: string;
  count: number;
  percent: number;
}

export interface RecentRequest {
  timestamp: string;
  method: string;
  path: string;
  status: number;
  clientIp: string;
  bytesSent: number;
}

export interface TrafficStatusBreakdown {
  count2xx: number;
  count3xx: number;
  count4xx: number;
  count5xx: number;
  codeCounts: Record<string, number>;
}

export interface WebTrafficMetrics {
  activeLogPath?: string;
  detectedLogs: string[];
  totalSampled: number;
  requestsPerSec: number;
  successRate: number;
  status: TrafficStatusBreakdown;
  topEndpoints: TopEndpoint[];
  topClientIps: TopClientIp[];
  recentRequests: RecentRequest[];
  timestamp: number;
}

export interface MacroGroupSummary {
  id: number;
  name: string;
  folder?: string;
  haltOnError: boolean;
  macroIds: number[];
  macroCount: number;
}

export interface WorkspaceTerminalDef {
  id?: number;
  position: number;
  title: string;
  targetKind: "local" | "ssh";
  profileId?: number;
  shell?: string;
  cwd?: string;
  startupCommand?: string;
}

export type GridPreset =
  | "auto"
  | "1x2"
  | "2x1"
  | "1+2"
  | "2x2"
  | "2x3"
  | "3x2"
  | "3x1";

export interface WorkspaceSummary {
  id: number;
  name: string;
  folder?: string;
  layoutMode: "tabs" | "split";
  gridPreset?: GridPreset;
  terminals: WorkspaceTerminalDef[];
}

export type SidebarViewMode = "dashboard" | "servers" | "macros" | "workspaces" | "keys" | "settings" | "about";

export type ServerHubSubView = "terminal" | "monitor" | "traffic" | "logs" | "macros";

export type TabContentState =
  | { kind: "connect" }
  // profileId is set when this session traces back to a saved profile (opened
  // from the sidebar, or saved via "Save & Connect")
  | {
      kind: "local";
      shell?: string;
      cwd?: string;
      profileId?: number;
      initialCommands?: string[];
      macroId?: number;
      macroName?: string;
    }
  | {
      kind: "ssh";
      session: TerminalSession;
      profileId?: number;
      initialSubView?: ServerHubSubView;
      profileName?: string;
      host?: string;
      initialCommands?: string[];
      macroId?: number;
      macroName?: string;
    }
  | { kind: "macro-run"; runId: number; macroName: string }
  // macroId unset = creating a new macro; set = editing that existing one.
  | { kind: "macro-editor"; macroId?: number };

export interface Pane {
  id: string;
  title: string;
  content: TabContentState;
}

export type PaneNode =
  | {
      kind: "leaf";
      pane: Pane;
    }
  | {
      kind: "split";
      id: string;
      direction: "row" | "column";
      sizes: [number, number]; // Percentage split, e.g. [50, 50]
      children: [PaneNode, PaneNode];
    };

export type PaneLayout =
  | { kind: "single"; pane: Pane }
  | { kind: "split"; direction: "row" | "column"; panes: [Pane, Pane] }
  | { kind: "tree"; root: PaneNode };

export interface Tab {
  id: string;
  layout: PaneLayout;
  activePaneId?: string;
  maximizedPaneId?: string;
  isLocked?: boolean;
}

