import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Check,
  ChevronRight,
  ExternalLink,
  Folder,
  Layers,
  Pencil,
  Play,
  Plus,
  Save,
  Search,
  Server,
  Terminal,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Loader } from "@/components/Loader";
import { AnimatedCombobox, type ComboboxItem } from "@/components/ui/combobox";
import { FolderModal } from "@/components/folders/FolderModal";
import { SPRING_PANEL, SPRING_SWAP } from "@/lib/ease";
import { addEmptyFolder, getEmptyFolders, getFolderColor } from "@/lib/folderMetadata";
import { cn } from "@/lib/utils";
import { HoverMarquee } from "@/components/ui/HoverMarquee";
import type { MacroGroupSummary, MacroSummary, ProfileSummary } from "@/types";

export type MacroTypeFilter = "all" | "single" | "group";

export interface MacroSidesheetProps {
  isOpen: boolean;
  onClose: () => void;
  macros: MacroSummary[];
  macroGroups: MacroGroupSummary[];
  profiles: ProfileSummary[];
  activeProfileId?: number;
  isBoundToTerminal?: boolean;
  onRunSingleMacro: (macro: MacroSummary, target?: string) => Promise<void>;
  onRunGroupMacro: (group: MacroGroupSummary, target?: string) => Promise<void>;
  onRunCustomQueue: (queueMacroIds: number[], target?: string) => Promise<void>;
  onEditMacro: (id: number) => void;
  onDeleteMacro?: (id: number) => void;
  onSaveGroup: (name: string, folder?: string, macroIds?: number[]) => Promise<void>;
  onEditGroup?: (group: MacroGroupSummary) => void;
  onDeleteGroup?: (id: number) => void;
  onNewMacro: (defaultFolder?: string) => void;
  onNewGroupMacro?: () => void;
  runningState?: {
    isRunning: boolean;
    label?: string;
    onCancel?: () => void;
  };
}

