import { useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDownCircle,
  Clock,
  Columns,
  FileText,
  Layers,
  Play,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Square,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Shimmer } from "@/components/ui/shimmer";
import { Tooltip } from "@/components/ui/tooltip";
import { AnimatedBadge } from "@/components/AnimatedBadge";
import { DirectionAwareTabs, type Tab } from "@/components/ui/direction-aware-tabs";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  deleteProfileService,
  discoverServices,
  listProfileServices,
  saveProfileService,
  setProfileServicePaused,
  startLogStream,
  stopLogStream,
} from "@/sessions";
import type { DiscoveredService, ProfileService } from "@/types";

// High performance ANSI color parser
function parseAnsi(text: string) {
  const ansiRegex = /\u001b\[([0-9;]*)m/g;
  const parts = [];
  let lastIndex = 0;
  let currentColor = "";
  let isBold = false;
  let isDim = false;

  let match;
  while ((match = ansiRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({
        text: text.substring(lastIndex, match.index),
        color: currentColor,
        bold: isBold,
        dim: isDim,
      });
    }

    const codes = match[1].split(";").map(Number);
    for (const code of codes) {
      if (code === 0) {
        currentColor = "";
        isBold = false;
        isDim = false;
      } else if (code === 1) isBold = true;
      else if (code === 2) isDim = true;
      else if (code === 30) currentColor = "text-zinc-500";
      else if (code === 31) currentColor = "text-red-400";
      else if (code === 32) currentColor = "text-emerald-400";
      else if (code === 33) currentColor = "text-amber-400";
      else if (code === 34) currentColor = "text-blue-400";
      else if (code === 35) currentColor = "text-purple-400";
      else if (code === 36) currentColor = "text-cyan-400";
      else if (code === 37) currentColor = "text-zinc-200";
      else if (code === 90) currentColor = "text-zinc-500";
      else if (code === 91) currentColor = "text-red-300";
      else if (code === 92) currentColor = "text-emerald-300";
      else if (code === 93) currentColor = "text-amber-300";
      else if (code === 94) currentColor = "text-blue-300";
      else if (code === 95) currentColor = "text-purple-300";
      else if (code === 96) currentColor = "text-cyan-300";
      else if (code === 97) currentColor = "text-white";
    }
    lastIndex = ansiRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push({
      text: text.substring(lastIndex),
      color: currentColor,
      bold: isBold,
      dim: isDim,
    });
  }

  return parts;
}

export interface LogEntry {
  id: number;
  raw: string;
  time: string;
  fullDate: string;
  text: string;
}

let nextLogId = 1;

function parseLogEntry(rawLine: string, fallbackDate: Date = new Date()): LogEntry {
  let text = rawLine;
  let timeStr = "";
  let fullDateStr = "";

  // 1. Strip PM2 app prefix if present (e.g. "0|zoopify-backend | " or "[PM2] ")
  const pm2PrefixMatch = text.match(/^(\d+\|[^|]+\|\s*|\[PM2\]\s*)/);
  if (pm2PrefixMatch) {
    text = text.slice(pm2PrefixMatch[0].length);
  }

  // 2. Match standard ISO date-time e.g. "2026-09-07T01:15:30.123Z" or "2026-09-07 01:15:30:"
  const isoMatch = text.match(/^\[?(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)\]?:?\s*(.*)$/);
  if (isoMatch) {
    const rawTime = isoMatch[1];
    fullDateStr = rawTime.replace("T", " ");
    const tIdx = rawTime.indexOf("T");
    if (tIdx !== -1) {
      timeStr = rawTime.slice(tIdx + 1, tIdx + 9);
    } else {
      const spaceIdx = rawTime.indexOf(" ");
      timeStr = spaceIdx !== -1 ? rawTime.slice(spaceIdx + 1, spaceIdx + 9) : rawTime.slice(0, 8);
    }
    text = isoMatch[2];
  } else {
    // 3. Match time only [HH:mm:ss] or HH:mm:ss:
    const timeMatch = text.match(/^\[?(\d{2}:\d{2}:\d{2}(?:\.\d{3})?)\]?:?\s*(.*)$/);
    if (timeMatch) {
      timeStr = timeMatch[1].slice(0, 8);
      const datePart = fallbackDate.toISOString().slice(0, 10);
      fullDateStr = `${datePart} ${timeStr}`;
      text = timeMatch[2];
    } else {
      // 4. Fallback to live stream arrival time
      const h = String(fallbackDate.getHours()).padStart(2, "0");
      const m = String(fallbackDate.getMinutes()).padStart(2, "0");
      const s = String(fallbackDate.getSeconds()).padStart(2, "0");
      timeStr = `${h}:${m}:${s}`;
      const year = fallbackDate.getFullYear();
      const month = String(fallbackDate.getMonth() + 1).padStart(2, "0");
      const day = String(fallbackDate.getDate()).padStart(2, "0");
      fullDateStr = `${year}-${month}-${day} ${timeStr}`;
    }
  }

  return {
    id: nextLogId++,
    raw: rawLine,
    time: timeStr,
    fullDate: fullDateStr,
    text: text,
  };
}

function LogConsole({
  service,
  profileId,
  isVisible = true,
  isPaused,
  onTogglePause,
  onRemoveService,
}: {
  service: ProfileService;
  profileId: number;
  isVisible?: boolean;
  isPaused: boolean;
  onTogglePause?: (paused: boolean) => void;
  onRemoveService?: (id: number) => void;
}) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [showTimestamps, setShowTimestamps] = useState(true);
  const [hasExited, setHasExited] = useState(false);
  const isStreaming = !isPaused && !hasExited;
  const [isConnecting, setIsConnecting] = useState(isStreaming);
  const [search, setSearch] = useState("");
  const [filterLevel, setFilterLevel] = useState<"all" | "error" | "warn">("all");
  const [autoScroll, setAutoScroll] = useState(true);
  const streamIdRef = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isJustVisibleRef = useRef(false);

  useEffect(() => {
    if (!isPaused) {
      setHasExited(false);
    }
  }, [isPaused]);

  const scrollToBottom = (behavior: ScrollBehavior = "instant") => {
    if (scrollRef.current) {
      if (behavior === "smooth") {
        scrollRef.current.scrollTo({
          top: scrollRef.current.scrollHeight,
          behavior: "smooth",
        });
      } else {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }
  };

  // Scroll to bottom immediately when this console becomes visible (e.g. switching service tabs)
  useEffect(() => {
    if (isVisible) {
      isJustVisibleRef.current = true;
      setAutoScroll(true);

      const doScroll = () => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      };

      // Perform immediate scroll and across subsequent frames/ticks to handle layout reflow
      doScroll();
      const raf = requestAnimationFrame(doScroll);
      const t1 = setTimeout(doScroll, 30);
      const t2 = setTimeout(doScroll, 80);
      const t3 = setTimeout(() => {
        doScroll();
        isJustVisibleRef.current = false;
      }, 160);

      return () => {
        cancelAnimationFrame(raf);
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
      };
    }
  }, [isVisible]);

  // Keep view pinned to bottom during container resizing if autoScroll is enabled
  useEffect(() => {
    if (!scrollRef.current) return;
    const observer = new ResizeObserver(() => {
      if (autoScroll && isVisible) {
        scrollToBottom();
      }
    });
    observer.observe(scrollRef.current);
    return () => observer.disconnect();
  }, [autoScroll, isVisible]);

  useEffect(() => {
    let unlistenData: (() => void) | undefined;
    let unlistenExit: (() => void) | undefined;
    let active = true;

    async function initStream() {
      setIsConnecting(true);
      try {
        const streamId = await startLogStream({
          profileId,
          serviceId: service.id,
          serviceType: service.serviceType,
          target: service.target,
          lines: 200,
        });
        streamIdRef.current = streamId;

        unlistenData = await listen<{ streamId: number; serviceId: number; data: string }>(
          "log-stream-data",
          (event) => {
            if (event.payload.streamId === streamId && active) {
              setIsConnecting(false);
              const lines = event.payload.data.split("\n");
              const now = new Date();
              const newEntries = lines
                .filter((l, idx) => idx < lines.length - 1 || l.length > 0)
                .map((line) => parseLogEntry(line, now));
              setLogs((prev) => [...prev.slice(-1500), ...newEntries]);
            }
          }
        );

        unlistenExit = await listen<{ streamId: number; serviceId: number }>(
          "log-stream-exit",
          (event) => {
            if (event.payload.streamId === streamId && active) {
              setIsConnecting(false);
              setHasExited(true);
            }
          }
        );
      } catch (e) {
        setIsConnecting(false);
        setLogs((prev) => [
          ...prev,
          parseLogEntry(`[System Error]: Failed to start log stream: ${e}`, new Date()),
        ]);
        setHasExited(true);
      }
    }

    if (isStreaming) {
      initStream();
    }

    return () => {
      active = false;
      if (unlistenData) unlistenData();
      if (unlistenExit) unlistenExit();
      if (streamIdRef.current != null) {
        stopLogStream(streamIdRef.current);
        streamIdRef.current = null;
      }
    };
  }, [profileId, service.id, service.target, service.serviceType, isStreaming]);

  // Always force scroll to bottom when new logs arrive if autoScroll is enabled
  useEffect(() => {
    if (autoScroll && isVisible) {
      scrollToBottom();
      const frame = requestAnimationFrame(() => scrollToBottom());
      return () => cancelAnimationFrame(frame);
    }
  }, [logs.length, autoScroll, isConnecting, isVisible]);

  const handleScroll = () => {
    if (!scrollRef.current || isJustVisibleRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const atBottom = scrollHeight - scrollTop - clientHeight < 40;
    setAutoScroll(atBottom);
  };

  const filteredLogs = logs.filter((entry) => {
    const line = entry.text || entry.raw;
    if (!line) return false;
    if (filterLevel === "error" && !/error|err|fail|fatal|exception/i.test(line)) return false;
    if (filterLevel === "warn" && !/warn|warning/i.test(line)) return false;
    if (search && !line.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const getBadgeStatus = (type: string) => {
    switch (type) {
      case "pm2":
        return "success";
      case "docker":
        return "info";
      case "systemd":
        return "warning";
      default:
        return "neutral";
    }
  };

  return (
    <Card className="relative flex flex-col h-full overflow-hidden border border-white/[0.04] bg-zinc-950/90 backdrop-blur-xl shadow-xl rounded-xl">
      {/* Console Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.03] bg-zinc-900/80 px-3.5 py-2 text-xs flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <AnimatedBadge status={getBadgeStatus(service.serviceType)} size="sm">
            {service.serviceType.toUpperCase()}
          </AnimatedBadge>
          <span className="font-semibold text-foreground tracking-tight">{service.name}</span>
          <span className="font-mono text-[11px] text-muted-foreground/80">({service.target})</span>
          <AnimatedBadge
            status={isStreaming ? "success" : "neutral"}
            size="sm"
            pulse={isStreaming}
          >
            {isStreaming ? "Streaming" : "Paused"}
          </AnimatedBadge>
        </div>

        {/* Console Controls */}
        <div className="flex items-center gap-2">
          <div className="relative w-38">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search logs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-7.5 pl-8 pr-2.5 text-xs bg-zinc-950/80 border-white/[0.05] rounded-md"
            />
          </div>

          <Select value={filterLevel} onValueChange={(v) => setFilterLevel(v as any)}>
            <SelectTrigger className="h-7.5 w-22 text-[11px] bg-zinc-950/80 border-white/[0.05] rounded-md">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Logs</SelectItem>
              <SelectItem value="error">Errors</SelectItem>
              <SelectItem value="warn">Warnings</SelectItem>
            </SelectContent>
          </Select>

          <Tooltip content={showTimestamps ? "Hide Timestamps" : "Show Timestamps"} side="bottom">
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-7.5 w-7.5 rounded-md transition-colors",
                showTimestamps ? "text-primary bg-primary/10 hover:bg-primary/20" : "text-muted-foreground hover:bg-zinc-800"
              )}
              onClick={() => setShowTimestamps((s) => !s)}
            >
              <Clock className="h-3.5 w-3.5" />
            </Button>
          </Tooltip>

          <div className="h-4 w-px bg-white/[0.06] mx-0.5" />

          <Tooltip content={isStreaming ? "Pause Log Stream" : "Resume Log Stream"} side="bottom">
            <Button
              variant="ghost"
              size="icon"
              className="h-7.5 w-7.5 rounded-md hover:bg-zinc-800"
              onClick={() => onTogglePause?.(!isPaused)}
            >
              {isStreaming ? <Square className="h-3.5 w-3.5 text-amber-400" /> : <Play className="h-3.5 w-3.5 text-emerald-400" />}
            </Button>
          </Tooltip>

          <Tooltip content="Clear Console" side="bottom">
            <Button
              variant="ghost"
              size="icon"
              className="h-7.5 w-7.5 rounded-md hover:bg-zinc-800"
              onClick={() => setLogs([])}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </Tooltip>

          {onRemoveService && (
            <Tooltip content="Remove Stream from Hub" side="bottom">
              <Button
                variant="ghost"
                size="icon"
                className="h-7.5 w-7.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md"
                onClick={() => onRemoveService(service.id)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Log Output Canvas */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-3 font-mono text-[11.5px] leading-relaxed text-zinc-300 select-text"
      >
        {filteredLogs.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground/60 text-xs">
            {isConnecting ? (
              <div className="flex items-center gap-2 text-muted-foreground text-xs">
                <RefreshCw className="h-3.5 w-3.5 animate-spin text-primary" />
                <Shimmer>{`Connecting to ${service.name} stream...`}</Shimmer>
              </div>
            ) : isStreaming ? (
              <span>Waiting for live log output from {service.name}...</span>
            ) : (
              <span>Log stream ended.</span>
            )}
          </div>
        )}

        {filteredLogs.map((entry) => {
          const parts = parseAnsi(entry.text || entry.raw);
          const isError = /error|err|fail|fatal|exception/i.test(entry.text);
          const isWarn = /warn|warning/i.test(entry.text);

          return (
            <div
              key={entry.id}
              className={`flex items-baseline hover:bg-white/[0.03] px-1 rounded transition-colors whitespace-pre-wrap break-all ${
                isError ? "bg-red-500/[0.07] text-red-300" : isWarn ? "bg-amber-500/[0.05] text-amber-300" : ""
              }`}
            >
              {showTimestamps && (
                <span
                  title={entry.fullDate}
                  className="text-[10px] font-mono text-zinc-500 hover:text-zinc-300 select-none shrink-0 pr-3 tabular-nums transition-colors cursor-default"
                >
                  {entry.time}
                </span>
              )}
              <div className="flex-1 min-w-0">
                {parts.map((part, pIdx) => (
                  <span
                    key={pIdx}
                    className={`${part.color} ${part.bold ? "font-bold" : ""} ${part.dim ? "opacity-60" : ""}`}
                  >
                    {part.text}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Floating Jump to Bottom Button */}
      <AnimatePresence>
        {!autoScroll && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.94 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            style={{ position: "absolute", top: "52px", right: "20px" }}
            className="z-30 pointer-events-auto"
          >
            <Button
              size="sm"
              variant="secondary"
              className="h-7.5 px-3 text-xs shadow-2xl bg-zinc-900/95 hover:bg-zinc-800 text-zinc-100 border border-white/10 backdrop-blur-xl rounded-full gap-1.5 font-medium cursor-pointer hover:border-primary/40 transition-all"
              onClick={() => {
                setAutoScroll(true);
                scrollToBottom("smooth");
              }}
            >
              <ArrowDownCircle className="h-3.5 w-3.5 text-primary" />
              <span>Jump to latest</span>
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

export default function ServiceLogViewer({
  profileId,
  serverName: _serverName,
  isVisible: isParentVisible = true,
}: {
  profileId: number;
  serverName?: string;
  isVisible?: boolean;
}) {
  const [services, setServices] = useState<ProfileService[]>([]);
  const [activeServiceId, setActiveServiceId] = useState<number | null>(null);
  const [splitServiceId, setSplitServiceId] = useState<number | null>(null);
  const [isSplitMode, setIsSplitMode] = useState(false);
  const [isAutoDetecting, setIsAutoDetecting] = useState(false);
  const [discoveredServices, setDiscoveredServices] = useState<DiscoveredService[]>([]);
  const [showAutoDetectModal, setShowAutoDetectModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  // Add Service Form
  const [newServiceName, setNewServiceName] = useState("");
  const [newServiceType, setNewServiceType] = useState<"pm2" | "docker" | "systemd" | "tail" | "custom">("pm2");
  const [newServiceTarget, setNewServiceTarget] = useState("");

  const refreshServices = async () => {
    try {
      const list = await listProfileServices(profileId);
      setServices(list);
      if (list.length > 0 && activeServiceId == null) {
        setActiveServiceId(list[0].id);
        if (list.length > 1) {
          setSplitServiceId(list[1].id);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    refreshServices();
  }, [profileId]);

  const handleAutoDetect = async () => {
    setIsAutoDetecting(true);
    setShowAutoDetectModal(true);
    try {
      const detected = await discoverServices(profileId);
      setDiscoveredServices(detected);
    } catch (e) {
      console.error("Auto detect failed", e);
    } finally {
      setIsAutoDetecting(false);
    }
  };

  const handleImportDiscovered = async (item: DiscoveredService) => {
    await saveProfileService({
      profileId,
      name: item.name,
      serviceType: item.serviceType,
      target: item.target,
    });
    await refreshServices();
  };

  const handleAddManualService = async () => {
    if (!newServiceName || !newServiceTarget) return;
    await saveProfileService({
      profileId,
      name: newServiceName,
      serviceType: newServiceType,
      target: newServiceTarget,
    });
    setNewServiceName("");
    setNewServiceTarget("");
    setShowAddModal(false);
    await refreshServices();
  };

  const handleDeleteService = async (id: number) => {
    await deleteProfileService(id);
    if (activeServiceId === id) setActiveServiceId(null);
    if (splitServiceId === id) setSplitServiceId(null);
    await refreshServices();
  };

  const handleToggleServicePause = async (id: number, nextPaused: boolean) => {
    try {
      await setProfileServicePaused(id, nextPaused);
      setServices((prev) =>
        prev.map((s) => (s.id === id ? { ...s, paused: nextPaused } : s))
      );
    } catch (e) {
      console.error("Failed to update service pause state", e);
    }
  };

  const serviceTabs: Tab[] = services.map((s) => {
    const isPaused = Boolean(s.paused);
    return {
      id: s.id,
      label: (
        <ContextMenu key={`service-ctx-${s.id}`}>
          <ContextMenuTrigger>
            <div className="flex items-center gap-1.5 py-0.5 select-none cursor-pointer">
              <FileText
                className={`h-3.5 w-3.5 flex-shrink-0 ${
                  s.id === activeServiceId ? "text-primary" : "text-muted-foreground"
                }`}
              />
              <span className="truncate max-w-[170px]">{s.name}</span>
              {isPaused ? (
                <span
                  className="h-1.5 w-1.5 rounded-full bg-amber-400 flex-shrink-0"
                  title="Stream paused"
                />
              ) : (
                <span
                  className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse flex-shrink-0"
                  title="Stream running"
                />
              )}
              <span
                role="button"
                tabIndex={0}
                title="Remove stream"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteService(s.id);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.stopPropagation();
                    handleDeleteService(s.id);
                  }
                }}
                className="ml-1 p-0.5 rounded-sm text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
              >
                <X className="h-3 w-3" />
              </span>
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent ariaLabel={`Service actions for ${s.name}`}>
            <ContextMenuLabel>
              {s.name} ({s.serviceType.toUpperCase()})
            </ContextMenuLabel>
            <ContextMenuItem onSelect={() => handleToggleServicePause(s.id, !isPaused)}>
              {isPaused ? (
                <>
                  <Play className="h-4 w-4 mr-2 text-emerald-400" />
                  <span>Resume Log Stream</span>
                </>
              ) : (
                <>
                  <Square className="h-4 w-4 mr-2 text-amber-400" />
                  <span>Stop / Pause Log Stream</span>
                </>
              )}
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onSelect={() => handleDeleteService(s.id)}>
              <Trash2 className="h-4 w-4 mr-2 text-destructive" />
              <span className="text-destructive">Remove Stream</span>
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      ),
    };
  });

  return (
    <div className="flex flex-col h-full p-3 gap-2.5 bg-background/30">
      {/* Top Services Navigation Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-border/50 pb-2.5 px-0.5">
        <div className="flex items-center gap-2 overflow-x-auto max-w-full py-0.5 scrollbar-none">
          {services.length > 0 && (
            <DirectionAwareTabs
              tabs={serviceTabs}
              activeTabId={activeServiceId ?? services[0]?.id}
              onChange={(id) => setActiveServiceId(Number(id))}
              showContent={false}
              layoutId={`service-tabs-${profileId}`}
              containerClassName="w-auto items-start"
              className="h-8 py-0.5 px-1 bg-zinc-900/80 border border-white/[0.04] rounded-lg"
              tabClassName="h-7 px-2.5 text-xs rounded-md"
              rounded="rounded-lg"
              roundedInner="rounded-md"
              bubbleClassName="bg-white/[0.12] border-white/20 rounded-md"
            />
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddModal(true)}
            className="h-8 px-2.5 text-xs gap-1.5 border-dashed hover:border-solid hover:bg-accent/40 rounded-lg"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Service</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleAutoDetect}
            className="h-8 px-3 text-xs text-primary border-primary/30 hover:bg-primary/10 gap-1.5 shadow-xs rounded-lg"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Auto-Detect VPS Services</span>
          </Button>
        </div>

        {/* Split View Toggle */}
        {services.length >= 2 && (
          <div className="flex items-center gap-2">
            <Button
              variant={isSplitMode ? "secondary" : "outline"}
              size="sm"
              onClick={() => setIsSplitMode((s) => !s)}
              className="h-8 text-xs gap-1.5"
            >
              <Columns className="h-3.5 w-3.5" />
              <span>{isSplitMode ? "Single View" : "Split View (2 Services)"}</span>
            </Button>

            {isSplitMode && (
              <Select
                value={splitServiceId ? String(splitServiceId) : undefined}
                onValueChange={(v) => setSplitServiceId(Number(v))}
              >
                <SelectTrigger className="h-8 w-38 text-xs bg-card/60">
                  <SelectValue placeholder="Second stream..." />
                </SelectTrigger>
                <SelectContent>
                  {services
                    .filter((s) => s.id !== activeServiceId)
                    .map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        {s.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}
      </div>

      {/* Main Stream Area */}
      <div className="flex-1 min-h-0">
        {services.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
            <Layers className="h-10 w-10 text-muted-foreground/60" />
            <div className="max-w-md">
              <h3 className="font-semibold text-foreground">No services configured yet</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Auto-detect PM2, Docker, and Systemd services on this server in 1-click, or add a custom service log stream.
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAutoDetect}>
                <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Auto-Detect Services
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowAddModal(true)}>
                <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Manually
              </Button>
            </div>
          </div>
        ) : (
          <div className={`h-full ${isSplitMode ? "grid grid-cols-2 gap-3" : ""}`}>
            {services.map((service) => {
              const currentActiveId = activeServiceId ?? services[0]?.id;
              const isVisible = isParentVisible && (isSplitMode
                ? service.id === currentActiveId || service.id === splitServiceId
                : service.id === currentActiveId);
              return (
                <div
                  key={service.id}
                  className={`h-full ${isVisible ? "block min-w-0" : "hidden"}`}
                >
                  <LogConsole
                    service={service}
                    profileId={profileId}
                    isVisible={isVisible}
                    isPaused={Boolean(service.paused)}
                    onTogglePause={(p) => handleToggleServicePause(service.id, p)}
                    onRemoveService={handleDeleteService}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Auto-Detect Modal */}
      <Modal
        isOpen={showAutoDetectModal}
        onClose={() => setShowAutoDetectModal(false)}
        title="Auto-Detected VPS Services"
        description="Discover running apps, web servers, and databases"
        icon={<Sparkles className="h-4 w-4" />}
        maxWidth="max-w-lg"
      >
        {isAutoDetecting ? (
          <div className="py-8 flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <RefreshCw className="h-7 w-7 animate-spin text-primary" />
            <Shimmer className="text-xs">Scanning VPS for PM2 apps, Docker containers, and Systemd services...</Shimmer>
          </div>
        ) : discoveredServices.length === 0 ? (
          <div className="py-6 text-center text-xs text-muted-foreground">
            No active PM2 apps, Docker containers, or user services found on this server.
          </div>
        ) : (
          <div className="max-h-72 overflow-y-auto space-y-2">
            {discoveredServices.map((item, idx) => {
              const existing = services.find((s) => s.target === item.target && s.serviceType === item.serviceType);
              return (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2.5 rounded-lg border border-border/50 bg-card/60 hover:border-primary/30 transition-colors"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-foreground">{item.name}</span>
                      <span className="rounded bg-secondary/80 px-1.5 py-0.5 text-[10px] text-muted-foreground uppercase font-mono">
                        {item.serviceType}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{item.description}</p>
                  </div>
                  {existing ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteService(existing.id)}
                      className="h-7 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 gap-1"
                    >
                      <Trash2 className="h-3 w-3" />
                      Remove
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => handleImportDiscovered(item)}
                      className="h-7 text-xs"
                    >
                      + Add Stream
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="flex justify-end pt-2 border-t border-border/40">
          <Button size="sm" variant="outline" onClick={() => setShowAutoDetectModal(false)}>
            Done
          </Button>
        </div>
      </Modal>

      {/* Manual Add Service Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add Service Log Stream"
        description="Configure a custom service or log file target"
        icon={<Plus className="h-4 w-4" />}
        maxWidth="max-w-md"
      >
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Display Name</label>
            <Input
              placeholder="e.g. Zoopify Backend or Next.js Frontend"
              value={newServiceName}
              onChange={(e) => setNewServiceName(e.target.value)}
              className="mt-1 text-xs"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Service Type</label>
            <Select value={newServiceType} onValueChange={(v) => setNewServiceType(v as any)}>
              <SelectTrigger className="mt-1 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="systemd">Systemd (journalctl -u &lt;service&gt; -f -o cat)</SelectItem>
                <SelectItem value="pm2">PM2 (pm2 logs &lt;name&gt;)</SelectItem>
                <SelectItem value="docker">Docker (docker logs -f &lt;container&gt;)</SelectItem>
                <SelectItem value="tail">File Tail (tail -f &lt;path&gt;)</SelectItem>
                <SelectItem value="custom">Custom Shell Command</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">
              {newServiceType === "pm2"
                ? "PM2 Process Name (e.g. backend, frontend, zoopify-api)"
                : newServiceType === "docker"
                ? "Container Name / ID (e.g. redis, postgres, app-web)"
                : newServiceType === "systemd"
                ? "Systemd Service Name (e.g. zoopify-backend, zoopify-frontend, nginx)"
                : newServiceType === "tail"
                ? "File Path (e.g. /var/log/nginx/access.log, app.log)"
                : "Shell Command"}
            </label>
            <Input
              placeholder={
                newServiceType === "pm2"
                  ? "zoopify-backend"
                  : newServiceType === "systemd"
                  ? "zoopify-backend"
                  : newServiceType === "tail"
                  ? "/var/log/nginx/access.log"
                  : "target"
              }
              value={newServiceTarget}
              onChange={(e) => setNewServiceTarget(e.target.value)}
              className="mt-1 text-xs font-mono"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-border/40">
          <Button size="sm" variant="ghost" onClick={() => setShowAddModal(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!newServiceName || !newServiceTarget}
            onClick={handleAddManualService}
          >
            Save & Start Stream
          </Button>
        </div>
      </Modal>
    </div>
  );
}
