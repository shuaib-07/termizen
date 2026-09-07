import React, { useEffect, useState, useId, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  FileText,
  Globe,
  Pause,
  Play,
  RefreshCw,
  Search,
  Users,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import {
  fetchWebTraffic,
  detectWebLogs,
  setProfileWebLogPath,
  getCachedWebTraffic,
  setCachedWebTraffic,
} from "@/sessions";
import type { WebTrafficMetrics } from "@/types";

// ==========================================
// Formatting Helpers
// ==========================================

function formatBytes(bytes: number, decimals = 1): string {
  if (!bytes || bytes <= 0 || isNaN(bytes)) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

function getStatusBadge(status: number) {
  if (status >= 200 && status < 300) {
    return {
      bg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      dot: "bg-emerald-400",
      label: `${status} OK`,
    };
  }
  if (status >= 300 && status < 400) {
    return {
      bg: "bg-sky-500/10 text-sky-400 border-sky-500/20",
      dot: "bg-sky-400",
      label: `${status} Redirect`,
    };
  }
  if (status >= 400 && status < 500) {
    return {
      bg: "bg-amber-500/10 text-amber-400 border-amber-500/20",
      dot: "bg-amber-400",
      label: `${status} Error`,
    };
  }
  return {
    bg: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    dot: "bg-rose-400",
    label: `${status} Server Err`,
  };
}

function getMethodBadge(method: string) {
  switch (method.toUpperCase()) {
    case "GET":
      return "bg-blue-500/10 text-blue-400 border-blue-500/20";
    case "POST":
      return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    case "PUT":
    case "PATCH":
      return "bg-amber-500/10 text-amber-400 border-amber-500/20";
    case "DELETE":
      return "bg-rose-500/10 text-rose-400 border-rose-500/20";
    default:
      return "bg-muted/40 text-muted-foreground border-border/40";
  }
}

// ==========================================
// Interactive Multi-Series Chart
// ==========================================

interface TrafficTimelinePoint {
  time: string;
  rps: number;
  count2xx: number;
  count4xx: number;
  count5xx: number;
}

function TrafficSparkline({
  history,
  height = 100,
}: {
  history: TrafficTimelinePoint[];
  height?: number;
}) {
  const chartId = useId().replace(/:/g, "_");
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const dataLength = history.length;
  const maxVal = Math.max(...history.map((h) => h.rps), 1);
  const max = Math.ceil(maxVal * 1.25);
  const min = 0;
  const range = max - min || 1;

  const ticks = [max, max * 0.66, max * 0.33, 0];

  const svgWidth = 500;
  const svgHeight = height;
  const padBottom = 6;
  const padTop = 6;
  const plotH = svgHeight - padTop - padBottom;

  const getX = (idx: number) => {
    if (dataLength <= 1) return 0;
    return (idx / (dataLength - 1)) * svgWidth;
  };

  const getY = (val: number) => {
    const norm = Math.max(0, Math.min(1, (val - min) / range));
    return svgHeight - padBottom - norm * plotH;
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || dataLength <= 1) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, x / rect.width));
    const idx = Math.round(pct * (dataLength - 1));
    setHoverIndex(idx);
  };

  const activeIndex = hoverIndex !== null && hoverIndex < dataLength ? hoverIndex : null;
  const hoverPct = activeIndex !== null && dataLength > 1 ? (activeIndex / (dataLength - 1)) * 100 : null;

  const points = history.map((val, i) => `${getX(i).toFixed(1)},${getY(val.rps).toFixed(1)}`);
  const linePath = `M ${points.join(" L ")}`;
  const fillPath = `${linePath} L ${svgWidth},${svgHeight} L 0,${svgHeight} Z`;

  return (
    <div className="flex w-full items-stretch gap-2 select-none">
      <div className="flex flex-col justify-between text-[10px] font-mono text-muted-foreground py-1 w-14 text-right shrink-0">
        {ticks.map((t, i) => (
          <span key={i} className="truncate">
            {t.toFixed(1)}/s
          </span>
        ))}
      </div>

      <div
        ref={containerRef}
        className="relative flex-1 cursor-crosshair overflow-visible"
        style={{ height }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverIndex(null)}
      >
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          preserveAspectRatio="none"
          className="w-full h-full block overflow-visible"
        >
          <defs>
            <linearGradient id={`grad_traffic_${chartId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {ticks.slice(1, -1).map((t, i) => {
            const y = getY(t);
            return (
              <line
                key={i}
                x1="0"
                y1={y}
                x2={svgWidth}
                y2={y}
                stroke="currentColor"
                strokeWidth="1"
                className="text-border/40"
                strokeDasharray="3 3"
              />
            );
          })}

          {dataLength > 1 && (
            <g>
              <path d={fillPath} fill={`url(#grad_traffic_${chartId})`} />
              <path
                d={linePath}
                fill="none"
                stroke="#3b82f6"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          )}
        </svg>

        {activeIndex !== null && hoverPct !== null && (
          <>
            <div
              className="absolute top-0 bottom-0 pointer-events-none w-[1.5px] bg-primary/80 z-10"
              style={{ left: `${hoverPct}%` }}
            />
            {history[activeIndex] && (
              <div
                className="absolute w-2.5 h-2.5 -ml-[5px] -mt-[5px] rounded-full border-2 border-background bg-primary pointer-events-none shadow-xs z-20"
                style={{
                  left: `${hoverPct}%`,
                  top: `${getY(history[activeIndex].rps)}px`,
                }}
              />
            )}
            {(() => {
              const dotY = history[activeIndex] ? getY(history[activeIndex].rps) : 50;
              const topPx = dotY >= 34 ? dotY - 30 : Math.min(height - 28, dotY + 12);

              return (
                <div
                  className="absolute pointer-events-none z-30 transform -translate-x-1/2 px-2.5 py-1 rounded-lg bg-popover/95 backdrop-blur-xl border border-border text-[11px] font-mono text-popover-foreground shadow-lg flex items-center gap-2 whitespace-nowrap transition-all duration-75"
                  style={{
                    left: `${Math.max(16, Math.min(84, hoverPct))}%`,
                    top: `${Math.max(4, Math.min(height - 28, topPx))}px`,
                  }}
                >
                  <span className="text-muted-foreground">{history[activeIndex]?.time || "now"}</span>
                  <span className="text-primary font-semibold">
                    {history[activeIndex]?.rps.toFixed(1)} req/s
                  </span>
                  <span className="text-emerald-400">
                    {history[activeIndex]?.count2xx} ok
                  </span>
                  {history[activeIndex]?.count4xx > 0 && (
                    <span className="text-amber-400">
                      {history[activeIndex]?.count4xx} 4xx
                    </span>
                  )}
                  {history[activeIndex]?.count5xx > 0 && (
                    <span className="text-rose-400">
                      {history[activeIndex]?.count5xx} 5xx
                    </span>
                  )}
                </div>
              );
            })()}
          </>
        )}
      </div>
    </div>
  );
}

