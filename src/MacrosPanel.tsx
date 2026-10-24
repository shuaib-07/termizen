import { useMemo, useState } from "react";
import { Layers, Pencil, Play, Plus, Server, Terminal, Trash2, Zap } from "lucide-react";
import type { MacroSummary, ProfileSummary } from "./sessions";
import type { MacroGroupSummary } from "./types";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { NativeDelete } from "@/components/NativeDelete";
import { getFolderColor, getAllFolderMetadata, getEmptyFolders } from "@/lib/folderMetadata";
import { cn } from "@/lib/utils";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

export default function MacrosPanel({
  macros,
  macroGroups = [],
  profiles,
  onNewMacro,
  onNewGroup,
  onRunMacro,
  onEditMacro,
  onDelete,
  onRunGroup,
  onEditGroup,
  onDeleteGroup,
}: {
  macros: MacroSummary[];
  macroGroups?: MacroGroupSummary[];
  profiles: ProfileSummary[];
  onNewMacro: () => void;
  onNewGroup?: () => void;
  onRunMacro?: (macroId: number, options?: { profileId?: number; shell?: string }) => void;
  onEditMacro: (id: number) => void;
  onDelete: (id: number) => void;
  onRunGroup?: (group: MacroGroupSummary) => void;
  onEditGroup?: (group: MacroGroupSummary) => void;
  onDeleteGroup?: (id: number) => void;
}) {
  const profileName = (id?: number) => profiles.find((p) => p.id === id)?.name;
  const [selectedFolder, setSelectedFolder] = useState<string>("all");

  // Aggregate all unique folders from servers, macros, groups, and stored folder metadata
  const allFolderNames = useMemo(() => {
    const set = new Set<string>();
    profiles.forEach((p) => {
      if (p.folder?.trim()) set.add(p.folder.trim());
    });
    macros.forEach((m) => {
      if (m.folder?.trim()) set.add(m.folder.trim());
    });
    macroGroups.forEach((g) => {
      if (g.folder?.trim()) set.add(g.folder.trim());
    });
    Object.keys(getAllFolderMetadata()).forEach((f) => {
      if (f.trim()) set.add(f.trim());
    });
    getEmptyFolders().forEach((f) => {
      if (f.trim()) set.add(f.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [profiles, macros, macroGroups]);

  const filteredMacros = useMemo(() => {
    if (selectedFolder === "all") return macros;
    return macros.filter((m) => m.folder === selectedFolder);
  }, [macros, selectedFolder]);

  const filteredGroups = useMemo(() => {
    if (selectedFolder === "all") return macroGroups;
    return macroGroups.filter((g) => g.folder === selectedFolder);
  }, [macroGroups, selectedFolder]);

  return (
    <div className="flex h-full flex-col p-2 space-y-2.5">
      {/* Folder Filter Chips Bar */}
      {allFolderNames.length > 0 && (
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-1 border-b border-white/[0.04]">
          <button
            type="button"
            onClick={() => setSelectedFolder("all")}
            className={cn(
              "px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors shrink-0",
              selectedFolder === "all"
                ? "bg-white/[0.12] text-foreground font-semibold shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-white/[0.05]"
            )}
          >
            All ({macros.length})
          </button>
          {allFolderNames.map((folder) => {
            const count = macros.filter((m) => m.folder === folder).length;
            const color = getFolderColor(folder);
            const isSelected = selectedFolder === folder;
            return (
              <button
                key={folder}
                type="button"
                onClick={() => setSelectedFolder(folder)}
                className={cn(
                  "flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors shrink-0",
                  isSelected
                    ? "bg-white/[0.12] text-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/[0.05]"
                )}
              >
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: color || "#888" }}
                />
                <span className="truncate max-w-[90px]">{folder}</span>
                <span className="text-[10px] opacity-60">({count})</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Group Pipelines */}
      {filteredGroups.length > 0 && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between px-1 pb-1">
            <span className="text-[11px] font-semibold text-muted-foreground tracking-wider uppercase">
              GROUP PIPELINES ({filteredGroups.length})
            </span>
            {onNewGroup && (
              <Tooltip content="New group pipeline" side="bottom">
                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={onNewGroup}>
                  <Plus className="h-3 w-3" />
                </Button>
              </Tooltip>
            )}
          </div>
          <div className="flex flex-col gap-1">
            {filteredGroups.map((group) => (
              <ContextMenu key={`group-${group.id}`}>
                <ContextMenuTrigger>
                  <div
                    className="group relative flex flex-col gap-1 rounded-lg px-2.5 py-1.5 hover:bg-white/[0.05] border border-transparent hover:border-white/[0.06] cursor-pointer select-none transition-all"
                    onClick={() => onRunGroup?.(group)}
                  >
                    <div className="flex items-center justify-between gap-1.5 min-w-0">
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <Layers className="h-3.5 w-3.5 flex-shrink-0 text-amber-400" />
                        <span
                          className="font-medium text-xs text-foreground truncate"
                          title={group.name}
                        >
                          {group.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                        <Tooltip content="Run pipeline" side="top">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-emerald-400"
                            onClick={(e) => {
                              e.stopPropagation();
                              onRunGroup?.(group);
                            }}
                          >
                            <Play className="h-3 w-3" />
                          </Button>
                        </Tooltip>
                        {onEditGroup && (
                          <Tooltip content="Edit group" side="top">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground hover:text-foreground"
                              onClick={(e) => {
                                e.stopPropagation();
                                onEditGroup(group);
                              }}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                          </Tooltip>
                        )}
                        {onDeleteGroup && (
                          <div onClick={(e) => e.stopPropagation()}>
                            <NativeDelete size="sm" onConfirm={() => {}} onDelete={() => onDeleteGroup(group.id)} />
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 pl-5 text-[10px] text-muted-foreground min-w-0 flex-wrap">
                      <span className="px-1.5 py-0.2 rounded font-sans text-[9px] font-semibold tracking-wide bg-primary/10 text-primary border border-primary/20">
                        Pipeline
                      </span>
                      <span className="text-zinc-400">
                        {group.macroCount} {group.macroCount === 1 ? "step" : "steps"}
                      </span>
                      {group.folder && (
                        <span className="truncate max-w-[80px] text-zinc-500" title={group.folder}>
                          · {group.folder}
                        </span>
                      )}
                    </div>
                  </div>
                </ContextMenuTrigger>
                <ContextMenuContent ariaLabel={`Actions for ${group.name}`}>
                  <ContextMenuLabel>{group.name}</ContextMenuLabel>
                  <ContextMenuItem onSelect={() => onRunGroup?.(group)}>
                    <Play className="h-4 w-4 mr-2 text-emerald-400" />
                    <span>Run Pipeline</span>
                  </ContextMenuItem>
                  {onEditGroup && (
                    <ContextMenuItem onSelect={() => onEditGroup(group)}>
                      <Pencil className="h-4 w-4 mr-2 text-muted-foreground" />
                      <span>Edit Group…</span>
                    </ContextMenuItem>
                  )}
                  {onDeleteGroup && (
                    <>
                      <ContextMenuSeparator />
                      <ContextMenuItem tone="destructive" onSelect={() => onDeleteGroup(group.id)}>
                        <Trash2 className="h-4 w-4 mr-2" />
                        <span>Delete Group</span>
                      </ContextMenuItem>
                    </>
                  )}
                </ContextMenuContent>
              </ContextMenu>
            ))}
          </div>
        </div>
      )}

      {/* Individual Macros */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between px-1 pb-1">
          <span className="text-[11px] font-semibold text-muted-foreground tracking-wider uppercase">
            MACROS ({filteredMacros.length})
          </span>
          <Tooltip content="New macro" side="bottom">
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onNewMacro}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </Tooltip>
        </div>
        {filteredMacros.length === 0 && (
          <div className="p-3 text-center text-xs space-y-2 bg-card/30 rounded-xl border border-dashed border-white/[0.08] my-1">
            <div className="flex h-8 w-8 mx-auto items-center justify-center rounded-lg bg-amber-400/10 text-amber-400 border border-amber-400/20">
              <Zap className="h-4 w-4" />
            </div>
            <div className="space-y-0.5">
              <h4 className="text-xs font-semibold text-foreground">
                {selectedFolder === "all" ? "No Macros Configured" : `No Macros in ${selectedFolder}`}
              </h4>
              <p className="text-[11px] text-muted-foreground leading-normal">
                Automate multi-step terminal workflows with 1-click execution.
              </p>
            </div>
            <div className="text-left text-[10px] space-y-1 p-2 rounded-lg bg-white/[0.02] border border-white/[0.04] text-muted-foreground">
              <span className="font-semibold text-foreground/80 block">Run Modes:</span>
              <div>• <strong className="text-amber-400">Interactive</strong>: Live interactive PTY terminal.</div>
              <div>• <strong className="text-sky-400">Direct</strong>: Silent raw execution in background.</div>
            </div>
            {onNewMacro && (
              <Button size="sm" onClick={onNewMacro} className="h-7 text-xs gap-1.5 w-full font-medium">
                <Plus className="h-3.5 w-3.5" />
                <span>Create Macro</span>
              </Button>
            )}
          </div>
        )}
        <div className="flex flex-col gap-1 overflow-y-auto pr-0.5">
          {filteredMacros.map((m) => {
            const assignedProfile = m.profileId ? profiles.find((p) => p.id === m.profileId) : undefined;
            return (
              <ContextMenu key={m.id}>
                <ContextMenuTrigger>
                  <div
                    className="group relative flex flex-col gap-1 rounded-lg px-2.5 py-1.5 hover:bg-white/[0.05] border border-transparent hover:border-white/[0.06] cursor-pointer select-none transition-all"
                    onClick={() => onRunMacro?.(m.id)}
                  >
                    {/* Top row: Icon + Name + Action buttons */}
                    <div className="flex items-center justify-between gap-1.5 min-w-0">
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <Zap className="h-3.5 w-3.5 flex-shrink-0 text-amber-400" />
                        <span
                          className="font-medium text-xs text-foreground truncate"
                          title={m.name}
                        >
                          {m.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                        <Tooltip content="Run macro" side="top">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-emerald-400"
                            onClick={(e) => {
                              e.stopPropagation();
                              onRunMacro?.(m.id);
                            }}
                          >
                            <Play className="h-3 w-3" />
                          </Button>
                        </Tooltip>
                        <Tooltip content="Edit macro" side="top">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-foreground"
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditMacro(m.id);
                            }}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                        </Tooltip>
                        <div onClick={(e) => e.stopPropagation()}>
                          <NativeDelete size="sm" onConfirm={() => {}} onDelete={() => onDelete(m.id)} />
                        </div>
                      </div>
                    </div>

                    {/* Details row: Run mode pill + target profile / shell + folder */}
                    <div className="flex items-center gap-1.5 pl-5 text-[10px] text-muted-foreground min-w-0 flex-wrap">
                      <span
                        className={`px-1.5 py-0.2 rounded font-sans text-[9px] font-semibold tracking-wide ${
                          m.runMode === "pty"
                            ? "bg-amber-400/10 text-amber-400 border border-amber-400/20"
                            : "bg-sky-400/10 text-sky-400 border border-sky-400/20"
                        }`}
                      >
                        {m.runMode === "pty" ? "Interactive" : "Direct"}
                      </span>
                      {m.profileId != null ? (
                        <span
                          className="truncate max-w-[110px] text-zinc-300"
                          title={profileName(m.profileId) ?? "Server"}
                        >
                          {profileName(m.profileId) ?? "Server"}
                        </span>
                      ) : (
                        <span className="text-zinc-400">Local</span>
                      )}
                      {m.folder && (
                        <span className="truncate max-w-[80px] text-zinc-500" title={m.folder}>
                          · {m.folder}
                        </span>
                      )}
                    </div>
                  </div>
                </ContextMenuTrigger>
                <ContextMenuContent ariaLabel={`Actions for ${m.name}`}>
                  <ContextMenuLabel>{m.name}</ContextMenuLabel>
                  <ContextMenuItem onSelect={() => onRunMacro?.(m.id)}>
                    <Play className="h-4 w-4 mr-2 text-emerald-400" />
                    <span>Run Macro</span>
                  </ContextMenuItem>
                  {assignedProfile ? (
                    <ContextMenuItem onSelect={() => onRunMacro?.(m.id, { profileId: assignedProfile.id })}>
                      <Server className="h-4 w-4 mr-2 text-cyan-400" />
                      <span>Run on {assignedProfile.name}</span>
                    </ContextMenuItem>
                  ) : (
                    <>
                      <ContextMenuItem onSelect={() => onRunMacro?.(m.id, { shell: "powershell" })}>
                        <Terminal className="h-4 w-4 mr-2 text-sky-400" />
                        <span>Run in PowerShell</span>
                      </ContextMenuItem>
                      <ContextMenuItem onSelect={() => onRunMacro?.(m.id, { shell: "cmd" })}>
                        <Terminal className="h-4 w-4 mr-2 text-amber-400" />
                        <span>Run in Command Prompt</span>
                      </ContextMenuItem>
                    </>
                  )}
                  <ContextMenuSeparator />
                  <ContextMenuItem onSelect={() => onEditMacro(m.id)}>
                    <Pencil className="h-4 w-4 mr-2 text-muted-foreground" />
                    <span>Edit Macro…</span>
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                  <ContextMenuItem tone="destructive" onSelect={() => onDelete(m.id)}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    <span>Delete Macro</span>
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            );
          })}
        </div>
      </div>
    </div>
  );
}
