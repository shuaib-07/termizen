import { Layers, Pencil, Play, Plus, Server, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
  const handleEdit = (ws: WorkspaceSummary) => {
    onEditWorkspace(ws);
  };

  const handleCreate = () => {
    onNewWorkspace();
  };

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
        <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed border-white/[0.08] bg-card/40">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground mb-3">
            <Layers className="h-6 w-6 opacity-60" />
          </div>
          <h3 className="font-semibold text-sm text-foreground">No Workspaces configured</h3>
          <p className="text-xs text-muted-foreground max-w-sm mt-1 mb-4">
            Group your project's terminals (e.g. Postgres DB tunnel, FastAPI backend, Vite dev server) into a 1-click launch configuration.
          </p>
          <Button onClick={handleCreate} className="h-8 text-xs">
            <Plus className="h-3.5 w-3.5 mr-1" />
            Create Workspace
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {workspaces.map((ws) => {
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
                            className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.2 rounded-full border border-white/[0.06] bg-white/[0.03]"
                            style={{ color: folderColor || "inherit" }}
                          >
                            <span
                              className="h-1.5 w-1.5 rounded-full"
                              style={{ backgroundColor: folderColor || "#888" }}
                            />
                            <span>{ws.folder}</span>
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground capitalize">
                        {ws.layoutMode === "tabs" ? "Separate Tabs" : "Split Panes"} • {ws.terminals.length} terminals
                      </span>
                    </div>

                    <div className="flex items-center gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(ws)}
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        title="Edit Workspace"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
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
  );
}