// ==========================================
// Main WebTrafficDashboard Component
// ==========================================

export default function WebTrafficDashboard({
  profileId,
  serverName,
  host,
  defaultLogPath,
  isVisible = true,
}: {
  profileId: number;
  serverName?: string;
  host?: string;
  defaultLogPath?: string;
  isVisible?: boolean;
}) {
  const cached = getCachedWebTraffic(profileId);

  const [metrics, setMetrics] = useState<WebTrafficMetrics | null>(() => cached ?? null);
  const [loading, setLoading] = useState(() => !cached);
  const [error, setError] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);

  // Active selected log path
  const [selectedLogPath, setSelectedLogPath] = useState<string>(
    () => cached?.activeLogPath || defaultLogPath || ""
  );
  const [customPathInput, setCustomPathInput] = useState("");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [detectedLogs, setDetectedLogs] = useState<string[]>(() => cached?.detectedLogs ?? []);
  const [detecting, setDetecting] = useState(false);

  // Search filter for endpoints/requests
  const [urlFilter, setUrlFilter] = useState("");
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  // Live timeline history buffer (up to 30 points)
  const [history, setHistory] = useState<TrafficTimelinePoint[]>([]);

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url).then(() => {
      setCopiedUrl(url);
      setTimeout(() => setCopiedUrl(null), 2000);
    });
  };

  const handleSelectLog = async (path: string) => {
    setSelectedLogPath(path);
    setIsSettingsOpen(false);
    try {
      await setProfileWebLogPath(profileId, path);
    } catch (_) {}
    fetchLatest(path);
  };

  const handleDetect = async () => {
    setDetecting(true);
    try {
      const logs = await detectWebLogs(profileId);
      setDetectedLogs(logs);
      if (logs.length > 0 && !selectedLogPath) {
        handleSelectLog(logs[0]);
      }
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setDetecting(false);
    }
  };

  const fetchLatest = async (pathOverride?: string) => {
    try {
      const target = pathOverride !== undefined ? pathOverride : selectedLogPath;
      const data = await fetchWebTraffic(profileId, target || undefined);
      setMetrics(data);
      setCachedWebTraffic(profileId, data);
      setError(null);

      if (data.detectedLogs.length > 0) {
        setDetectedLogs(data.detectedLogs);
      }
      if (data.activeLogPath && !selectedLogPath) {
        setSelectedLogPath(data.activeLogPath);
      }

      // Append point to history
      const nowStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      setHistory((prev) => [
        ...prev.slice(-29),
        {
          time: nowStr,
          rps: data.requestsPerSec,
          count2xx: data.status.count2xx,
          count4xx: data.status.count4xx,
          count5xx: data.status.count5xx,
        },
      ]);
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    fetchLatest();

    const interval = setInterval(() => {
      if (!isPaused && isVisible && mounted) {
        fetchLatest();
      }
    }, 2500);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [profileId, isPaused, isVisible, selectedLogPath]);

  // Loading initial state
  if (loading && !metrics) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-muted-foreground bg-transparent select-none font-sans">
        <Activity className="h-8 w-8 animate-pulse text-primary" />
        <p className="text-sm">Connecting & analyzing web server access logs...</p>
      </div>
    );
  }

  // Error State with retry
  if (error && !metrics) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center bg-transparent select-none font-sans">
        <AlertCircle className="h-10 w-10 text-destructive" />
        <div className="max-w-md space-y-1">
          <h3 className="font-semibold text-foreground">Failed to inspect web traffic</h3>
          <p className="text-xs text-muted-foreground break-all">{error}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setLoading(true);
              fetchLatest();
            }}
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Retry
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={handleDetect}
            disabled={detecting}
          >
            {detecting ? "Scanning..." : "Auto-Detect Logs"}
          </Button>
        </div>
      </div>
    );
  }

  // No Log Found State
  if (!metrics || (!metrics.activeLogPath && metrics.detectedLogs.length === 0)) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center bg-transparent select-none font-sans">
        <div className="p-3 rounded-2xl bg-primary/10 text-primary border border-primary/20">
          <Globe className="h-8 w-8" />
        </div>
        <div className="max-w-md space-y-1.5">
          <h3 className="text-base font-semibold text-foreground">No Web Server Access Log Configured</h3>
          <p className="text-xs text-muted-foreground">
            Termizen analyzes Nginx, Caddy, or Apache access logs over SSH without installing any agents on your server.
          </p>
        </div>

        <div className="w-full max-w-sm rounded-xl bg-card/65 backdrop-blur-xl border border-border/70 p-4 space-y-3">
          <div className="text-left">
            <label className="text-xs font-medium text-foreground">Specify Access Log Path</label>
            <div className="flex gap-2 mt-1.5">
              <input
                type="text"
                placeholder="/var/log/nginx/access.log"
                value={customPathInput}
                onChange={(e) => setCustomPathInput(e.target.value)}
                className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-background/80 border border-border/70 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <Button
                size="sm"
                onClick={() => handleSelectLog(customPathInput)}
                disabled={!customPathInput.trim()}
              >
                Connect
              </Button>
            </div>
          </div>

          <div className="pt-2 border-t border-border/40">
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs"
              onClick={handleDetect}
              disabled={detecting}
            >
              <Search className="mr-1.5 h-3.5 w-3.5" />
              {detecting ? "Scanning common paths..." : "Scan & Auto-Detect Web Logs"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const filteredEndpoints = metrics.topEndpoints.filter((e) =>
    e.path.toLowerCase().includes(urlFilter.toLowerCase())
  );

  const filteredRequests = metrics.recentRequests.filter(
    (r) =>
      r.path.toLowerCase().includes(urlFilter.toLowerCase()) ||
      r.clientIp.includes(urlFilter) ||
      r.method.toLowerCase().includes(urlFilter.toLowerCase())
  );

  return (
    <div className="h-full overflow-y-auto bg-transparent text-foreground p-4 md:p-5 space-y-4 select-none font-sans">
      {/* Top Header & Domain / Log Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-1">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
            <Globe className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-foreground">
                Web Server Traffic
              </h2>
              <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400 border border-emerald-500/20">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                Live
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
              <span className="font-mono truncate max-w-xs" title={metrics.activeLogPath}>
                {metrics.activeLogPath || "Standard Access Log"}
              </span>
              <span>•</span>
              <span>{serverName || host}</span>
            </div>
          </div>
        </div>

        {/* Action Controls & Log Selector */}
        <div className="flex items-center gap-2">
          {/* Detected Logs Selector Dropdown */}
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs bg-card/60 border-border/60 hover:bg-card text-muted-foreground hover:text-foreground gap-1.5 font-mono"
              onClick={() => setIsSettingsOpen((o) => !o)}
            >
              <FileText className="h-3.5 w-3.5 text-primary" />
              <span className="max-w-[160px] truncate">
                {metrics.activeLogPath ? metrics.activeLogPath.split("/").pop() : "Select Log"}
              </span>
              <ChevronDown className="h-3 w-3 opacity-60" />
            </Button>

            {/* Dropdown Popover */}
            <AnimatePresence>
              {isSettingsOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.96, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-1.5 w-80 rounded-xl bg-popover/95 backdrop-blur-2xl border border-border p-3 shadow-xl z-50 space-y-3"
                >
                  <div className="flex items-center justify-between text-xs font-semibold text-foreground">
                    <span>Web Access Logs</span>
                    <button
                      onClick={handleDetect}
                      disabled={detecting}
                      className="text-[11px] text-primary hover:underline"
                    >
                      {detecting ? "Scanning..." : "Rescan"}
                    </button>
                  </div>

                  {detectedLogs.length > 0 ? (
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {detectedLogs.map((log) => (
                        <button
                          key={log}
                          onClick={() => handleSelectLog(log)}
                          className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-mono truncate transition-colors flex items-center justify-between ${
                            log === metrics.activeLogPath
                              ? "bg-primary/15 text-primary font-medium border border-primary/20"
                              : "hover:bg-muted/40 text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          <span className="truncate">{log}</span>
                          {log === metrics.activeLogPath && <Check className="h-3 w-3 shrink-0 ml-2" />}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No logs auto-detected.</p>
                  )}

                  <div className="pt-2 border-t border-border/40 space-y-1.5">
                    <label className="text-[11px] text-muted-foreground">Custom Log Path</label>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        placeholder="/path/to/access.log"
                        value={customPathInput}
                        onChange={(e) => setCustomPathInput(e.target.value)}
                        className="flex-1 px-2.5 py-1 text-xs rounded-md bg-background/80 border border-border/70 text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      <Button
                        size="sm"
                        className="h-7 px-2.5 text-xs"
                        onClick={() => handleSelectLog(customPathInput)}
                        disabled={!customPathInput.trim()}
                      >
                        Apply
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <Tooltip content={isPaused ? "Resume Polling" : "Pause Polling"} side="bottom">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 bg-card/60 border-border/60 hover:bg-card text-muted-foreground hover:text-foreground"
              onClick={() => setIsPaused((p) => !p)}
            >
              {isPaused ? <Play className="h-3.5 w-3.5 text-emerald-400" /> : <Pause className="h-3.5 w-3.5" />}
            </Button>
          </Tooltip>

          <Tooltip content="Refresh Now" side="bottom">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 bg-card/60 border-border/60 hover:bg-card text-muted-foreground hover:text-foreground"
              onClick={() => fetchLatest()}
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </Tooltip>
        </div>
      </div>

      {/* Top KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Requests per second */}
        <div className="rounded-xl bg-card/65 backdrop-blur-xl border border-border/70 p-3.5 shadow-sm hover:border-border transition-colors">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>Requests / Sec</span>
            <Activity className="h-3.5 w-3.5 text-primary" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-foreground mt-1.5 font-mono">
            {metrics.requestsPerSec.toFixed(1)}
            <span className="text-xs font-normal text-muted-foreground ml-1">rps</span>
          </div>
          <div className="text-[10px] text-muted-foreground mt-1">Live Sampling</div>
        </div>

        {/* Total Sampled */}
        <div className="rounded-xl bg-card/65 backdrop-blur-xl border border-border/70 p-3.5 shadow-sm hover:border-border transition-colors">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>Sampled Volume</span>
            <FileText className="h-3.5 w-3.5 text-sky-400" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-foreground mt-1.5 font-mono">
            {metrics.totalSampled}
            <span className="text-xs font-normal text-muted-foreground ml-1">reqs</span>
          </div>
          <div className="text-[10px] text-muted-foreground mt-1">Recent buffer</div>
        </div>

        {/* Success Rate */}
        <div className="rounded-xl bg-card/65 backdrop-blur-xl border border-border/70 p-3.5 shadow-sm hover:border-border transition-colors">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>Success Rate</span>
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-emerald-400 mt-1.5 font-mono">
            {metrics.successRate.toFixed(1)}%
          </div>
          <div className="text-[10px] text-muted-foreground mt-1">{metrics.status.count2xx} HTTP 2xx</div>
        </div>

        {/* 4xx Client Errors */}
        <div className="rounded-xl bg-card/65 backdrop-blur-xl border border-border/70 p-3.5 shadow-sm hover:border-border transition-colors">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>Client Errors</span>
            <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-amber-400 mt-1.5 font-mono">
            {metrics.status.count4xx}
          </div>
          <div className="text-[10px] text-muted-foreground mt-1">HTTP 4xx (404, etc.)</div>
        </div>

        {/* 5xx Server Errors */}
        <div className="rounded-xl bg-card/65 backdrop-blur-xl border border-border/70 p-3.5 shadow-sm hover:border-border transition-colors">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>Server Errors</span>
            <XCircle className="h-3.5 w-3.5 text-rose-400" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-rose-400 mt-1.5 font-mono">
            {metrics.status.count5xx}
          </div>
          <div className="text-[10px] text-muted-foreground mt-1">HTTP 5xx (500, 502)</div>
        </div>

        {/* Unique Visitors */}
        <div className="rounded-xl bg-card/65 backdrop-blur-xl border border-border/70 p-3.5 shadow-sm hover:border-border transition-colors">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>Unique IPs</span>
            <Users className="h-3.5 w-3.5 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-indigo-400 mt-1.5 font-mono">
            {metrics.topClientIps.length}
          </div>
          <div className="text-[10px] text-muted-foreground mt-1">Distinct visitors</div>
        </div>
      </div>

      {/* Main Real-Time Timeline Chart */}
      <div className="rounded-xl bg-card/65 backdrop-blur-xl border border-border/70 p-4 shadow-sm hover:border-border transition-colors space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-xs text-foreground tracking-tight">
              Real-Time Request Traffic Velocity
            </span>
            <span className="text-[11px] font-mono text-muted-foreground">
              (Requests per second)
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono">
            <span className="flex items-center gap-1.5 text-foreground">
              <span className="h-2 w-2 rounded-full bg-primary" />
              RPS
            </span>
            <span className="flex items-center gap-1.5 text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              2xx
            </span>
            <span className="flex items-center gap-1.5 text-amber-400">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              4xx
            </span>
            <span className="flex items-center gap-1.5 text-rose-400">
              <span className="h-2 w-2 rounded-full bg-rose-400" />
              5xx
            </span>
          </div>
        </div>

        <TrafficSparkline history={history} height={120} />
      </div>

      {/* Two-Column Deep-Dive Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        {/* Left Column: Top Visited Endpoints & Status Breakdown */}
        <div className="space-y-4">
          {/* Top Endpoints Table */}
          <div className="rounded-xl bg-card/65 backdrop-blur-xl border border-border/70 p-4 shadow-sm hover:border-border transition-colors space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-xs text-foreground tracking-tight">
                  Top Visited Endpoints & URLs
                </span>
                <span className="text-[10px] text-muted-foreground font-mono">
                  ({metrics.topEndpoints.length})
                </span>
              </div>

              {/* Quick Search */}
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Filter URLs..."
                  value={urlFilter}
                  onChange={(e) => setUrlFilter(e.target.value)}
                  className="pl-7 pr-2.5 py-1 text-xs rounded-md bg-background/80 border border-border/70 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary w-40 font-mono"
                />
              </div>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {filteredEndpoints.length > 0 ? (
                filteredEndpoints.map((ep, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0 text-xs"
                  >
                    <div className="min-w-0 flex-1 pr-3">
                      <div className="flex items-center gap-1.5 font-mono font-medium text-foreground truncate">
                        <span className="truncate" title={ep.path}>
                          {ep.path}
                        </span>
                        <button
                          onClick={() => handleCopyUrl(ep.path)}
                          className="text-muted-foreground hover:text-foreground p-0.5 rounded opacity-60 hover:opacity-100 transition-opacity"
                          title="Copy Path"
                        >
                          {copiedUrl === ep.path ? (
                            <Check className="h-3 w-3 text-emerald-400" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-muted/40 mt-1.5 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all duration-300"
                          style={{ width: `${Math.min(100, Math.max(2, ep.percent))}%` }}
                        />
                      </div>
                    </div>

                    <div className="text-right font-mono text-xs shrink-0">
                      <div className="font-semibold text-foreground">{ep.count} reqs</div>
                      <div className="text-[10px] text-muted-foreground">{ep.percent.toFixed(1)}%</div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground text-center py-4">No matching endpoints.</p>
              )}
            </div>
          </div>

          {/* HTTP Status Code Breakdown */}
          <div className="rounded-xl bg-card/65 backdrop-blur-xl border border-border/70 p-4 shadow-sm hover:border-border transition-colors space-y-3">
            <span className="font-semibold text-xs text-foreground tracking-tight">
              HTTP Response Status Distribution
            </span>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
              <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-2.5">
                <div className="text-[10px] text-emerald-400/80 uppercase font-sans">2xx Success</div>
                <div className="text-lg font-bold text-emerald-400 mt-1">{metrics.status.count2xx}</div>
                <div className="text-[10px] text-muted-foreground">
                  {metrics.totalSampled > 0
                    ? ((metrics.status.count2xx / metrics.totalSampled) * 100).toFixed(1)
                    : 0}%
                </div>
              </div>

              <div className="rounded-lg bg-sky-500/10 border border-sky-500/20 p-2.5">
                <div className="text-[10px] text-sky-400/80 uppercase font-sans">3xx Redirect</div>
                <div className="text-lg font-bold text-sky-400 mt-1">{metrics.status.count3xx}</div>
                <div className="text-[10px] text-muted-foreground">
                  {metrics.totalSampled > 0
                    ? ((metrics.status.count3xx / metrics.totalSampled) * 100).toFixed(1)
                    : 0}%
                </div>
              </div>

              <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-2.5">
                <div className="text-[10px] text-amber-400/80 uppercase font-sans">4xx Client Err</div>
                <div className="text-lg font-bold text-amber-400 mt-1">{metrics.status.count4xx}</div>
                <div className="text-[10px] text-muted-foreground">
                  {metrics.totalSampled > 0
                    ? ((metrics.status.count4xx / metrics.totalSampled) * 100).toFixed(1)
                    : 0}%
                </div>
              </div>

              <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-2.5">
                <div className="text-[10px] text-rose-400/80 uppercase font-sans">5xx Server Err</div>
                <div className="text-lg font-bold text-rose-400 mt-1">{metrics.status.count5xx}</div>
                <div className="text-[10px] text-muted-foreground">
                  {metrics.totalSampled > 0
                    ? ((metrics.status.count5xx / metrics.totalSampled) * 100).toFixed(1)
                    : 0}%
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Top Client IPs & Live Request Stream */}
        <div className="space-y-4">
          {/* Top Client IPs */}
          <div className="rounded-xl bg-card/65 backdrop-blur-xl border border-border/70 p-4 shadow-sm hover:border-border transition-colors space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-xs text-foreground tracking-tight">
                Top Client Visitor IPs
              </span>
              <span className="text-[10px] font-mono text-muted-foreground">
                ({metrics.topClientIps.length} tracked)
              </span>
            </div>

            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {metrics.topClientIps.map((client, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0 text-xs font-mono"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground w-4">#{idx + 1}</span>
                    <span className="text-foreground font-medium">{client.ip}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">{client.percent.toFixed(1)}%</span>
                    <span className="font-semibold text-primary">{client.count} reqs</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Live Request Stream (Tail) */}
          <div className="rounded-xl bg-card/65 backdrop-blur-xl border border-border/70 p-4 shadow-sm hover:border-border transition-colors space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-xs text-foreground tracking-tight">
                  Live Request Stream Tail
                </span>
                <span className="text-[10px] text-muted-foreground font-mono">
                  (Last {filteredRequests.length})
                </span>
              </div>
              <span className="text-[10px] text-muted-foreground">Auto-updating</span>
            </div>

            <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1 font-mono text-[11px]">
              {filteredRequests.length > 0 ? (
                filteredRequests.map((req, idx) => {
                  const badge = getStatusBadge(req.status);
                  const methodCls = getMethodBadge(req.method);
                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-between py-1 border-b border-border/30 last:border-0 gap-2 hover:bg-muted/20 px-1 rounded transition-colors"
                    >
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${methodCls}`}>
                          {req.method}
                        </span>
                        <span className="truncate text-foreground/90 font-medium" title={req.path}>
                          {req.path}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-muted-foreground text-[10px] hidden sm:inline">
                          {req.clientIp}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border flex items-center gap-1 ${badge.bg}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${badge.dot}`} />
                          {req.status}
                        </span>
                        <span className="text-muted-foreground text-[10px] w-12 text-right">
                          {formatBytes(req.bytesSent)}
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-xs text-muted-foreground text-center py-4">No recent requests recorded.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