export default function MacroSidesheet({
  isOpen,
  onClose,
  macros,
  macroGroups,
  profiles,
  activeProfileId,
  isBoundToTerminal,
  onRunSingleMacro,
  onRunGroupMacro,
  onRunCustomQueue,
  onEditMacro,
  onDeleteMacro: _onDeleteMacro,
  onSaveGroup,
  onEditGroup,
  onDeleteGroup,
  onNewMacro,
  onNewGroupMacro,
  runningState,
}: MacroSidesheetProps) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<MacroTypeFilter>("all");
  const [folderFilter, setFolderFilter] = useState<string>("all");
  const [selectedMacroIds, setSelectedMacroIds] = useState<number[]>([]);
  const [saveGroupModalOpen, setSaveGroupModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupFolder, setNewGroupFolder] = useState("");
  const [newFolderModalOpen, setNewFolderModalOpen] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState<string>(
    isBoundToTerminal ? "" : activeProfileId ? `ssh:${activeProfileId}` : ""
  );

  const activeProfile = useMemo(() => {
    return activeProfileId ? profiles.find((p) => p.id === activeProfileId) : undefined;
  }, [activeProfileId, profiles]);

  // When sidesheet opens or bound profile changes, auto-filter to folder and select active terminal
  useEffect(() => {
    if (!isOpen) return;

    setSearch("");

    const profileFolder = activeProfile?.folder?.trim();
    if (profileFolder) {
      setFolderFilter(profileFolder);
    } else {
      setFolderFilter("all");
    }

    if (isBoundToTerminal) {
      setSelectedTarget(""); // Active Terminal Session
    } else if (activeProfileId) {
      setSelectedTarget(`ssh:${activeProfileId}`);
    } else {
      setSelectedTarget("");
    }
  }, [isOpen, activeProfileId, isBoundToTerminal, activeProfile]);

  const targetComboboxItems: ComboboxItem[] = useMemo(() => {
    const activeLabel =
      isBoundToTerminal && activeProfile
        ? `Active Terminal (${activeProfile.name})`
        : "Active Terminal Session";

    return [
      {
        value: "new_tab",
        label: "New Tab (Dedicated Session)",
        icon: <ExternalLink className="h-3.5 w-3.5 text-emerald-400" />,
        description: "Opens a fresh dedicated tab to execute",
      },
      {
        value: "",
        label: activeLabel,
        icon: <Terminal className="h-3.5 w-3.5 text-primary" />,
        description: isBoundToTerminal ? "This terminal session" : "Currently focused tab",
      },
      {
        value: "local:powershell",
        label: "Local Terminal (PowerShell)",
        icon: <Terminal className="h-3.5 w-3.5 text-sky-400" />,
        description: "Run locally via PowerShell",
      },
      {
        value: "local:cmd",
        label: "Local Terminal (Command Prompt)",
        icon: <Terminal className="h-3.5 w-3.5 text-amber-400" />,
        description: "Run locally via cmd.exe",
      },
      {
        value: "local:wsl",
        label: "Local Terminal (WSL Linux)",
        icon: <Terminal className="h-3.5 w-3.5 text-emerald-400" />,
        description: "Run locally via Windows Subsystem for Linux",
      },
      ...profiles
        .filter((p) => p.kind === "ssh")
        .map((p) => ({
          value: `ssh:${p.id}`,
          label: p.name,
          description: p.host,
          icon: <Server className="h-3.5 w-3.5 text-zinc-400" />,
        })),
    ];
  }, [profiles, isBoundToTerminal, activeProfile]);



  // Collect existing folders across all profiles, macros, groups, and metadata
  const existingFolders = useMemo(() => {
    return Array.from(
      new Set([
        ...profiles.map((p) => p.folder).filter((f): f is string => !!f && f.trim().length > 0),
        ...macros.map((m) => m.folder).filter((f): f is string => !!f && f.trim().length > 0),
        ...macroGroups.map((g) => g.folder).filter((f): f is string => !!f && f.trim().length > 0),
        ...getEmptyFolders(),
      ])
    ).sort((a, b) => a.localeCompare(b));
  }, [profiles, macros, macroGroups, newGroupFolder]);

  const folderComboboxItems: ComboboxItem[] = useMemo(() => {
    return existingFolders.map((f) => ({
      value: f,
      label: f,
      color: getFolderColor(f),
      icon: <Folder className="h-3.5 w-3.5" />,
    }));
  }, [existingFolders]);

  // Extract unique folders across all servers, macros, groups, and empty folders
  const allFolders = existingFolders;

  // Filter individual macros
  const filteredSingleMacros = useMemo(() => {
    if (typeFilter === "group") return [];
    return macros.filter((m) => {
      const matchSearch =
        m.name.toLowerCase().includes(search.toLowerCase()) ||
        (m.folder && m.folder.toLowerCase().includes(search.toLowerCase()));
      const matchFolder = folderFilter === "all" || m.folder === folderFilter;
      return matchSearch && matchFolder;
    });
  }, [macros, search, typeFilter, folderFilter]);

  // Filter group macros
  const filteredGroupMacros = useMemo(() => {
    if (typeFilter === "single") return [];
    return macroGroups.filter((g) => {
      const matchSearch =
        g.name.toLowerCase().includes(search.toLowerCase()) ||
        (g.folder && g.folder.toLowerCase().includes(search.toLowerCase()));
      const matchFolder = folderFilter === "all" || g.folder === folderFilter;
      return matchSearch && matchFolder;
    });
  }, [macroGroups, search, typeFilter, folderFilter]);

  // Queue item helpers
  const queueMacros = useMemo(() => {
    return selectedMacroIds
      .map((id) => macros.find((m) => m.id === id))
      .filter((m): m is MacroSummary => m != null);
  }, [selectedMacroIds, macros]);

  const toggleSelectMacro = (id: number) => {
    setSelectedMacroIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const moveQueueItem = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= selectedMacroIds.length) return;
    const next = [...selectedMacroIds];
    const [moved] = next.splice(index, 1);
    next.splice(targetIndex, 0, moved);
    setSelectedMacroIds(next);
  };

  const removeQueueItem = (id: number) => {
    setSelectedMacroIds((prev) => prev.filter((mId) => mId !== id));
  };

  const clearQueue = () => {
    setSelectedMacroIds([]);
  };

  const handleSaveQueueAsGroup = async () => {
    if (!newGroupName.trim() || selectedMacroIds.length === 0) return;
    if (newGroupFolder.trim() && !existingFolders.includes(newGroupFolder.trim())) {
      addEmptyFolder(newGroupFolder.trim());
    }
    await onSaveGroup(newGroupName.trim(), newGroupFolder.trim() || undefined, selectedMacroIds);
    setNewGroupName("");
    setNewGroupFolder("");
    setSaveGroupModalOpen(false);
  };

  const handleRunQueue = async () => {
    if (selectedMacroIds.length === 0) return;
    await onRunCustomQueue(selectedMacroIds, selectedTarget);
  };

  return (
    <>
      <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end pointer-events-none select-none">
          {/* Backdrop overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-[2px] pointer-events-auto"
          />

          {/* Sliding drawer panel */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={SPRING_PANEL}
            className="relative z-10 flex h-full w-[440px] max-w-[92vw] flex-col border-l border-white/[0.08] bg-card/95 backdrop-blur-2xl shadow-2xl text-foreground pointer-events-auto overflow-hidden"
          >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/60 px-4 py-3 bg-card/50">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-400/10 text-amber-400 border border-amber-400/20">
                <Zap className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground tracking-tight">Macro Cockpit</h3>
                <p className="text-[11px] text-muted-foreground">Automated command pipelines</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7 rounded-md text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Running State Banner (with Abort Control) */}
          {runningState?.isRunning && (
            <div className="flex items-center justify-between gap-2 px-4 py-2 bg-amber-500/15 border-b border-amber-500/30 text-amber-300 text-xs animate-pulse">
              <div className="flex items-center gap-2 truncate">
                <Loader size="14" />
                <span className="truncate font-medium">{runningState.label || "Running macro step..."}</span>
              </div>
              {runningState.onCancel && (
                <button
                  type="button"
                  onClick={runningState.onCancel}
                  className="flex items-center gap-1 rounded bg-red-500/20 px-2 py-0.5 text-[11px] font-semibold text-red-300 hover:bg-red-500/30 transition-colors cursor-pointer"
                >
                  <X className="h-3 w-3" />
                  <span>Cancel</span>
                </button>
              )}
            </div>
          )}

          {/* Target Server Switcher Bar */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-border/40 bg-zinc-950/40 text-xs">
            <div className="flex items-center gap-1.5 text-muted-foreground shrink-0">
              <Server className="h-3.5 w-3.5 text-primary" />
              <span>Target:</span>
            </div>
            <div className="w-60">
              <AnimatedCombobox
                value={selectedTarget}
                onChange={(val) => setSelectedTarget(val || "")}
                items={targetComboboxItems}
                placeholder="Active Terminal Session"
                searchPlaceholder="Search target terminal or server..."
                className="text-xs"
              />
            </div>
          </div>

          {/* Search & Type Filters */}
          <div className="p-3.5 border-b border-border/40 space-y-2.5 bg-card/30">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search macros or groups..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 pl-8 text-xs bg-zinc-900/80 border-white/[0.08]"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* Type Filter Pills */}
            <div className="relative flex items-center gap-1 bg-muted/40 p-0.5 rounded-lg text-[11px]">
              {(
                [
                  { id: "all", label: `All (${macros.length + macroGroups.length})` },
                  { id: "single", label: `Single (${macros.length})` },
                  { id: "group", label: `Groups (${macroGroups.length})` },
                ] as const
              ).map((tab) => {
                const isSelected = typeFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setTypeFilter(tab.id)}
                    className={cn(
                      "relative z-10 flex-1 py-1 px-2 rounded-md font-medium text-center cursor-pointer transition-colors",
                      isSelected
                        ? "text-foreground font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {isSelected && (
                      <motion.div
                        layoutId="macro-type-filter-pill"
                        className="absolute inset-0 z-[-1] rounded-md border border-border bg-background shadow-sm"
                        transition={{ type: "spring", duration: 0.35, bounce: 0.15 }}
                      />
                    )}
                    <span className="relative z-10">{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Folder Filter Horizontal Chips */}
            {allFolders.length > 0 && (
              <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-thin text-[11px]">
                <button
                  type="button"
                  onClick={() => setFolderFilter("all")}
                  className={cn(
                    "px-2 py-0.5 rounded-full border whitespace-nowrap transition-colors",
                    folderFilter === "all"
                      ? "border-primary/50 bg-primary/10 text-primary font-medium"
                      : "border-border/60 text-muted-foreground hover:text-foreground hover:border-border"
                  )}
                >
                  All Folders
                </button>
                {allFolders.map((f) => {
                  const color = getFolderColor(f);
                  const isSelected = folderFilter === f;
                  return (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFolderFilter(f)}
                      className={cn(
                        "flex items-center gap-1.5 px-2 py-0.5 rounded-full border whitespace-nowrap transition-colors",
                        isSelected
                          ? "border-amber-400/50 bg-amber-400/10 text-amber-300 font-medium"
                          : "border-border/60 text-muted-foreground hover:text-foreground hover:border-border"
                      )}
                    >
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color || "#888" }} />
                      <span>{f}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Pinned Ad-Hoc Execution Queue */}
          <AnimatePresence>
            {queueMacros.length > 0 && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={SPRING_SWAP}
                className="border-b border-amber-400/30 bg-amber-500/[0.04] p-3 space-y-2 overflow-hidden"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-300">
                    <Layers className="h-3.5 w-3.5" />
                    <span>Active Run Queue ({queueMacros.length})</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSaveGroupModalOpen(true)}
                      className="h-6 px-2 text-[10px] text-amber-300 border-amber-400/30 hover:bg-amber-400/10"
                    >
                      <Save className="h-3 w-3 mr-1" />
                      Save as Group
                    </Button>
                    <Tooltip content="Clear queue" side="bottom">
                      <button
                        type="button"
                        onClick={clearQueue}
                        className="text-[10px] text-muted-foreground hover:text-red-400 px-1 py-0.5 rounded transition-colors"
                      >
                        Clear
                      </button>
                    </Tooltip>
                  </div>
                </div>

                {/* Queue reorder list */}
                <div className="max-h-36 overflow-y-auto space-y-1 scrollbar-thin">
                  {queueMacros.map((macro, idx) => (
                    <div
                      key={macro.id}
                      className="flex items-center justify-between gap-1.5 px-2 py-1 rounded bg-zinc-900/90 border border-white/[0.06] text-xs"
                    >
                      <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden">
                        <span className="font-mono text-[10px] text-muted-foreground w-3.5 flex-shrink-0">{idx + 1}.</span>
                        <HoverMarquee text={macro.name} className="font-medium flex-1 min-w-0 text-left" />
                        {macro.folder && (
                          <span className="text-[9px] px-1 rounded bg-white/[0.06] text-muted-foreground flex-shrink-0">
                            {macro.folder}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-0.5 flex-shrink-0">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => moveQueueItem(idx, "up")}
                          className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-20 cursor-pointer"
                        >
                          <ArrowUp className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === queueMacros.length - 1}
                          onClick={() => moveQueueItem(idx, "down")}
                          className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-20 cursor-pointer"
                        >
                          <ArrowDown className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeQueueItem(macro.id)}
                          className="p-0.5 text-muted-foreground hover:text-red-400 cursor-pointer"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Run Queue CTA */}
                <Button
                  onClick={handleRunQueue}
                  disabled={runningState?.isRunning}
                  className="w-full h-7 text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-black shadow-sm"
                >
                  <Play className="h-3 w-3 mr-1 fill-black" />
                  Run All {queueMacros.length} in Order
                </Button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Save Group Modal (Inline overlay inside sheet) */}
          <AnimatePresence>
            {saveGroupModalOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="p-3 border-b border-primary/40 bg-primary/[0.06] space-y-2 text-xs"
              >
                <div className="flex items-center justify-between font-semibold text-primary">
                  <span>Save Queue as Group Macro</span>
                  <button type="button" onClick={() => setSaveGroupModalOpen(false)}>
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <Input
                  placeholder="Group Name (e.g. Full Deploy Stack)"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className="h-7 text-xs bg-zinc-900 border-white/[0.1]"
                />
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-muted-foreground">Folder (Optional)</label>
                  <AnimatedCombobox
                    value={newGroupFolder}
                    onChange={(val) => {
                      setNewGroupFolder(val);
                      if (val.trim() && !existingFolders.includes(val.trim())) {
                        addEmptyFolder(val.trim());
                      }
                    }}
                    items={folderComboboxItems}
                    placeholder="Select folder..."
                    searchPlaceholder="Search or type new folder..."
                    allowCreate
                    createPrefix="Create new folder"
                    clearLabel="No Folder (Root)"
                    clearValue=""
                    icon={<Folder className="h-3.5 w-3.5" />}
                    className="w-full text-xs"
                    onCreateNew={() => setNewFolderModalOpen(true)}
                    createNewText="Create new folder..."
                  />
                </div>
                <div className="flex justify-end gap-1.5 pt-1">
                  <Button variant="ghost" size="sm" onClick={() => setSaveGroupModalOpen(false)} className="h-6 text-xs">
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSaveQueueAsGroup} disabled={!newGroupName.trim()} className="h-6 text-xs">
                    Save Group
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Main List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-thin">
            {/* Group Macros Section */}
            {filteredGroupMacros.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between px-1 text-[11px] font-semibold text-muted-foreground tracking-wider uppercase">
                  <span>Group Pipelines ({filteredGroupMacros.length})</span>
                </div>
                {filteredGroupMacros.map((group) => (
                  <div
                    key={`group-${group.id}`}
                    className="flex items-center justify-between p-2 rounded-xl bg-card/60 hover:bg-card border border-white/[0.04] hover:border-amber-400/20 transition-all group"
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-400/10 text-amber-400 flex-shrink-0">
                        <Layers className="h-3.5 w-3.5" />
                      </div>
                      <div className="truncate flex-1 min-w-0">
                        <HoverMarquee text={group.name} className="font-medium text-xs text-foreground" />
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                          <span>{group.macroCount} macros</span>
                          {group.folder && (
                            <>
                              <span>•</span>
                              <span className="text-muted-foreground/90">{group.folder}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button
                        size="sm"
                        onClick={() => onRunGroupMacro(group, selectedTarget)}
                        disabled={runningState?.isRunning}
                        className="h-6 px-2.5 text-[11px] bg-amber-400/15 hover:bg-amber-400/25 text-amber-300 border border-amber-400/30"
                      >
                        <Play className="h-2.5 w-2.5 mr-1 fill-current" />
                        Run
                      </Button>
                      <Tooltip content="Run in New Tab" side="top">
                        <button
                          type="button"
                          onClick={() => onRunGroupMacro(group, "new_tab")}
                          disabled={runningState?.isRunning}
                          className="p-1 text-muted-foreground/60 hover:text-emerald-400 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </button>
                      </Tooltip>
                      {onEditGroup && (
                        <Tooltip content="Edit Group" side="top">
                          <button
                            type="button"
                            onClick={() => onEditGroup(group)}
                            className="p-1 text-muted-foreground/60 hover:text-foreground rounded opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                        </Tooltip>
                      )}
                      {onDeleteGroup && (
                        <Tooltip content="Delete Group" side="top">
                          <button
                            type="button"
                            onClick={() => onDeleteGroup(group.id)}
                            className="p-1 text-muted-foreground/60 hover:text-red-400 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </Tooltip>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Individual Macros Section */}
            {filteredSingleMacros.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between px-1 text-[11px] font-semibold text-muted-foreground tracking-wider uppercase">
                  <span>Individual Macros ({filteredSingleMacros.length})</span>
                </div>
                {filteredSingleMacros.map((macro) => {
                  const isQueued = selectedMacroIds.includes(macro.id);
                  return (
                    <div
                      key={`macro-${macro.id}`}
                      className={cn(
                        "flex items-center justify-between p-2 rounded-xl border transition-all group",
                        isQueued
                          ? "bg-amber-400/[0.06] border-amber-400/30 shadow-xs"
                          : "bg-card/60 hover:bg-card border-white/[0.04] hover:border-white/[0.1]"
                      )}
                    >
                      <div className="flex items-center gap-2 truncate">
                        {/* Queue Toggle Checkbox */}
                        <Tooltip content={isQueued ? "Remove from queue" : "Add to queue"} side="top">
                          <button
                            type="button"
                            onClick={() => toggleSelectMacro(macro.id)}
                            className={cn(
                              "flex h-4 w-4 items-center justify-center rounded border transition-colors cursor-pointer",
                              isQueued
                                ? "bg-amber-400 border-amber-400 text-black"
                                : "border-muted-foreground/40 hover:border-muted-foreground bg-background/50"
                            )}
                          >
                            {isQueued && <Check className="h-3 w-3 stroke-[3]" />}
                          </button>
                        </Tooltip>

                        <div className="truncate flex-1 min-w-0">
                          <HoverMarquee text={macro.name} className="font-medium text-xs text-foreground" />
                          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                            <span className="text-[9px] font-semibold tracking-wide px-1.5 py-0.2 rounded bg-white/[0.05] text-zinc-300 border border-white/[0.08]">
                              {macro.runMode === "pty" ? "Interactive" : "Direct"}
                            </span>
                            <span>{macro.stepCount} steps</span>
                            {macro.folder && (
                              <>
                                <span>•</span>
                                <span className="text-muted-foreground/90">{macro.folder}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onRunSingleMacro(macro, selectedTarget)}
                          disabled={runningState?.isRunning}
                          className="h-6 px-2 text-[11px] hover:bg-amber-400/15 hover:text-amber-300 transition-colors"
                        >
                          <Play className="h-2.5 w-2.5 mr-1" />
                          Run
                        </Button>
                        <Tooltip content="Run in New Tab" side="top">
                          <button
                            type="button"
                            onClick={() => onRunSingleMacro(macro, "new_tab")}
                            disabled={runningState?.isRunning}
                            className="p-1 text-muted-foreground/60 hover:text-emerald-400 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </button>
                        </Tooltip>
                        <Tooltip content="Edit Macro" side="top">
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              onEditMacro(macro.id);
                            }}
                            className="p-1 text-muted-foreground/60 hover:text-foreground rounded transition-colors"
                          >
                            <ChevronRight className="h-3.5 w-3.5" />
                          </button>
                        </Tooltip>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {filteredSingleMacros.length === 0 && filteredGroupMacros.length === 0 && (
              <div className="py-12 text-center text-xs text-muted-foreground space-y-2">
                <AlertCircle className="h-6 w-6 mx-auto opacity-40" />
                <p>No matching macros or groups found.</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onNewMacro(folderFilter !== "all" ? folderFilter : undefined)}
                  className="h-7 text-xs"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Create New Macro
                </Button>
              </div>
            )}
          </div>

          {/* Footer CTA */}
          <div className="p-3 border-t border-border/40 bg-card/60 flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">
              {macros.length} single • {macroGroups.length} groups
            </span>
            <div className="flex items-center gap-1.5">
              {onNewGroupMacro && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    onClose();
                    onNewGroupMacro();
                  }}
                  className="h-7 text-xs border-amber-400/30 text-amber-300 hover:bg-amber-400/10"
                >
                  <Layers className="h-3 w-3 mr-1" />
                  New Group
                </Button>
              )}
              <Button
                size="sm"
                onClick={() => {
                  onClose();
                  onNewMacro(folderFilter !== "all" ? folderFilter : undefined);
                }}
                className="h-7 text-xs bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                New Macro
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
      )}
    </AnimatePresence>
    <FolderModal
      isOpen={newFolderModalOpen}
      onClose={() => setNewFolderModalOpen(false)}
      existingFolders={existingFolders}
      onSave={async (_, newName, color) => {
        addEmptyFolder(newName, color);
        setNewGroupFolder(newName);
        setNewFolderModalOpen(false);
      }}
    />
  </>
  );
}
