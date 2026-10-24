import { useState, useMemo } from "react";
import { Folder, Layers, Pencil, Play, Plus, Search, Server, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeDelete } from "@/components/NativeDelete";
import { getFolderColor } from "@/lib/folderMetadata";

import type { ProfileSummary, WorkspaceSummary, WorkspaceTerminalDef } from "@/types";

export interface WorkspacesViewProps {
  workspaces: WorkspaceSummary[];
  profiles: ProfileSummary[];
  onLaunchWorkspace: (workspace: WorkspaceSummary) => void;
  onSaveWorkspace: (params: {
    id?: number;
    name: string;
    folder?: string;
    layoutMode: "tabs" | "split";
    terminals: WorkspaceTerminalDef[];
  }) => Promise<void>;
  onDeleteWorkspace: (id: number) => Promise<void>;
  onNewWorkspace: () => void;
  onEditWorkspace: (workspace: WorkspaceSummary) => void;
}

export default function WorkspacesView({
  workspaces,
  profiles: _profiles,
  onLaunchWorkspace,
  onSaveWorkspace: _onSaveWorkspace,
  onDeleteWorkspace,
  onNewWorkspace,
  onEditWorkspace,
}: WorkspacesViewProps) {
  const [search, setSearch] = useState("");
  const [filterFolder, setFilterFolder] = useState<string>("all");

  const handleEdit = (ws: WorkspaceSummary) => {
    onEditWorkspace(ws);
  };

  const handleCreate = () => {
    onNewWorkspace();
  };

  const folders = useMemo(() => {
    const set = new Set<string>();
    workspaces.forEach((w) => {
      if (w.folder) set.add(w.folder);
    });
    return Array.from(set).sort();
  }, [workspaces]);

  const filteredWorkspaces = useMemo(() => {
    return workspaces.filter((ws) => {
      // Folder filter
      if (filterFolder !== "all" && ws.folder !== filterFolder) return false;

      // Search query
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      const nameMatch = ws.name.toLowerCase().includes(q);
      const folderMatch = ws.folder ? ws.folder.toLowerCase().includes(q) : false;
      const terminalMatch = ws.terminals.some(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.startupCommand && t.startupCommand.toLowerCase().includes(q)) ||
          (t.cwd && t.cwd.toLowerCase().includes(q))
      );
      return nameMatch || folderMatch || terminalMatch;
    });
  }, [workspaces, search, filterFolder]);

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto p-6 scrollbar-thin">
      {/* Header Bar */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
              <Layers className="h-4 w-4" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Workspaces</h1>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Launch multi-terminal environments (database tunnel, backend, frontend) with 1 click.
          </p>
        </div>

        <Button onClick={handleCreate} className="h-8 gap-1.5 text-xs bg-primary text-primary-foreground">
          <Plus className="h-3.5 w-3.5" />
          <span>New Workspace</span>
        </Button>
      </div>

      {/* Grid of Workspaces */}
      {workspaces.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-8 sm:p-12 text-center border-dashed border-white/[0.08] bg-card/30 rounded-2xl space-y-4 max-w-2xl mx-auto my-auto">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/20 shadow-inner">
            <Layers className="h-8 w-8" />
          </div>
          <div className="space-y-1.5 max-w-md">
            <h2 className="text-base font-bold text-foreground">No Workspaces Configured Yet</h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Workspaces bundle your multi-service tech stacks into a single preset so you can launch databases, backends, and frontend dev servers with 1 click.
            </p>
          </div>

          {/* 3 Step Onboarding Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full text-left my-2">
            <div className="p-3 rounded-xl border border-white/[0.06] bg-white/[0.02] space-y-1">
              <div className="text-[10px] font-mono font-bold text-primary">01. DEFINE STACK</div>
              <div className="text-xs font-semibold text-foreground">Add Terminals</div>
              <p className="text-[11px] text-muted-foreground leading-snug">
                Include local PowerShell/Bash or remote SSH servers.
              </p>
            </div>

            <div className="p-3 rounded-xl border border-white/[0.06] bg-white/[0.02] space-y-1">
              <div className="text-[10px] font-mono font-bold text-primary">02. AUTO COMMANDS</div>
              <div className="text-xs font-semibold text-foreground">Startup Scripts</div>
              <p className="text-[11px] text-muted-foreground leading-snug">
                Configure auto-run commands and working directories.
              </p>
            </div>

            <div className="p-3 rounded-xl border border-white/[0.06] bg-white/[0.02] space-y-1">
              <div className="text-[10px] font-mono font-bold text-primary">03. 1-CLICK LAUNCH</div>
              <div className="text-xs font-semibold text-foreground">Split Grid or Tabs</div>
              <p className="text-[11px] text-muted-foreground leading-snug">
                Launch into up to 6 resizable split panes in one tab.
              </p>
            </div>
          </div>

          <Button onClick={handleCreate} className="h-9 gap-2 text-xs bg-primary text-primary-foreground font-semibold px-4 cursor-pointer">
            <Plus className="h-4 w-4" />
            <span>Create Your First Workspace</span>
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
                  placeholder="Search workspaces by name, folder, terminal..."
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
                  All ({workspaces.length})
                </Button>
                {folders.map((f) => {
                  const color = getFolderColor(f);
                  const isSelected = filterFolder === f;
                  const count = workspaces.filter((w) => w.folder === f).length;
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

          {filteredWorkspaces.length === 0 ? (
            <Card className="flex flex-col items-center justify-center p-8 text-center border-dashed border-white/[0.08] bg-card/30 rounded-xl space-y-2">
              <Search className="h-6 w-6 text-muted-foreground/60 mb-1" />
              <h3 className="text-xs font-semibold text-foreground">No matching workspaces</h3>
              <p className="text-[11px] text-muted-foreground">
                No workspaces matched "{search}". Try searching for something else.
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setFilterFolder("all");
                }}
                className="h-7 text-xs mt-1"
              >
                Clear search
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredWorkspaces.map((ws) => {
                const folderColor = ws.folder ? getFolderColor(ws.folder) : undefined;
                return (
                  <Card
                    key={ws.id}
                    className="flex flex-col justify-between p-4 bg-card/75 hover:bg-card border-white/[0.06] hover:border-white/[0.12] transition-all group"
                  >
                    <div>
                      {/* Top Bar */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-sm text-foreground">{ws.name}</span>
                            {ws.folder && (
                              <span
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border shrink-0"
                                style={{
                                  backgroundColor: folderColor ? `${folderColor}18` : "var(--muted)",
                                  borderColor: folderColor ? `${folderColor}40` : "var(--border)",
                                  color: folderColor || "var(--muted-foreground)",
                                }}
                              >
                                <Folder className="h-2.5 w-2.5" />
                                <span>{ws.folder}</span>
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-muted-foreground capitalize">
                            {ws.layoutMode === "tabs" ? "Separate Tabs" : "Split Panes"} • {ws.terminals.length} terminals
                          </span>
                        </div>

                        <div className="flex items-center gap-0.5">
                          <Tooltip content="Edit Workspace" side="top">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(ws)}
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </Tooltip>
                          <NativeDelete
                            size="sm"
                            onConfirm={() => {}}
                            onDelete={() => onDeleteWorkspace(ws.id)}
                          />
                        </div>
                      </div>

                      {/* Terminals Overview */}
                      <div className="space-y-1.5 my-3">
                        {ws.terminals.map((term, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-zinc-900/60 border border-white/[0.04] text-xs"
                          >
                            <div className="flex items-center gap-2 truncate">
                              {term.targetKind === "ssh" ? (
                                <Server className="h-3 w-3 text-cyan-400 flex-shrink-0" />
                              ) : (
                                <Terminal className="h-3 w-3 text-amber-400 flex-shrink-0" />
                              )}
                              <span className="font-medium text-foreground truncate">{term.title}</span>
                              {term.cwd && (
                                <span className="text-[10px] text-muted-foreground truncate font-mono">
                                  ({term.cwd})
                                </span>
                              )}
                            </div>

                            {term.startupCommand && (
                              <span className="text-[9px] font-mono text-muted-foreground/80 px-1 py-0.5 rounded bg-white/[0.04] truncate max-w-[120px]">
                                {term.startupCommand}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Launch Action */}
                    <Button
                      onClick={() => onLaunchWorkspace(ws)}
                      className="w-full h-8 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs gap-1.5 mt-2"
                    >
                      <Play className="h-3.5 w-3.5 fill-current" />
                      <span>Launch Workspace</span>
                    </Button>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
