import { useState, useEffect, useCallback } from "react";
import {
  Network,
  Play,
  Square,
  RefreshCw,
  Copy,
  Check,
  Terminal,
  ShieldCheck,
  AlertCircle,
  Database,
  Layers,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip } from "@/components/ui/tooltip";
import {
  startTunnel,
  stopTunnel,
  listTunnels,
  type TunnelSummary,
} from "@/sessions";

interface ServerTunnelsViewProps {
  profileId: number;
  serverName?: string;
  host?: string;
  isVisible?: boolean;
  onOpenCliTunnel?: (localPort: number, remoteHost: string, remotePort: number) => void;
}

interface Preset {
  name: string;
  localPort: number;
  remoteHost: string;
  remotePort: number;
  icon: string;
}

const PRESETS: Preset[] = [
  { name: "MongoDB", localPort: 27018, remoteHost: "127.0.0.1", remotePort: 27017, icon: "🍃" },
  { name: "PostgreSQL", localPort: 5433, remoteHost: "127.0.0.1", remotePort: 5432, icon: "🐘" },
  { name: "MySQL / MariaDB", localPort: 3307, remoteHost: "127.0.0.1", remotePort: 3306, icon: "🐬" },
  { name: "Redis", localPort: 6380, remoteHost: "127.0.0.1", remotePort: 6379, icon: "⚡" },
  { name: "Web / API (8080)", localPort: 8080, remoteHost: "127.0.0.1", remotePort: 80, icon: "🌐" },
  { name: "Web / Node (3000)", localPort: 3000, remoteHost: "127.0.0.1", remotePort: 3000, icon: "🚀" },
];

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function ServerTunnelsView({
  profileId,
  serverName = "Server",
  host,
  isVisible = true,
  onOpenCliTunnel,
}: ServerTunnelsViewProps) {
  const [tunnels, setTunnels] = useState<TunnelSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form State
  const [localPort, setLocalPort] = useState<string>("27018");
  const [remoteHost, setRemoteHost] = useState<string>("127.0.0.1");
  const [remotePort, setRemotePort] = useState<string>("27017");

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchTunnels = useCallback(async () => {
    try {
      setIsLoading(true);
      const all = await listTunnels();
      setTunnels(all.filter((t) => t.profileId === profileId));
      setErrorMsg(null);
    } catch (err: any) {
      console.error("Failed to list tunnels:", err);
    } finally {
      setIsLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    if (isVisible) {
      void fetchTunnels();
      const interval = setInterval(fetchTunnels, 3000);
      return () => clearInterval(interval);
    }
  }, [isVisible, fetchTunnels]);

  const handleApplyPreset = (p: Preset) => {
    setLocalPort(String(p.localPort));
    setRemoteHost(p.remoteHost);
    setRemotePort(String(p.remotePort));
  };

  const handleStartTunnel = async () => {
    const lPort = parseInt(localPort.trim(), 10);
    const rPort = parseInt(remotePort.trim(), 10);
    const rHost = remoteHost.trim() || "127.0.0.1";

    if (isNaN(lPort) || lPort < 1 || lPort > 65535) {
      setErrorMsg("Please enter a valid local port (1-65535)");
      return;
    }
    if (isNaN(rPort) || rPort < 1 || rPort > 65535) {
      setErrorMsg("Please enter a valid remote port (1-65535)");
      return;
    }

    setIsStarting(true);
    setErrorMsg(null);
    try {
      await startTunnel({
        profileId,
        localPort: lPort,
        remoteHost: rHost,
        remotePort: rPort,
        profileName: serverName,
      });
      await fetchTunnels();
    } catch (err: any) {
      setErrorMsg(String(err?.message || err));
    } finally {
      setIsStarting(false);
    }
  };

  const handleStopTunnel = async (id: string) => {
    try {
      await stopTunnel(id);
      await fetchTunnels();
    } catch (err: any) {
      console.error("Failed to stop tunnel:", err);
    }
  };

  const handleCopy = (id: string, text: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 sm:p-6 space-y-6 bg-zinc-950/40 text-foreground">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20 shrink-0">
              <Network className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
                <span>SSH Port Forwarding & Tunnels</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-white/[0.06] text-muted-foreground font-mono font-normal">
                  {serverName} {host ? `(${host})` : ""}
                </span>
              </h1>
              <p className="text-xs text-muted-foreground">
                Forward remote databases, Docker APIs, and web services to your local machine (e.g.{" "}
                <code className="text-purple-300 font-mono">127.0.0.1:27018</code>) via encrypted SSH tunnel.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Tooltip content="Refresh tunnel statuses" side="bottom">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchTunnels}
              disabled={isLoading}
              className="h-8 gap-1.5 border-white/[0.08] bg-zinc-900/60 hover:bg-white/[0.08]"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </Button>
          </Tooltip>
        </div>
      </div>

      {/* Preset Quick-Buttons */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Database className="h-3.5 w-3.5" />
          <span>Quick Database & Service Presets:</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => {
            const isMatch =
              localPort === String(p.localPort) &&
              remotePort === String(p.remotePort) &&
              remoteHost === p.remoteHost;
            return (
              <button
                key={p.name}
                type="button"
                onClick={() => handleApplyPreset(p)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-all cursor-pointer ${
                  isMatch
                    ? "bg-purple-500/15 border-purple-500/40 text-purple-300 shadow-sm"
                    : "bg-zinc-900/40 border-white/[0.06] text-muted-foreground hover:text-foreground hover:bg-white/[0.05]"
                }`}
              >
                <span>{p.icon}</span>
                <span>{p.name}</span>
                <span className="text-[10px] opacity-70 font-mono">
                  (:{p.localPort} → :{p.remotePort})
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Create Tunnel Form Card */}
      <div className="rounded-xl border border-white/[0.08] bg-zinc-900/50 p-4 sm:p-5 shadow-lg backdrop-blur-md space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-purple-400" />
            <h2 className="text-sm font-semibold text-foreground">Configure Port Forward</h2>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Encrypted SSH Daemon</span>
          </div>
        </div>

        {errorMsg && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="flex-1">{errorMsg}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-4 space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Local Port (Your PC)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-muted-foreground/60 select-none">
                127.0.0.1:
              </span>
              <Input
                value={localPort}
                onChange={(e) => setLocalPort(e.target.value)}
                placeholder="27018"
                className="pl-20 h-9 font-mono text-xs bg-zinc-950 border-white/[0.08]"
              />
            </div>
          </div>

          <div className="hidden md:flex md:col-span-1 items-center justify-center pb-2 text-muted-foreground/60">
            <ArrowRight className="h-4 w-4" />
          </div>

          <div className="md:col-span-4 space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Remote Destination (Remote VPS)
            </label>
            <div className="flex items-center gap-1.5">
              <Input
                value={remoteHost}
                onChange={(e) => setRemoteHost(e.target.value)}
                placeholder="127.0.0.1"
                className="h-9 font-mono text-xs bg-zinc-950 border-white/[0.08] flex-1"
              />
              <span className="text-muted-foreground font-mono text-xs">:</span>
              <Input
                value={remotePort}
                onChange={(e) => setRemotePort(e.target.value)}
                placeholder="27017"
                className="h-9 font-mono text-xs bg-zinc-950 border-white/[0.08] w-24"
              />
            </div>
          </div>

          <div className="md:col-span-3 flex items-center gap-2">
            <Tooltip content="Launch persistent background tunnel (runs independently of terminal)" side="top">
              <Button
                onClick={handleStartTunnel}
                disabled={isStarting}
                className="h-9 w-full gap-1.5 bg-purple-600 hover:bg-purple-500 text-white font-medium shadow-md shadow-purple-950/40 cursor-pointer"
              >
                <Play className={`h-3.5 w-3.5 fill-white ${isStarting ? "animate-pulse" : ""}`} />
                <span>{isStarting ? "Connecting…" : "Start Tunnel"}</span>
              </Button>
            </Tooltip>

            {onOpenCliTunnel && (
              <Tooltip content="Open in interactive CLI terminal (runs ssh -L with auto-fill)" side="top">
                <Button
                  variant="outline"
                  onClick={() => {
                    const lPort = parseInt(localPort.trim(), 10) || 27018;
                    const rPort = parseInt(remotePort.trim(), 10) || 27017;
                    const rHost = remoteHost.trim() || "127.0.0.1";
                    onOpenCliTunnel(lPort, rHost, rPort);
                  }}
                  className="h-9 px-2.5 border-white/[0.08] bg-zinc-900/60 hover:bg-white/[0.08] text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <Terminal className="h-4 w-4" />
                </Button>
              </Tooltip>
            )}
          </div>
        </div>
      </div>

      {/* Active Tunnels Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <span>Active Tunnels for {serverName}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 font-mono">
              {tunnels.length} active
            </span>
          </h2>
        </div>

        {tunnels.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 rounded-xl border border-dashed border-white/[0.08] bg-zinc-950/20 text-center space-y-3">
            <div className="h-10 w-10 rounded-full bg-purple-500/10 text-purple-400 flex items-center justify-center">
              <Network className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">No Active Tunnels</p>
              <p className="text-xs text-muted-foreground mt-0.5 max-w-sm">
                Pick a database preset above or specify custom ports to expose a remote service directly on your PC.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {tunnels.map((t) => {
              const localAddr = `127.0.0.1:${t.localPort}`;
              const remoteAddr = `${t.remoteHost}:${t.remotePort}`;
              const isCopied = copiedId === t.id;

              return (
                <div
                  key={t.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-white/[0.08] bg-zinc-900/60 shadow-md backdrop-blur-md gap-4 transition-all hover:border-purple-500/30"
                >
                  <div className="flex items-start sm:items-center gap-3.5">
                    <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20 shrink-0 mt-0.5 sm:mt-0">
                      <Network className="h-4 w-4" />
                      <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-foreground">
                          {localAddr}
                        </span>
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/60" />
                        <span className="font-mono text-sm text-purple-300">
                          {remoteAddr}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                          Active
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                        <span>Clients: <strong className="text-foreground">{t.connectedClients}</strong></span>
                        <span>•</span>
                        <span>Transferred: <strong className="text-foreground">{formatBytes(t.bytesTx + t.bytesRx)}</strong></span>
                        <span>•</span>
                        <span>Started: <span className="font-mono">{new Date(t.createdAt).toLocaleTimeString()}</span></span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <Tooltip content="Copy local host and port" side="top">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopy(t.id, localAddr)}
                        className="h-8 gap-1.5 text-xs border-white/[0.08] bg-zinc-950/60 hover:bg-white/[0.08]"
                      >
                        {isCopied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                        <span>{isCopied ? "Copied" : "Copy"}</span>
                      </Button>
                    </Tooltip>

                    <Tooltip content="Stop this background tunnel" side="top">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleStopTunnel(t.id)}
                        className="h-8 gap-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 cursor-pointer"
                      >
                        <Square className="h-3.5 w-3.5 fill-red-400/80" />
                        <span>Stop</span>
                      </Button>
                    </Tooltip>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
