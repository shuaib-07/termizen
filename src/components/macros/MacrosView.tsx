import { useState, useMemo } from "react";
import { Folder, Layers, Pencil, Play, Plus, Search, Server, Terminal, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeDelete } from "@/components/NativeDelete";
import { getFolderColor } from "@/lib/folderMetadata";
import { cn } from "@/lib/utils";
import type { MacroSummary, ProfileSummary } from "@/sessions";
import type { MacroGroupSummary } from "@/types";

export interface MacrosViewProps {
  macros: MacroSummary[];
  macroGroups?: MacroGroupSummary[];
  profiles: ProfileSummary[];
  onRunMacro: (macroId: number, options?: { profileId?: number; shell?: string }) => void;
  onNewMacro: () => void;
  onEditMacro: (id: number) => void;
  onDeleteMacro: (id: number) => void;
  onRunGroup?: (group: MacroGroupSummary) => void;
  onNewGroup?: () => void;
  onEditGroup?: (group: MacroGroupSummary) => void;
  onDeleteGroup?: (id: number) => void;
}

export default function MacrosView({
  macros,
  macroGroups = [],
  profiles,
  onRunMacro,
  onNewMacro,
  onEditMacro,
  onDeleteMacro,
  onRunGroup,
  onNewGroup,
  onEditGroup,
  onDeleteGroup,
}: MacrosViewProps) {
  const [search, setSearch] = useState("");
  const [filterFolder, setFilterFolder] = useState<string>("all");
  const [filterMode, setFilterMode] = useState<"all" | "pty" | "exec">("all");

  const profileName = (id?: number) => (id ? profiles.find((p) => p.id === id)?.name : undefined);

  // Extract all unique folders from macros and macro groups
  const folders = useMemo(() => {
    const set = new Set<string>();
    macros.forEach((m) => {
      if (m.folder?.trim()) set.add(m.folder.trim());
    });
    macroGroups.forEach((g) => {
      if (g.folder?.trim()) set.add(g.folder.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [macros, macroGroups]);

  // Filtered macros based on folder, mode, and search query
  const filteredMacros = useMemo(() => {
    return macros.filter((m) => {
      // Folder filter
      if (filterFolder !== "all" && m.folder !== filterFolder) return false;

      // Mode filter
      if (filterMode !== "all" && m.runMode !== filterMode) return false;

      // Search query
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      const nameMatch = m.name.toLowerCase().includes(q);
      const folderMatch = m.folder ? m.folder.toLowerCase().includes(q) : false;
      const targetName = profileName(m.profileId)?.toLowerCase() || "local";
      const targetMatch = targetName.includes(q);

      return nameMatch || folderMatch || targetMatch;
    });
  }, [macros, search, filterFolder, filterMode, profiles]);

  // Filtered groups based on folder and search query
  const filteredGroups = useMemo(() => {
    return macroGroups.filter((g) => {
      if (filterFolder !== "all" && g.folder !== filterFolder) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return g.name.toLowerCase().includes(q) || (g.folder && g.folder.toLowerCase().includes(q));
    });
  }, [macroGroups, search, filterFolder]);

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto p-6 scrollbar-thin">
      {/* Header Bar */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-400/10 text-amber-400 border border-amber-400/20 shrink-0">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-foreground">Macros</h1>
                <span className="rounded-full bg-amber-400/10 border border-amber-400/20 px-2 py-0.2 text-[10px] font-mono text-amber-400 font-semibold">
                  {macros.length}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Automate multi-step command sequences, zero-downtime server deployments, and daily tasks.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {onNewGroup && (
            <Button
              variant="outline"
              size="sm"
              onClick={onNewGroup}
              className="h-8 gap-1.5 text-xs border-border/60 hover:bg-card cursor-pointer"
            >
              <Layers className="h-3.5 w-3.5 text-amber-400" />
              <span>New Pipeline</span>
            </Button>
          )}
          <Button
            size="sm"
            onClick={onNewMacro}
            className="h-8 gap-1.5 text-xs bg-primary text-primary-foreground font-semibold shadow-sm cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>New Macro</span>
          </Button>
        </div>
      </div>

      {macros.length === 0 && macroGroups.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-8 sm:p-12 text-center border-dashed border-white/[0.08] bg-card/30 rounded-2xl space-y-4 max-w-2xl mx-auto my-auto">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-400/10 text-amber-400 border border-amber-400/20 shadow-inner">
            <Zap className="h-8 w-8" />
          </div>
          <div className="space-y-1.5 max-w-md">
            <h2 className="text-base font-bold text-foreground">No Macros Configured Yet</h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Create reusable command sequences that can run in an interactive shell or quietly in the background on any server profile.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full text-left my-2">
            <div className="p-3 rounded-xl border border-white/[0.06] bg-white/[0.02] space-y-1">
              <div className="text-[10px] font-mono font-bold text-amber-400 uppercase">01. STEPS & DELAYS</div>
              <div className="text-xs font-semibold text-foreground">Add Commands</div>
              <p className="text-[11px] text-muted-foreground leading-snug">
                Chain commands with custom delay intervals and error handling.
              </p>
            </div>

            <div className="p-3 rounded-xl border border-white/[0.06] bg-white/[0.02] space-y-1">
              <div className="text-[10px] font-mono font-bold text-sky-400 uppercase">02. EXECUTION MODE</div>
              <div className="text-xs font-semibold text-foreground">Interactive vs Direct</div>
              <p className="text-[11px] text-muted-foreground leading-snug">
                Watch live terminal output or execute quietly in the background.
              </p>
            </div>

            <div className="p-3 rounded-xl border border-white/[0.06] bg-white/[0.02] space-y-1">
              <div className="text-[10px] font-mono font-bold text-primary uppercase">03. GROUP PIPELINES</div>
              <div className="text-xs font-semibold text-foreground">Chain Pipelines</div>
              <p className="text-[11px] text-muted-foreground leading-snug">
                Bundle multiple macros into 1-click full deployment runs.
              </p>
            </div>
          </div>

          <Button
            onClick={onNewMacro}
            className="h-9 gap-2 text-xs bg-primary text-primary-foreground font-semibold px-4 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Create Your First Macro</span>
          </Button>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Filters & Search Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-2 w-full md:w-80 shrink-0">
              <div className="relative w-full">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Search macros by name, target, folder..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-8 pl-8 text-xs bg-card/60 border-border/60 w-full"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Mode Toggle Chips */}
              <div className="flex items-center gap-1 bg-muted/40 p-0.5 rounded-lg border border-border/40">
                <Button
                  variant={filterMode === "all" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setFilterMode("all")}
                  className="h-6 text-[10px] px-2 rounded-md font-medium"
                >
                  All Modes
                </Button>
                <Button
                  variant={filterMode === "pty" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setFilterMode("pty")}
                  className="h-6 text-[10px] px-2 rounded-md font-medium text-amber-400"
                >
                  Interactive
                </Button>
                <Button
                  variant={filterMode === "exec" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setFilterMode("exec")}
                  className="h-6 text-[10px] px-2 rounded-md font-medium text-sky-400"
                >
                  Direct
                </Button>
              </div>

              {/* Folder Filter Chips */}
              {folders.length > 0 && (
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar max-w-full">
                  <Button
                    variant={filterFolder === "all" ? "secondary" : "ghost"}
                    size="sm"
                    className="h-7 text-xs shrink-0"
                    onClick={() => setFilterFolder("all")}
                  >
                    All ({macros.length})
                  </Button>
                  {folders.map((f) => {
                    const color = getFolderColor(f);
                    const isSelected = filterFolder === f;
                    const count = macros.filter((m) => m.folder === f).length;
                    return (
                      <Button
                        key={f}
                        variant={isSelected ? "secondary" : "ghost"}
                        size="sm"
                        className="h-7 text-xs gap-1.5 shrink-0"
                        style={
                          color && isSelected
                            ? { backgroundColor: `${color}25`, borderColor: color, color }
                            : color
                            ? { color }
                            : undefined
                        }
                        onClick={() => setFilterFolder(isSelected ? "all" : f)}
                      >
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: color || "#888" }}
                        />
                        <span>{f}</span>
                        <span className="text-[10px] opacity-60">({count})</span>
                      </Button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Group Pipelines Section */}
          {filteredGroups.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-400/10 text-amber-400 border border-amber-400/20">
                    <Layers className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-bold text-foreground">Group Pipelines</h2>
                      <span className="rounded-full bg-amber-400/10 border border-amber-400/20 px-2 py-0.2 text-[10px] font-mono text-amber-400 font-semibold">
                        {filteredGroups.length}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Sequential multi-macro deployment pipelines with automated flow control.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredGroups.map((group) => {
                  const folderColor = group.folder ? getFolderColor(group.folder) : undefined;
                  return (
                    <Card
                      key={group.id}
                      className="p-4 bg-card/65 hover:bg-card border-white/[0.06] hover:border-white/[0.12] transition-all rounded-xl flex flex-col justify-between space-y-3 group"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="font-bold text-sm text-foreground truncate group-hover:text-amber-400 transition-colors">
                                {group.name}
                              </span>
                              {group.folder && (
                                <span
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border shrink-0"
                                  style={{
                                    backgroundColor: folderColor ? `${folderColor}18` : "var(--muted)",
                                    borderColor: folderColor ? `${folderColor}40` : "var(--border)",
                                    color: folderColor || "var(--muted-foreground)",
                                  }}
                                >
                                  <Folder className="h-2.5 w-2.5" />
                                  <span>{group.folder}</span>
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {group.macroCount} chained {group.macroCount === 1 ? "macro" : "macros"} •{" "}
                              {group.haltOnError ? "Halts on error" : "Continues on error"}
                            </span>
                          </div>

                          <div className="flex items-center gap-0.5 shrink-0">
                            {onEditGroup && (
                              <Tooltip content="Edit Pipeline" side="top">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => onEditGroup(group)}
                                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                              </Tooltip>
                            )}
                            {onDeleteGroup && (
                              <NativeDelete
                                size="sm"
                                onConfirm={() => {}}
                                onDelete={() => onDeleteGroup(group.id)}
                              />
                            )}
                          </div>
                        </div>
                      </div>

                      <Button
                        size="sm"
                        onClick={() => onRunGroup?.(group)}
                        className="w-full h-8 text-xs font-semibold bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 shadow-xs gap-1.5"
                      >
                        <Play className="h-3 w-3 fill-amber-300" />
                        <span>Run Pipeline</span>
                      </Button>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Individual Macros Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
                  <Zap className="h-4 w-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold text-foreground">Macros List</h2>
                    <span className="rounded-full bg-primary/10 border border-primary/20 px-2 py-0.2 text-[10px] font-mono text-primary font-semibold">
                      {filteredMacros.length}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Stand-alone automated command sequences executable on servers or local shell.
                  </p>
                </div>
              </div>
            </div>

            {filteredMacros.length === 0 ? (
              <Card className="flex flex-col items-center justify-center p-8 text-center border-dashed border-white/[0.08] bg-card/30 rounded-xl space-y-2">
                <Search className="h-6 w-6 text-muted-foreground/60 mb-1" />
                <h3 className="text-xs font-semibold text-foreground">No matching macros</h3>
                <p className="text-[11px] text-muted-foreground">
                  No macros matched your current search or filter. Try searching for something else.
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearch("");
                    setFilterFolder("all");
                    setFilterMode("all");
                  }}
                  className="h-7 text-xs mt-1"
                >
                  Clear filters
                </Button>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredMacros.map((m) => {
                  const folderColor = m.folder ? getFolderColor(m.folder) : undefined;
                  const targetProfile = m.profileId ? profiles.find((p) => p.id === m.profileId) : undefined;
                  return (
                    <Card
                      key={m.id}
                      className="p-4 bg-card/75 hover:bg-card border-white/[0.06] hover:border-white/[0.12] transition-all rounded-xl flex flex-col justify-between space-y-3 group"
                    >
                      <div>
                        {/* Header Row */}
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap mb-1">
                              <span className="font-bold text-sm text-foreground truncate group-hover:text-primary transition-colors">
                                {m.name}
                              </span>

                              {/* Folder Tag */}
                              {m.folder && (
                                <span
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border shrink-0"
                                  style={{
                                    backgroundColor: folderColor ? `${folderColor}18` : "var(--muted)",
                                    borderColor: folderColor ? `${folderColor}40` : "var(--border)",
                                    color: folderColor || "var(--muted-foreground)",
                                  }}
                                >
                                  <Folder className="h-2.5 w-2.5" />
                                  <span>{m.folder}</span>
                                </span>
                              )}
                            </div>

                            {/* Badges: Run Mode & Target */}
                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                              <span
                                className={cn(
                                  "px-1.5 py-0.2 rounded font-sans text-[9px] font-semibold tracking-wide border",
                                  m.runMode === "pty"
                                    ? "bg-amber-400/10 text-amber-400 border-amber-400/20"
                                    : "bg-sky-400/10 text-sky-400 border-sky-400/20"
                                )}
                              >
                                {m.runMode === "pty" ? "Interactive" : "Direct"}
                              </span>

                              <span>•</span>

                              <span className="flex items-center gap-1 font-mono text-zinc-300">
                                {targetProfile ? (
                                  <>
                                    <Server className="h-2.5 w-2.5 text-cyan-400" />
                                    <span className="truncate max-w-[120px]">{targetProfile.name}</span>
                                  </>
                                ) : (
                                  <>
                                    <Terminal className="h-2.5 w-2.5 text-muted-foreground" />
                                    <span>Local</span>
                                  </>
                                )}
                              </span>

                              <span>•</span>
                              <span>{m.stepCount} {m.stepCount === 1 ? "step" : "steps"}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-0.5 shrink-0">
                            <Tooltip content="Edit Macro" side="top">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => onEditMacro(m.id)}
                                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            </Tooltip>
                            <NativeDelete
                              size="sm"
                              onConfirm={() => {}}
                              onDelete={() => onDeleteMacro(m.id)}
                            />
                          </div>
                        </div>

                        {/* Policy info */}
                        <div className="text-[10px] text-muted-foreground/80 font-mono py-1 px-2 rounded-md bg-zinc-900/50 border border-white/[0.04]">
                          {m.haltOnError ? "⚠️ Stops immediately on error" : "✓ Ignores non-fatal errors"}
                        </div>
                      </div>

                      {/* Run CTA */}
                      <Button
                        size="sm"
                        onClick={() => onRunMacro(m.id)}
                        className="w-full h-8 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs gap-1.5"
                      >
                        <Play className="h-3.5 w-3.5 fill-current" />
                        <span>Run Macro</span>
                      </Button>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
