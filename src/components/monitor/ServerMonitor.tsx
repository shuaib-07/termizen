import React, { useEffect, useRef, useState, useId } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Check,
  ChevronUp,
  Copy,
  Cpu,
  Eye,
  EyeOff,
  Globe,
  HardDrive,
  Info,
  Pause,
  Play,
  RefreshCw,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";

// ==========================================
// Smooth Expand / Compress Accordion Wrapper
// ==========================================

function SmoothCollapse({
  isOpen,
  children,
  className = "",
}: {
  isOpen: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <AnimatePresence initial={false}>
      {isOpen && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{
            height: {
              type: "spring",
              stiffness: 380,
              damping: 32,
              mass: 0.6,
            },
            opacity: {
              duration: 0.18,
              ease: "easeOut",
            },
          }}
          className={cn("overflow-hidden", className)}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
import {
  fetchServerMetrics,
  getCachedMetrics,
  setCachedMetrics,
  getCachedMonitorHistory,
  setCachedMonitorHistory,
  fetchWebTraffic,
  getCachedWebTraffic,
} from "@/sessions";
import type { ServerMetrics, DiskDevice, WebTrafficMetrics } from "@/types";

// ==========================================
// Formatting Helpers (Matching ServerBox)
// ==========================================

function formatBytes(bytes: number, decimals = 1): string {
  if (!bytes || bytes <= 0 || isNaN(bytes)) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

function formatBytesServerBox(bytes: number): string {
  if (!bytes || bytes <= 0 || isNaN(bytes)) return "0 B";
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  const kb = bytes / 1024;
  return `${kb.toFixed(0)} KB`;
}

function formatSpeed(bytesPerSec: number): string {
  if (!bytesPerSec || bytesPerSec <= 0 || isNaN(bytesPerSec)) return "0 B/s";
  if (bytesPerSec < 1024) return `${bytesPerSec.toFixed(0)} B/s`;
  if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
  if (bytesPerSec < 1024 * 1024 * 1024) return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
  return `${(bytesPerSec / (1024 * 1024 * 1024)).toFixed(2)} GB/s`;
}

function formatUptimeServerBox(seconds: number): string {
  if (!seconds || seconds <= 0) return "0m";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (days > 0) {
    return `${days} ${days === 1 ? "day" : "days"}, ${hours}:${mins.toString().padStart(2, "0")}`;
  }
  return `${hours}:${mins.toString().padStart(2, "0")}`;
}

// ==========================================
// Circular Percentage Gauge (Mica theme)
// ==========================================

function CircularGauge({
  percent,
  size = 40,
  strokeWidth = 3.5,
  color,
}: {
  percent: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
}) {
  const clamped = Math.min(100, Math.max(0, percent));
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (clamped / 100) * circumference;

  const resolvedColor =
    color ??
    (clamped >= 85
      ? "#ef4444"
      : clamped >= 70
      ? "#f59e0b"
      : "#3b82f6");

  return (
    <div className="relative flex items-center justify-center select-none" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90 transform">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/30 fill-none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={resolvedColor}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="fill-none transition-all duration-500 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-[10px] font-mono font-medium text-foreground">
        {Math.round(clamped)}%
      </div>
    </div>
  );
}

// ==========================================
// Interactive Responsive Line Chart
// (Mica Theme, Crosshair, & Tooltip)
// ==========================================

interface ChartSeries {
  name: string;
  data: number[];
  color: string;
  fillColor?: string;
  fillGradient?: boolean;
}

interface InteractiveChartProps {
  series: ChartSeries[];
  height?: number;
  fixedMin?: number;
  fixedMax?: number;
  autoScale?: boolean;
  yFormatter?: (val: number) => string;
  tooltipPrefix?: string;
}

function InteractiveChart({
  series,
  height = 110,
  fixedMin,
  fixedMax,
  autoScale = false,
  yFormatter = (v) => v.toFixed(0),
  tooltipPrefix,
}: InteractiveChartProps) {
  const chartId = useId().replace(/:/g, "_");
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  // Determine max length across all series
  const dataLength = Math.max(...series.map((s) => s.data.length), 0);

  // Compute Min and Max
  let allVals: number[] = [];
  series.forEach((s) => allVals.push(...s.data));
  if (allVals.length === 0) allVals = [0];

  let rawMin = Math.min(...allVals);
  let rawMax = Math.max(...allVals);

  let min = fixedMin !== undefined ? fixedMin : autoScale ? Math.max(0, rawMin - (rawMax - rawMin) * 0.15) : 0;
  let max = fixedMax !== undefined ? fixedMax : autoScale ? rawMax + (rawMax - rawMin || 1) * 0.15 : Math.max(rawMax * 1.25, 1);

  if (max <= min) max = min + 1;
  const range = max - min || 1;

  // Generate 4 Y-Axis Ticks (Top to Bottom)
  const ticks = [
    max,
    min + range * 0.66,
    min + range * 0.33,
    min,
  ];

  // SVG dimensions
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

  const handleMouseLeave = () => {
    setHoverIndex(null);
  };

  const activeIndex = hoverIndex !== null && hoverIndex < dataLength ? hoverIndex : null;
  const hoverPct = activeIndex !== null && dataLength > 1 ? (activeIndex / (dataLength - 1)) * 100 : null;

  return (
    <div className="flex w-full items-stretch gap-2 select-none">
      {/* Y-Axis Ticks */}
      <div className="flex flex-col justify-between text-[10px] font-mono text-muted-foreground py-1 w-14 text-right shrink-0">
        {ticks.map((t, i) => (
          <span key={i} className="truncate">
            {yFormatter(t)}
          </span>
        ))}
      </div>

      {/* Chart Canvas & Hover Plane */}
      <div
        ref={containerRef}
        className="relative flex-1 cursor-crosshair overflow-visible"
        style={{ height }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          preserveAspectRatio="none"
          className="w-full h-full block overflow-visible"
        >
          <defs>
            {series.map((s, idx) => (
              <linearGradient
                key={idx}
                id={`grad_${chartId}_${idx}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor={s.color} stopOpacity="0.22" />
                <stop offset="100%" stopColor={s.color} stopOpacity="0.0" />
              </linearGradient>
            ))}
          </defs>

          {/* Subtle Grid lines */}
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

          {/* Lines and Gradient Fills */}
          {series.map((s, idx) => {
            if (s.data.length < 2) return null;

            // Generate Path
            const points = s.data.map((val, i) => `${getX(i).toFixed(1)},${getY(val).toFixed(1)}`);
            const linePath = `M ${points.join(" L ")}`;
            const fillPath = `${linePath} L ${svgWidth},${svgHeight} L 0,${svgHeight} Z`;

            return (
              <g key={idx}>
                {s.fillGradient && (
                  <path d={fillPath} fill={`url(#grad_${chartId}_${idx})`} />
                )}
                <path
                  d={linePath}
                  fill="none"
                  stroke={s.color}
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </g>
            );
          })}
        </svg>

        {/* Hover Crosshair, Dots, & Floating Tooltip */}
        {activeIndex !== null && hoverPct !== null && (
          <>
            {/* Clean Vertical Guideline (Strictly no neon glow per design.md §3b) */}
            <div
              className="absolute top-0 bottom-0 pointer-events-none w-[1.5px] bg-primary/80 z-10"
              style={{ left: `${hoverPct}%` }}
            />

            {/* Glowing Points */}
            {series.map((s, idx) => {
              const val = s.data[activeIndex] ?? 0;
              const yNorm = Math.max(0, Math.min(1, (val - min) / range));
              const yPx = height - padBottom - yNorm * plotH;

              return (
                <div
                  key={idx}
                  className="absolute w-2.5 h-2.5 -ml-[5px] -mt-[5px] rounded-full border-2 border-background pointer-events-none shadow-xs z-20"
                  style={{
                    left: `${hoverPct}%`,
                    top: `${yPx}px`,
                    backgroundColor: s.color,
                  }}
                />
              );
            })}

            {/* Floating Tooltip Pill (Mica styled - positioned inside chart canvas to never clip) */}
            {(() => {
              const dotYPositions = series.map((s) => {
                const val = s.data[activeIndex] ?? 0;
                const yNorm = Math.max(0, Math.min(1, (val - min) / range));
                return height - padBottom - yNorm * plotH;
              });
              const minDotY = Math.min(...dotYPositions);
              const maxDotY = Math.max(...dotYPositions);

              // If there's enough room above the highest dot (>= 34px), place tooltip above it.
              // Otherwise place tooltip below the lowest dot so it is always completely visible.
              const topPx = minDotY >= 34
                ? minDotY - 30
                : Math.min(height - 28, maxDotY + 12);

              return (
                <div
                  className="absolute pointer-events-none z-30 transform -translate-x-1/2 px-2.5 py-1 rounded-lg bg-popover/95 backdrop-blur-xl border border-border text-[11px] font-mono text-popover-foreground shadow-lg flex items-center gap-2 whitespace-nowrap transition-all duration-75"
                  style={{
                    left: `${Math.max(16, Math.min(84, hoverPct))}%`,
                    top: `${Math.max(4, Math.min(height - 28, topPx))}px`,
                  }}
                >
                  {tooltipPrefix && <span className="text-muted-foreground">{tooltipPrefix}</span>}
                  {series.map((s, idx) => {
                    const val = s.data[activeIndex] ?? 0;
                    return (
                      <span key={idx} className="flex items-center gap-1 font-semibold" style={{ color: s.color }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.color }} />
                        {series.length > 1 && <span className="text-muted-foreground font-normal">{s.name}:</span>}
                        {yFormatter(val)}
                      </span>
                    );
                  })}
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
// Main ServerMonitor Component (Mica Theme)
// ==========================================

export default function ServerMonitor({
  profileId,
  serverName,
  host,
  onNavigateSubView,
}: {
  profileId: number;
  serverName?: string;
  host?: string;
  onNavigateSubView?: (subView: "terminal" | "monitor" | "traffic" | "logs" | "macros") => void;
}) {
  const cached = getCachedMetrics(profileId);
  const cachedHistory = getCachedMonitorHistory(profileId);

  const [metrics, setMetrics] = useState<ServerMetrics | null>(() => cached ?? null);
  const [loading, setLoading] = useState(() => !cached);
  const [error, setError] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);

  const [webTraffic, setWebTraffic] = useState<WebTrafficMetrics | null>(() => getCachedWebTraffic(profileId) ?? null);
  const [isWebTrafficOpen, setIsWebTrafficOpen] = useState(true);

  // History buffers for high-density charts (last 36 samples = ~72 seconds)
  const [cpuHistory, setCpuHistory] = useState<number[]>(() => cachedHistory?.cpu ?? []);
  const [ramHistory, setRamHistory] = useState<number[]>(() => cachedHistory?.ram ?? []);
  const [rxHistory, setRxHistory] = useState<number[]>(() => cachedHistory?.rx ?? []);
  const [txHistory, setTxHistory] = useState<number[]>(() => cachedHistory?.tx ?? []);
  const [diskReadHistory, setDiskReadHistory] = useState<number[]>(() => cachedHistory?.diskRead ?? []);
  const [diskWriteHistory, setDiskWriteHistory] = useState<number[]>(() => cachedHistory?.diskWrite ?? []);

  // UI Expand / Collapse states
  const [isAboutOpen, setIsAboutOpen] = useState(true);
  const [isCpuOpen, setIsCpuOpen] = useState(true);
  const [isRamOpen, setIsRamOpen] = useState(true);
  const [isDiskOpen, setIsDiskOpen] = useState(true);
  const [isDiskDevicesOpen, setIsDiskDevicesOpen] = useState(true);
  const [isNetworkOpen, setIsNetworkOpen] = useState(true);
  const [isNetworkDevicesOpen, setIsNetworkDevicesOpen] = useState(false);

  // Security & Clipboard
  const [showPublicIp, setShowPublicIp] = useState(false);
  const [copiedIp, setCopiedIp] = useState(false);

  const copyPublicIp = () => {
    const ip = metrics?.host.publicIp || host || "";
    if (!ip) return;
    navigator.clipboard.writeText(ip).then(() => {
      setCopiedIp(true);
      setTimeout(() => setCopiedIp(false), 2000);
    });
  };

  const fetchLatest = async () => {
    try {
      fetchServerMetrics(profileId).then((data) => {
        setMetrics(data);
        setCachedMetrics(profileId, data);
        setError(null);

        const ramPercent = (data.memory.usedBytes / (data.memory.totalBytes || 1)) * 100;
        const dRead = data.disk.readBytesSec ?? 0;
        const dWrite = data.disk.writeBytesSec ?? 0;

        setCpuHistory((prevCpu) => {
          const nextCpu = [...prevCpu.slice(-35), data.cpu.overall];
          setRamHistory((prevRam) => {
            const nextRam = [...prevRam.slice(-35), ramPercent];
            setRxHistory((prevRx) => {
              const nextRx = [...prevRx.slice(-35), data.network.rxBytesSec];
              setTxHistory((prevTx) => {
                const nextTx = [...prevTx.slice(-35), data.network.txBytesSec];
                setDiskReadHistory((prevDr) => {
                  const nextDr = [...prevDr.slice(-35), dRead];
                  setDiskWriteHistory((prevDw) => {
                    const nextDw = [...prevDw.slice(-35), dWrite];
                    setCachedMonitorHistory(profileId, {
                      cpu: nextCpu,
                      ram: nextRam,
                      rx: nextRx,
                      tx: nextTx,
                      diskRead: nextDr,
                      diskWrite: nextDw,
                    });
                    return nextDw;
                  });
                  return nextDr;
                });
                return nextTx;
              });
              return nextRx;
            });
            return nextRam;
          });
          return nextCpu;
        });
      }).catch((e: any) => {
        setError(String(e?.message || e));
      }).finally(() => {
        setLoading(false);
      });

      fetchWebTraffic(profileId)
        .then((traffic) => {
          if (traffic) setWebTraffic(traffic);
        })
        .catch(() => {});
    } catch (e: any) {
      setError(String(e?.message || e));
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    fetchLatest();

    const interval = setInterval(() => {
      if (!isPaused && mounted) {
        fetchLatest();
      }
    }, 2000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [profileId, isPaused]);

  if (loading && !metrics) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-muted-foreground bg-transparent">
        <Activity className="h-8 w-8 animate-pulse text-primary" />
        <p className="text-sm">Connecting & gathering real-time metrics...</p>
      </div>
    );
  }

  if (error && !metrics) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center bg-transparent">
        <AlertCircle className="h-10 w-10 text-destructive" />
        <div className="max-w-md space-y-1">
          <h3 className="font-semibold text-foreground">Failed to connect for metrics</h3>
          <p className="text-xs text-muted-foreground break-all">{error}</p>
        </div>
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
      </div>
    );
  }

  if (!metrics) return null;

  // Compute calculated metrics
  const ramPercent = Math.round((metrics.memory.usedBytes / (metrics.memory.totalBytes || 1)) * 100);
  const freeRamPercent = (metrics.memory.freeBytes / (metrics.memory.totalBytes || 1)) * 100;
  const availRamPercent = (metrics.memory.availableBytes / (metrics.memory.totalBytes || 1)) * 100;

  const userCpu = metrics.cpu.userPercent ?? 0;
  const idleCpu = metrics.cpu.idlePercent ?? 0;
  const sysCpu = metrics.cpu.systemPercent ?? 0;
  const ioCpu = metrics.cpu.iowaitPercent ?? 0;

  const currentDiskRead = metrics.disk.readBytesSec ?? 0;
  const currentDiskWrite = metrics.disk.writeBytesSec ?? 0;

  const devices: DiskDevice[] = metrics.disk.devices && metrics.disk.devices.length > 0
    ? metrics.disk.devices
    : [
        {
          device: "/dev/sda1",
          mountPoint: metrics.disk.mountPoint || "/",
          totalBytes: metrics.disk.totalBytes,
          usedBytes: metrics.disk.usedBytes,
          freeBytes: metrics.disk.freeBytes,
          usedPercent: metrics.disk.usedPercent,
        },
      ];

  const interfaces = metrics.network.interfaces && metrics.network.interfaces.length > 0
    ? metrics.network.interfaces
    : [
        {
          name: metrics.network.interface || "eth0",
          rxBytesSec: metrics.network.rxBytesSec,
          txBytesSec: metrics.network.txBytesSec,
          totalRxBytes: metrics.network.totalRxBytes,
          totalTxBytes: metrics.network.totalTxBytes,
        },
      ];

  const publicIpValue = metrics.host.publicIp || host || "Unknown";

  return (
    <div className="h-full overflow-y-auto bg-transparent text-foreground p-4 md:p-5 space-y-4 select-none font-sans">
      {/* Top Header: Server name and live controls */}
      <div className="flex items-center justify-between pb-1">
        <div className="w-24" /> {/* Centering spacer */}
        <div className="text-center">
          <h1 className="text-lg font-bold tracking-tight text-foreground">
            {serverName || metrics.host.hostname}
          </h1>
        </div>
        <div className="flex items-center gap-1.5">
          <Tooltip content={isPaused ? "Resume Polling" : "Pause Polling"} side="bottom">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7 bg-card/60 border-border/60 hover:bg-card text-muted-foreground hover:text-foreground"
              onClick={() => setIsPaused((p) => !p)}
            >
              {isPaused ? <Play className="h-3.5 w-3.5 text-emerald-400" /> : <Pause className="h-3.5 w-3.5" />}
            </Button>
          </Tooltip>
          <Tooltip content="Refresh Now" side="bottom">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7 bg-card/60 border-border/60 hover:bg-card text-muted-foreground hover:text-foreground"
              onClick={fetchLatest}
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </Tooltip>
        </div>
      </div>

      {/* Main 3-Column Floating Cards Grid over Mica backdrop */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
        {/* ==================================================== */}
        {/* COLUMN 1: About Card & Disk Card                    */}
        {/* ==================================================== */}
        <div className="space-y-4">
          {/* About Card */}
          <motion.div
            layout
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            className="rounded-xl bg-card/65 backdrop-blur-xl border border-border/70 p-4 shadow-sm hover:border-border transition-colors"
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2.5">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
                  <Info className="h-3.5 w-3.5" />
                </div>
                <span className="font-semibold text-xs text-foreground tracking-tight">About</span>
              </div>
              <button
                onClick={() => setIsAboutOpen((o) => !o)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted/40 transition-colors"
                title={isAboutOpen ? "Collapse" : "Expand"}
              >
                <motion.div
                  animate={{ rotate: isAboutOpen ? 0 : 180 }}
                  transition={{ type: "spring", stiffness: 360, damping: 24 }}
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </motion.div>
              </button>
            </div>

            <SmoothCollapse isOpen={isAboutOpen}>
              <div className="space-y-2.5 text-xs pt-2.5">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">System</span>
                  <span className="text-foreground font-medium">{metrics.host.osName}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Host</span>
                  <span className="text-foreground font-mono font-medium">{metrics.host.hostname}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Uptime</span>
                  <span className="text-foreground font-medium">
                    {formatUptimeServerBox(metrics.host.uptimeSeconds)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Public IP</span>
                  <div className="flex items-center gap-1.5 font-mono text-foreground">
                    <span>
                      {showPublicIp ? publicIpValue : "•••••••••••••"}
                    </span>
                    <button
                      onClick={() => setShowPublicIp((v) => !v)}
                      className="p-1 text-muted-foreground hover:text-primary transition-colors"
                      title={showPublicIp ? "Hide IP" : "Reveal IP"}
                    >
                      {showPublicIp ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                    {showPublicIp && (
                      <button
                        onClick={copyPublicIp}
                        className="p-1 text-muted-foreground hover:text-emerald-400 transition-colors"
                        title="Copy IP"
                      >
                        {copiedIp ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </SmoothCollapse>
          </motion.div>

          {/* Disk Card */}
          <motion.div
            layout
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            className="rounded-xl bg-card/65 backdrop-blur-xl border border-border/70 p-4 shadow-sm hover:border-border transition-colors"
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2.5">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
                  <HardDrive className="h-3.5 w-3.5" />
                </div>
                <span className="font-semibold text-xs text-foreground tracking-tight">Disk</span>
              </div>
              <button
                onClick={() => setIsDiskOpen((o) => !o)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted/40 transition-colors"
                title={isDiskOpen ? "Collapse" : "Expand"}
              >
                <motion.div
                  animate={{ rotate: isDiskOpen ? 0 : 180 }}
                  transition={{ type: "spring", stiffness: 360, damping: 24 }}
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </motion.div>
              </button>
            </div>

            <SmoothCollapse isOpen={isDiskOpen}>
              <div className="space-y-4 pt-2">
                {/* Real-time Dual-Line Chart: Read (Sky Blue) & Write (Amber) */}
                <InteractiveChart
                  series={[
                    {
                      name: "Read",
                      data: diskReadHistory.length > 1 ? diskReadHistory : [0, currentDiskRead],
                      color: "#38bdf8", // Sky Blue
                    },
                    {
                      name: "Write",
                      data: diskWriteHistory.length > 1 ? diskWriteHistory : [0, currentDiskWrite],
                      color: "#f59e0b", // Amber
                    },
                  ]}
                  height={100}
                  yFormatter={formatSpeed}
                />

                {/* Legend */}
                <div className="flex items-center gap-4 text-xs font-mono">
                  <span className="flex items-center gap-1.5 text-foreground/90">
                    <span className="h-2 w-2 rounded-full bg-[#38bdf8]" />
                    Read {formatSpeed(currentDiskRead)}
                  </span>
                  <span className="flex items-center gap-1.5 text-foreground/90">
                    <span className="h-2 w-2 rounded-full bg-[#f59e0b]" />
                    Write {formatSpeed(currentDiskWrite)}
                  </span>
                </div>

                {/* Collapsible Device List */}
                <div className="border-t border-border/40 pt-3">
                  <div
                    className="flex items-center justify-between cursor-pointer text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors py-1"
                    onClick={() => setIsDiskDevicesOpen((o) => !o)}
                  >
                    <span>Device</span>
                    <motion.div
                      animate={{ rotate: isDiskDevicesOpen ? 0 : 180 }}
                      transition={{ type: "spring", stiffness: 360, damping: 24 }}
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </motion.div>
                  </div>

                  <SmoothCollapse isOpen={isDiskDevicesOpen}>
                    <div className="mt-2 space-y-3">
                      {devices.map((dev, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0"
                        >
                          <div className="space-y-0.5 min-w-0 pr-2">
                            <div className="text-xs font-medium text-foreground truncate">
                              {dev.device} ({dev.mountPoint})
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              Used {formatBytes(dev.usedBytes)} / {formatBytes(dev.totalBytes)}
                            </div>
                            <div className="text-[10px] text-muted-foreground/80 font-mono">
                              Read {formatSpeed(currentDiskRead)} | Write {formatSpeed(currentDiskWrite)}
                            </div>
                          </div>
                          <div className="shrink-0">
                            <CircularGauge
                              percent={dev.usedPercent}
                              size={40}
                              strokeWidth={3.5}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </SmoothCollapse>
                </div>
              </div>
            </SmoothCollapse>
          </motion.div>
        </div>

        {/* ==================================================== */}
        {/* COLUMN 2: CPU Card & Network Card                   */}
        {/* ==================================================== */}
        <div className="space-y-4">
          {/* CPU Card */}
          <motion.div
            layout
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            className="rounded-xl bg-card/65 backdrop-blur-xl border border-border/70 p-4 shadow-sm hover:border-border transition-colors"
          >
            {/* Top header with large % and user/idle/sys/io breakdown */}
            <div className="flex items-start justify-between mb-1">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
                  <Cpu className="h-3.5 w-3.5" />
                </div>
                <div className="text-2xl font-bold tracking-tight text-foreground">
                  {metrics.cpu.overall.toFixed(0)}%
                </div>
              </div>
              <div className="flex items-center gap-3 text-right">
                <div>
                  <div className="text-xs font-mono font-medium text-foreground">
                    {userCpu.toFixed(1)}%
                  </div>
                  <div className="text-[10px] text-muted-foreground uppercase">user</div>
                </div>
                <div>
                  <div className="text-xs font-mono font-medium text-foreground">
                    {idleCpu.toFixed(1)}%
                  </div>
                  <div className="text-[10px] text-muted-foreground uppercase">idle</div>
                </div>
                <div>
                  <div className="text-xs font-mono font-medium text-foreground">
                    {sysCpu.toFixed(1)}%
                  </div>
                  <div className="text-[10px] text-muted-foreground uppercase">sys</div>
                </div>
                <div>
                  <div className="text-xs font-mono font-medium text-foreground">
                    {ioCpu.toFixed(1)}%
                  </div>
                  <div className="text-[10px] text-muted-foreground uppercase">io</div>
                </div>
                <button
                  onClick={() => setIsCpuOpen((o) => !o)}
                  className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted/40 transition-colors ml-1"
                  title={isCpuOpen ? "Collapse" : "Expand"}
                >
                  <motion.div
                    animate={{ rotate: isCpuOpen ? 0 : 180 }}
                    transition={{ type: "spring", stiffness: 360, damping: 24 }}
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </motion.div>
                </button>
              </div>
            </div>

            <SmoothCollapse isOpen={isCpuOpen}>
              <div className="space-y-3 pt-2">
                {/* Interactive CPU Line Chart with Tooltip */}
                <InteractiveChart
                  series={[
                    {
                      name: "CPU",
                      data: cpuHistory.length > 1 ? cpuHistory : [0, metrics.cpu.overall],
                      color: "#3b82f6", // Termizen Primary Electric Blue
                      fillGradient: true,
                    },
                  ]}
                  height={110}
                  yFormatter={(v) => `${v.toFixed(0)}%`}
                  tooltipPrefix="CPU"
                />

                {/* Footer: CPU Model and Core count */}
                <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/40">
                  <span className="truncate max-w-[220px]" title={metrics.cpu.modelName}>
                    {metrics.cpu.modelName || "Processor"}
                  </span>
                  <span className="font-mono text-foreground font-medium">
                    x {metrics.cpu.cores.length || 1}
                  </span>
                </div>
              </div>
            </SmoothCollapse>
          </motion.div>

          {/* Network Card */}
          <motion.div
            layout
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            className="rounded-xl bg-card/65 backdrop-blur-xl border border-border/70 p-4 shadow-sm hover:border-border transition-colors"
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2.5">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
                  <Globe className="h-3.5 w-3.5" />
                </div>
                <span className="font-semibold text-xs text-foreground tracking-tight">Network</span>
                <span className="text-xs text-muted-foreground flex items-center gap-1 ml-1">
                  <SlidersHorizontal className="h-3 w-3" /> device
                </span>
              </div>
              <button
                onClick={() => setIsNetworkOpen((o) => !o)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted/40 transition-colors"
                title={isNetworkOpen ? "Collapse" : "Expand"}
              >
                <motion.div
                  animate={{ rotate: isNetworkOpen ? 0 : 180 }}
                  transition={{ type: "spring", stiffness: 360, damping: 24 }}
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </motion.div>
              </button>
            </div>

            <SmoothCollapse isOpen={isNetworkOpen}>
              <div className="space-y-4 pt-2">
                {/* Dual-Line Bandwidth Chart: Download (Sky Blue) & Upload (Indigo) */}
                <InteractiveChart
                  series={[
                    {
                      name: "↓",
                      data: rxHistory.length > 1 ? rxHistory : [0, metrics.network.rxBytesSec],
                      color: "#38bdf8", // Sky Blue
                    },
                    {
                      name: "↑",
                      data: txHistory.length > 1 ? txHistory : [0, metrics.network.txBytesSec],
                      color: "#818cf8", // Indigo
                    },
                  ]}
                  height={100}
                  yFormatter={formatSpeed}
                />

                {/* Legend */}
                <div className="flex items-center gap-4 text-xs font-mono">
                  <span className="flex items-center gap-1.5 text-foreground/90">
                    <span className="h-2 w-2 rounded-full bg-[#38bdf8]" />
                    ↓ {formatSpeed(metrics.network.rxBytesSec)}
                  </span>
                  <span className="flex items-center gap-1.5 text-foreground/90">
                    <span className="h-2 w-2 rounded-full bg-[#818cf8]" />
                    ↑ {formatSpeed(metrics.network.txBytesSec)}
                  </span>
                </div>

                {/* Collapsible Network Device List */}
                <div className="border-t border-border/40 pt-3">
                  <div
                    className="flex items-center justify-between cursor-pointer text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors py-1"
                    onClick={() => setIsNetworkDevicesOpen((o) => !o)}
                  >
                    <span>Device</span>
                    <motion.div
                      animate={{ rotate: isNetworkDevicesOpen ? 0 : 180 }}
                      transition={{ type: "spring", stiffness: 360, damping: 24 }}
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </motion.div>
                  </div>

                  <SmoothCollapse isOpen={isNetworkDevicesOpen}>
                    <div className="mt-2 space-y-2.5">
                      {interfaces.map((iface, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0 text-xs"
                        >
                          <div>
                            <div className="font-mono font-medium text-foreground">{iface.name}</div>
                            <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                              Total: ↓ {formatBytes(iface.totalRxBytes)} | ↑ {formatBytes(iface.totalTxBytes)}
                            </div>
                          </div>
                          <div className="text-right font-mono text-[11px]">
                            <div className="text-sky-400">↓ {formatSpeed(iface.rxBytesSec)}</div>
                            <div className="text-indigo-400">↑ {formatSpeed(iface.txBytesSec)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </SmoothCollapse>
                </div>
              </div>
            </SmoothCollapse>
          </motion.div>
        </div>

        {/* ==================================================== */}
        {/* COLUMN 3: Memory Card                               */}
        {/* ==================================================== */}
        <div className="space-y-4">
          {/* Memory Card */}
          <motion.div
            layout
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            className="rounded-xl bg-card/65 backdrop-blur-xl border border-border/70 p-4 shadow-sm hover:border-border transition-colors"
          >
            {/* Top header with large % of Total, and free/avail breakdown */}
            <div className="flex items-start justify-between mb-1">
              <div className="text-2xl font-bold tracking-tight text-foreground flex items-baseline gap-1.5">
                {ramPercent}%
                <span className="text-xs font-normal text-muted-foreground">
                  of {formatBytesServerBox(metrics.memory.totalBytes)}
                </span>
              </div>
              <div className="flex items-center gap-3 text-right">
                <div>
                  <div className="text-xs font-mono font-medium text-foreground">
                    {freeRamPercent.toFixed(1)}%
                  </div>
                  <div className="text-[10px] text-muted-foreground uppercase">free</div>
                </div>
                <div>
                  <div className="text-xs font-mono font-medium text-foreground">
                    {availRamPercent.toFixed(1)}%
                  </div>
                  <div className="text-[10px] text-muted-foreground uppercase">avail</div>
                </div>
                <button
                  onClick={() => setIsRamOpen((o) => !o)}
                  className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted/40 transition-colors ml-1"
                  title={isRamOpen ? "Collapse" : "Expand"}
                >
                  <motion.div
                    animate={{ rotate: isRamOpen ? 0 : 180 }}
                    transition={{ type: "spring", stiffness: 360, damping: 24 }}
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </motion.div>
                </button>
              </div>
            </div>

            <SmoothCollapse isOpen={isRamOpen}>
              <div className="space-y-3 pt-2">
                {/* Auto-scaled Interactive Green RAM Chart */}
                <InteractiveChart
                  series={[
                    {
                      name: "RAM",
                      data: ramHistory.length > 1 ? ramHistory : [0, ramPercent],
                      color: "#10b981", // Emerald
                      fillGradient: true,
                    },
                  ]}
                  height={110}
                  autoScale={true}
                  yFormatter={(v) => `${v.toFixed(1)}%`}
                  tooltipPrefix="RAM"
                />

                {/* Additional Memory & Swap Details */}
                <div className="pt-2 border-t border-border/40 space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cached / Buffers</span>
                    <span className="font-mono text-foreground">
                      {formatBytes(metrics.memory.cachedBytes)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Swap</span>
                    <span className="font-mono text-foreground">
                      {metrics.memory.swapTotalBytes > 0
                        ? `${formatBytes(metrics.memory.swapUsedBytes)} / ${formatBytes(metrics.memory.swapTotalBytes)}`
                        : "None"}
                    </span>
                  </div>
                </div>
              </div>
            </SmoothCollapse>
          </motion.div>

          {/* Web Traffic Summary Card */}
          <motion.div
            layout
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            className="rounded-xl bg-card/65 backdrop-blur-xl border border-border/70 p-4 shadow-sm hover:border-border transition-colors"
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2.5">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  <Globe className="h-3.5 w-3.5" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-xs text-foreground tracking-tight">Web Traffic</span>
                  {webTraffic?.activeLogPath && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/25">
                      {webTraffic.requestsPerSec.toFixed(1)} req/s
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setIsWebTrafficOpen((o) => !o)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted/40 transition-colors"
                title={isWebTrafficOpen ? "Collapse" : "Expand"}
              >
                <motion.div
                  animate={{ rotate: isWebTrafficOpen ? 0 : 180 }}
                  transition={{ type: "spring", stiffness: 360, damping: 24 }}
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </motion.div>
              </button>
            </div>

            <SmoothCollapse isOpen={isWebTrafficOpen}>
              <div className="space-y-3 pt-2 text-xs">
                {webTraffic && webTraffic.activeLogPath ? (
                  <>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-lg bg-white/[0.02] border border-border/40 p-2 text-center">
                        <div className="text-[10px] text-muted-foreground font-medium uppercase">Current</div>
                        <div className="text-sm font-bold font-mono text-cyan-400 mt-0.5">
                          {webTraffic.requestsPerSec.toFixed(1)}
                        </div>
                        <div className="text-[9px] text-muted-foreground/80">req/sec</div>
                      </div>
                      <div className="rounded-lg bg-white/[0.02] border border-border/40 p-2 text-center">
                        <div className="text-[10px] text-muted-foreground font-medium uppercase">Success</div>
                        <div className="text-sm font-bold font-mono text-emerald-400 mt-0.5">
                          {webTraffic.successRate.toFixed(0)}%
                        </div>
                        <div className="text-[9px] text-muted-foreground/80">{webTraffic.status.count2xx} ok</div>
                      </div>
                      <div className="rounded-lg bg-white/[0.02] border border-border/40 p-2 text-center">
                        <div className="text-[10px] text-muted-foreground font-medium uppercase">Errors</div>
                        <div className="text-sm font-bold font-mono text-amber-400 mt-0.5">
                          {webTraffic.status.count4xx + webTraffic.status.count5xx}
                        </div>
                        <div className="text-[9px] text-muted-foreground/80">4xx / 5xx</div>
                      </div>
                    </div>

                    {webTraffic.topEndpoints.length > 0 && (
                      <div className="pt-2 border-t border-border/40 space-y-1">
                        <div className="text-[11px] font-medium text-muted-foreground flex justify-between">
                          <span>Top Visited Endpoint</span>
                          <span className="font-mono text-foreground font-semibold">{webTraffic.topEndpoints[0].count} hits</span>
                        </div>
                        <div className="font-mono text-[11px] text-foreground/90 truncate bg-white/[0.03] px-2 py-1 rounded border border-border/30">
                          {webTraffic.topEndpoints[0].path}
                        </div>
                      </div>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-xs h-7 gap-1.5 mt-1 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border-cyan-500/30"
                      onClick={() => onNavigateSubView?.("traffic")}
                    >
                      <span>Deep Dive Traffic & Endpoints</span>
                      <ArrowRight className="h-3 w-3" />
                    </Button>
                  </>
                ) : (
                  <div className="space-y-2.5 py-1 text-center">
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Track real-time requests/sec, top endpoints, client visitor IPs, and HTTP status codes over SSH.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-xs h-7 gap-1.5 bg-card/80 hover:bg-card border-border/60 text-foreground"
                      onClick={() => onNavigateSubView?.("traffic")}
                    >
                      <Globe className="h-3 w-3 text-cyan-400" />
                      <span>Configure Web Traffic</span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    </Button>
                  </div>
                )}
              </div>
            </SmoothCollapse>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
