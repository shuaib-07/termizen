import { useEffect, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  Cpu,
  FileText,
  Folder,
  HardDrive,
  Key,
  Layers,
  Pencil,
  Pin,
  Plus,
  RefreshCw,
  Search,
  Server,
  Shield,
  Terminal,
  Zap,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { NativeDelete } from "@/components/NativeDelete";
import { AnimatedBadge } from "@/components/AnimatedBadge";
import { Tooltip } from "@/components/ui/tooltip";
import { getFolderColor } from "@/lib/folderMetadata";
import { fetchServerMetrics, getCachedMetrics, setCachedMetrics } from "@/sessions";
import type { MacroSummary, ProfileSummary, ServerHubSubView, ServerMetrics } from "@/types";

function formatSpeed(bytesPerSec: number) {
  if (!bytesPerSec || bytesPerSec === 0) return "0 B/s";
  if (bytesPerSec < 1024) return `${bytesPerSec.toFixed(0)} B/s`;
  if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
  return `${(bytesPerSec / (1024 * 1024)).toFixed(2)} MB/s`;
}

function ServerCard({
  profile,
  macros: _macros,
  onOpen,
  onEdit,
  onDelete,
  onTogglePin,
  onToggleBgMonitoring,
  onRunMacro: _onRunMacro,
}: {
  profile: ProfileSummary;
  macros: MacroSummary[];
  onOpen: (profile: ProfileSummary, subView?: ServerHubSubView) => void;
  onEdit: (profile: ProfileSummary) => void;
  onDelete: (id: number) => void;
  onTogglePin: (id: number, pinned: boolean) => void;
  onToggleBgMonitoring: (currentBg: boolean) => void;
  onRunMacro: (profileId: number, macroId: number) => void;
}) {
  const cached = getCachedMetrics(profile.id);
  const [metrics, setMetrics] = useState<ServerMetrics | null>(() => cached ?? null);
  const [loading, setLoading] = useState(() => !cached);
  const [error, setError] = useState<string | null>(null);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [copiedError, setCopiedError] = useState(false);

  const handleCopyError = async () => {
    if (!error) return;
    try {
      await navigator.clipboard.writeText(error);
      setCopiedError(true);
      setTimeout(() => setCopiedError(false), 2000);
    } catch (err) {
      console.error("Failed to copy error", err);
    }
  };

  const inFlightRef = useRef(false);

  const fetchMetrics = async () => {
    if (profile.kind !== "ssh" || inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      if (!metrics) setLoading(true);
      const data = await fetchServerMetrics(profile.id);
      setMetrics(data);
      setCachedMetrics(profile.id, data);
      setError(null);
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
      inFlightRef.current = false;
    }
  };

  useEffect(() => {
    fetchMetrics();
    // Only auto-poll if healthy; if in error state, back off completely to avoid exhausting server MaxStartups
    const interval = setInterval(() => {
      if (!error && !inFlightRef.current) {
        fetchMetrics();
      }
    }, 5000);
    return () => {
      clearInterval(interval);
    };
  }, [profile.id, error]);

  const ramPercent = metrics ? Math.round((metrics.memory.usedBytes / (metrics.memory.totalBytes || 1)) * 100) : 0;

  const getUsageColor = (pct: number) => {
    if (pct >= 85) return "var(--destructive)";
    if (pct >= 70) return "#f59e0b";
    return "var(--primary)";
  };

  return (
    <>
      <Card className="flex flex-col justify-between p-4 border border-border bg-card/60 hover:border-border/90 hover:bg-card/80 transition-colors shadow-sm rounded-xl group">
      {/* Header */}
      <div>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20 transition-colors">
              <Server className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-semibold text-foreground truncate max-w-[150px]">
                  {profile.name}
                </h3>
                {profile.bgMonitoring && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    24/7 Live
                  </span>
                )}
                {profile.folder && (() => {
                  const folderColor = getFolderColor(profile.folder);
                  return (
                    <span
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border"
                      style={{
                        backgroundColor: folderColor ? `${folderColor}18` : "var(--muted)",
                        borderColor: folderColor ? `${folderColor}40` : "var(--border)",
                        color: folderColor || "var(--muted-foreground)",
                      }}
                    >
                      <Folder className="h-2.5 w-2.5" />
                      {profile.folder}
                    </span>
                  );
                })()}
              </div>
              <p className="text-[11px] font-mono text-muted-foreground">
                {profile.username}@{profile.host}:{profile.port || 22}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-0.5">
            <Tooltip
              content={
                profile.bgMonitoring
                  ? "24/7 Continuous Background Monitoring (Click to switch to Smart Monitoring)"
                  : "Smart Monitoring (Click to enable 24/7 Background Monitoring - Max 5)"
              }
              side="top"
            >
              <Button
                variant="ghost"
                size="icon"
                className={`h-7 w-7 ${
                  profile.bgMonitoring
                    ? "text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20"
                    : "text-muted-foreground/40 hover:text-muted-foreground"
                }`}
                onClick={() => onToggleBgMonitoring(Boolean(profile.bgMonitoring))}
              >
                <Activity
                  className={`h-3.5 w-3.5 ${
                    profile.bgMonitoring ? "animate-pulse" : ""
                  }`}
                />
              </Button>
            </Tooltip>
            <Tooltip content="Edit server settings" side="top">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground/60 hover:text-foreground"
                onClick={() => onEdit(profile)}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </Tooltip>
            <Tooltip content={profile.pinned ? "Unpin server" : "Pin server"} side="top">
              <Button
                variant="ghost"
                size="icon"
                className={`h-7 w-7 ${profile.pinned ? "text-amber-400" : "text-muted-foreground/40 hover:text-muted-foreground"}`}
                onClick={() => onTogglePin(profile.id, !profile.pinned)}
              >
                <Pin className={`h-3.5 w-3.5 ${profile.pinned ? "fill-amber-400" : ""}`} />
              </Button>
            </Tooltip>
            <NativeDelete size="sm" onConfirm={() => {}} onDelete={() => onDelete(profile.id)} />
          </div>
        </div>

        {/* Live Mini Stats */}
        {profile.kind === "ssh" && (
          <div className="mt-3.5 pt-3 border-t border-border/40">
            {metrics ? (
              <div className="space-y-2.5">
                {/* CPU & RAM Bar */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded-lg bg-muted/20 border border-border/40">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
                      <span className="flex items-center gap-1">
                        <Cpu className="h-3 w-3 text-primary" /> CPU
                      </span>
                      <span className="font-mono font-medium text-foreground">
                        {metrics.cpu.overall.toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted/40 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${Math.min(100, Math.max(0, metrics.cpu.overall))}%`,
                          backgroundColor: getUsageColor(metrics.cpu.overall),
                        }}
                      />
                    </div>
                  </div>

                  <div className="p-2 rounded-lg bg-muted/20 border border-border/40">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
                      <span className="flex items-center gap-1">
                        <Layers className="h-3 w-3 text-muted-foreground" /> RAM
                      </span>
                      <span className="font-mono font-medium text-foreground">
                        {ramPercent}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted/40 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${Math.min(100, Math.max(0, ramPercent))}%`,
                          backgroundColor: getUsageColor(ramPercent),
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Network & Disk */}
                <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center text-emerald-400 font-mono text-[10px]">
                      <ArrowDown className="h-2.5 w-2.5 mr-0.5" />
                      {formatSpeed(metrics.network.rxBytesSec)}
                    </span>
                    <span className="flex items-center text-primary font-mono text-[10px]">
                      <ArrowUp className="h-2.5 w-2.5 mr-0.5" />
                      {formatSpeed(metrics.network.txBytesSec)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 font-mono text-[10px]">
                    <HardDrive className="h-2.5 w-2.5 text-muted-foreground" />
                    <span>Disk: {metrics.disk.usedPercent.toFixed(0)}%</span>
                  </div>
                </div>
              </div>
            ) : loading ? (
              <div className="py-2.5 flex items-center justify-center gap-2">
                <AnimatedBadge status="loading" size="sm" pulse>
                  Fetching metrics...
                </AnimatedBadge>
              </div>
            ) : (
              <div className="py-1.5 flex items-center justify-between text-xs text-muted-foreground">
                {error ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowErrorModal(true);
                    }}
                    className="cursor-pointer group/err flex items-center gap-1.5 hover:opacity-90 active:scale-95 transition-all text-left"
                    title="Click to view full error details & copy error"
                  >
                    <AnimatedBadge status="danger" size="sm">
                      Offline / Unreachable
                    </AnimatedBadge>
                    <span className="text-[10px] text-red-400 font-medium underline underline-offset-2 hover:text-red-300">
                      View Error
                    </span>
                  </button>
                ) : (
                  <AnimatedBadge status="neutral" size="sm">
                    Ready to monitor
                  </AnimatedBadge>
                )}
                <Button variant="ghost" size="sm" className="h-6 text-[11px] px-2" onClick={fetchMetrics}>
                  <RefreshCw className="h-3 w-3 mr-1" /> Probe
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="pt-3 mt-3 border-t border-border/40 grid grid-cols-3 gap-1.5">
        <Button
          size="sm"
          variant="secondary"
          className="h-7 text-xs px-1.5 gap-1 font-medium bg-secondary/80 hover:bg-secondary min-w-0"
          onClick={() => onOpen(profile, "terminal")}
        >
          <Terminal className="h-3 w-3 text-primary shrink-0" />
          <span className="truncate">Shell</span>
        </Button>

        <Button
          size="sm"
          variant="secondary"
          className="h-7 text-xs px-1.5 gap-1 font-medium bg-secondary/80 hover:bg-secondary min-w-0"
          onClick={() => onOpen(profile, "monitor")}
        >
          <Activity className="h-3 w-3 text-primary shrink-0" />
          <span className="truncate">Charts</span>
        </Button>

        <Button
          size="sm"
          variant="secondary"
          className="h-7 text-xs px-1.5 gap-1 font-medium bg-secondary/80 hover:bg-secondary min-w-0"
          onClick={() => onOpen(profile, "logs")}
        >
          <FileText className="h-3 w-3 text-emerald-400 shrink-0" />
          <span className="truncate">Logs</span>
        </Button>
      </div>
    </Card>

    {/* Error Details Modal */}
    {error && (
      <Modal
        isOpen={showErrorModal}
        onClose={() => setShowErrorModal(false)}
        maxWidth="max-w-lg"
        title={
          <div className="flex items-center gap-2 text-foreground">
            <AlertTriangle className="h-5 w-5 text-red-400 shrink-0" />
            <span>Connection Failure Details</span>
          </div>
        }
        description={
          <div className="text-xs text-muted-foreground font-mono mt-0.5">
            {profile.name} ({profile.username}@{profile.host}:{profile.port || 22})
          </div>
        }
      >
        <div className="space-y-4 pt-2 select-text">
          {/* Raw Error Box */}
          <div className="rounded-xl bg-black/50 border border-red-500/25 p-3 relative">
            <div className="flex items-center justify-between text-[11px] font-semibold text-red-400/90 mb-1.5 uppercase tracking-wider">
              <span>Raw Error Message</span>
              <button
                type="button"
                onClick={handleCopyError}
                className="flex items-center gap-1 text-[11px] font-mono text-muted-foreground hover:text-foreground bg-white/[0.08] hover:bg-white/[0.15] px-2 py-0.5 rounded cursor-pointer transition-colors"
                title="Copy error to clipboard"
              >
                {copiedError ? (
                  <>
                    <Check className="h-3 w-3 text-emerald-400" />
                    <span className="text-emerald-400 font-semibold">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    <span>Copy Error</span>
                  </>
                )}
              </button>
            </div>
            <pre className="text-xs font-mono text-red-300 whitespace-pre-wrap break-all select-text font-normal leading-relaxed">
              {error}
            </pre>
          </div>

          {/* Quick Diagnostic Insights */}
          <div className="rounded-xl bg-muted/20 border border-border/40 p-3 space-y-2 text-xs">
            <div className="font-semibold text-foreground flex items-center gap-1.5">
              <Shield className="h-4 w-4 text-amber-400 shrink-0" />
              <span>Diagnostic Recommendations</span>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              {error.includes("10054") || error.toLowerCase().includes("forcibly closed") ? (
                <>
                  <strong className="text-foreground">Connection Forcibly Closed (OS 10054):</strong> The remote host or firewall actively reset the connection. This usually happens if fail2ban blocked your IP address, the VPS instance rebooted, or the SSH service was restarted during the handshake.
                </>
              ) : error.includes("10060") || error.toLowerCase().includes("timeout") || error.toLowerCase().includes("timed out") ? (
                <>
                  <strong className="text-foreground">Connection Timed Out (OS 10060):</strong> The server did not respond. Check your cloud provider's firewall / Security Group rules (ensure inbound TCP port {profile.port || 22} is open) and verify the instance power state.
                </>
              ) : error.includes("10061") || error.toLowerCase().includes("refused") ? (
                <>
                  <strong className="text-foreground">Connection Refused (OS 10061):</strong> The server is online but not listening on port {profile.port || 22}. Check if the SSH daemon is running or uses a custom port.
                </>
              ) : (
                <>
                  <strong className="text-foreground">SSH Error:</strong> Check that the host IP, port, and credentials are correct, or inspect remote auth logs.
                </>
              )}
            </p>
          </div>

          {/* Actions */}
          <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-border/40">
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="default"
                className="h-8 text-xs px-3 font-semibold gap-1.5"
                onClick={handleCopyError}
              >
                {copiedError ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copiedError ? "Copied to Clipboard!" : "Copy Error"}</span>
              </Button>

              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs px-2.5 gap-1.5"
                onClick={() => {
                  fetchMetrics();
                }}
                disabled={loading}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                <span>Probe Again</span>
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                className="h-8 text-xs px-2.5 gap-1 text-primary"
                onClick={() => {
                  setShowErrorModal(false);
                  onOpen(profile, "terminal");
                }}
              >
                <Terminal className="h-3.5 w-3.5" />
                <span>Open Shell</span>
              </Button>

              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-xs px-2.5 text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setShowErrorModal(false);
                  onEdit(profile);
                }}
              >
                <Pencil className="h-3.5 w-3.5 mr-1" />
                <span>Edit</span>
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    )}
  </>
  );
}

export default function ServerDashboard({
  profiles,
  macros,
  onOpenProfile,
  onEditProfile,
  onDeleteProfile,
  onAddServer,
  onTogglePin,
  onToggleBgMonitoring,
  onRunMacro,
  onOpenKeyVault,
}: {
  profiles: ProfileSummary[];
  macros: MacroSummary[];
  onOpenProfile: (profile: ProfileSummary, subView?: ServerHubSubView) => void;
  onEditProfile: (profile: ProfileSummary) => void;
  onDeleteProfile: (id: number) => void;
  onAddServer: () => void;
  onTogglePin: (id: number, pinned: boolean) => void;
  onToggleBgMonitoring: (id: number, enabled: boolean) => void;
  onRunMacro: (profileId: number, macroId: number) => void;
  onOpenKeyVault: () => void;
}) {
  const [search, setSearch] = useState("");
  const [filterFolder, setFilterFolder] = useState<string>("all");
  const [showLimitModal, setShowLimitModal] = useState(false);

  const handleToggleBg = (profileId: number, currentBg: boolean) => {
    if (!currentBg) {
      const activeCount = profiles.filter((p) => p.bgMonitoring).length;
      if (activeCount >= 5) {
        setShowLimitModal(true);
        return;
      }
    }
    onToggleBgMonitoring(profileId, !currentBg);
  };

  const folders = Array.from(new Set(profiles.map((p) => p.folder).filter(Boolean))) as string[];

  const filteredProfiles = profiles.filter((p) => {
    if (filterFolder !== "all" && p.folder !== filterFolder) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.host.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 sm:p-6 space-y-6 bg-transparent">
      {/* Top Welcome & Summary Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/40 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20 shrink-0">
              <Server className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-foreground truncate">Server Manager</h1>
              <p className="text-xs text-muted-foreground">
                Monitor VPS & EC2 servers live, stream logs, and run automated macros.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={onOpenKeyVault} className="gap-1.5 text-xs">
            <Key className="h-3.5 w-3.5 text-amber-400" /> Key Vault
          </Button>
          <Button size="sm" onClick={onAddServer} className="gap-1.5 shadow-sm font-medium">
            <Plus className="h-4 w-4" /> Add Server
          </Button>
        </div>
      </div>

      {/* Empty State */}
      {profiles.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-8 sm:p-12 text-center border-dashed border-border/80 bg-card/30 space-y-4 rounded-xl">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/20 shadow-inner">
            <Server className="h-8 w-8" />
          </div>
          <div className="max-w-md space-y-1.5">
            <h2 className="text-base font-bold text-foreground">No Servers Added Yet</h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Add your Hostinger VPS, AWS EC2, DigitalOcean droplet, or local Linux machine to monitor CPU, memory, network, and live service logs in real time.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-lg w-full text-left my-2">
            <div className="p-3 rounded-lg border border-border/50 bg-background/50 space-y-1">
              <Activity className="h-4 w-4 text-primary" />
              <div className="text-xs font-semibold text-foreground">Live Monitoring</div>
              <p className="text-[11px] text-muted-foreground">Agentless CPU, RAM, Disk & Network tracking.</p>
            </div>

            <div className="p-3 rounded-lg border border-border/50 bg-background/50 space-y-1">
              <FileText className="h-4 w-4 text-emerald-400" />
              <div className="text-xs font-semibold text-foreground">Service Logs</div>
              <p className="text-[11px] text-muted-foreground">Real-time PM2, Docker, and Systemd logs.</p>
            </div>

            <div className="p-3 rounded-lg border border-border/50 bg-background/50 space-y-1">
              <Zap className="h-4 w-4 text-amber-400" />
              <div className="text-xs font-semibold text-foreground">Macros Engine</div>
              <p className="text-[11px] text-muted-foreground">Automated multi-step deployments.</p>
            </div>
          </div>

          <Button size="default" onClick={onAddServer} className="gap-2 shadow-sm">
            <Plus className="h-4 w-4" /> Add Your First Server
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Filter & Search Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 w-full sm:w-72 shrink-0">
              <div className="relative w-full">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Search servers by name or host..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-8 pl-8 text-xs bg-card/60 border-border/60 w-full"
                />
              </div>
            </div>

            {folders.length > 0 && (
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar max-w-full pb-1 -mb-1">
                <Button
                  variant={filterFolder === "all" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-7 text-xs shrink-0"
                  onClick={() => setFilterFolder("all")}
                >
                  All ({profiles.length})
                </Button>
                {folders.map((f) => {
                  const color = getFolderColor(f);
                  const isSelected = filterFolder === f;
                  return (
                    <Button
                      key={f}
                      variant={isSelected ? "secondary" : "ghost"}
                      size="sm"
                      className="h-7 text-xs gap-1.5 shrink-0"
                      style={
                        color && isSelected
                          ? {
                              borderColor: `${color}60`,
                              backgroundColor: `${color}20`,
                              color: "var(--foreground)",
                            }
                          : undefined
                      }
                      onClick={() => setFilterFolder(f)}
                    >
                      {color && (
                        <span
                          className="h-2 w-2 rounded-full shadow-xs shrink-0"
                          style={{ backgroundColor: color }}
                        />
                      )}
                      {f}
                    </Button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Servers Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 min-[1150px]:grid-cols-3 gap-4">
            {filteredProfiles.map((p) => (
              <ServerCard
                key={p.id}
                profile={p}
                macros={macros}
                onOpen={onOpenProfile}
                onEdit={onEditProfile}
                onDelete={onDeleteProfile}
                onTogglePin={onTogglePin}
                onToggleBgMonitoring={(cur) => handleToggleBg(p.id, cur)}
                onRunMacro={onRunMacro}
              />
            ))}
          </div>
        </div>
      )}

      {/* 5-Server Limit Dialog */}
      <Modal
        isOpen={showLimitModal}
        onClose={() => setShowLimitModal(false)}
        title="24/7 Monitoring Limit Reached (5/5)"
        description="Termizen allows a maximum of 5 servers to run continuous 24/7 background polling."
      >
        <div className="space-y-4 text-xs text-muted-foreground pt-1">
          <p>
            Continuous background monitoring polls servers even when you are working on other tabs or screens. To protect network bandwidth, preserve laptop battery, and prevent overloading remote server SSH channels, Termizen caps 24/7 background monitoring at <strong>5 servers</strong>.
          </p>
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300">
            All other servers operate under <strong>Smart On-Demand Monitoring</strong>, which displays cached metrics instantly (0ms) and updates whenever you view the dashboard.
          </div>
          <p>
            Please disable 24/7 monitoring on one of your other servers before activating it on this server.
          </p>
          <div className="flex justify-end pt-2">
            <Button size="sm" onClick={() => setShowLimitModal(false)}>
              Understood
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
