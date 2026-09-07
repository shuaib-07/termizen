import { Pencil, Play, Plus, Server, Terminal, Trash2, Zap } from "lucide-react";
import type { MacroSummary, ProfileSummary } from "./sessions";
import { Button } from "@/components/ui/button";
import { NativeDelete } from "@/components/NativeDelete";
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
  profiles,
  onNewMacro,
  onRunMacro,
  onEditMacro,
  onDelete,
}: {
  macros: MacroSummary[];
  profiles: ProfileSummary[];
  onNewMacro: () => void;
  onRunMacro?: (macroId: number, options?: { profileId?: number; shell?: string }) => void;
  onEditMacro: (id: number) => void;
  onDelete: (id: number) => void;
}) {
  const profileName = (id?: number) => profiles.find((p) => p.id === id)?.name;

  return (
    <div className="flex h-full flex-col p-2">
      <div className="flex items-center justify-between px-1 pb-1">
        <span className="text-[11px] font-semibold text-muted-foreground">MACROS</span>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onNewMacro} title="New macro">
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
      {macros.length === 0 && <div className="px-1 text-sm text-muted-foreground/70">No macros yet</div>}
      <div className="flex flex-col gap-0.5 overflow-y-auto">
        {macros.map((m) => {
          const assignedProfile = m.profileId ? profiles.find((p) => p.id === m.profileId) : undefined;
          return (
            <ContextMenu key={m.id}>
              <ContextMenuTrigger>
                <div
                  className="group flex items-center gap-1.5 rounded-md px-1.5 py-1 text-sm hover:bg-accent/40 cursor-pointer select-none transition-colors"
                  onClick={() => onRunMacro?.(m.id)}
                >
                  <Zap className="h-3.5 w-3.5 flex-shrink-0 text-amber-400" />
                  <span className="flex-1 truncate">
                    <span className="font-medium text-foreground">{m.name}</span>{" "}
                    <span className="text-[11px] text-muted-foreground">
                      ({m.runMode}
                      {m.profileId != null ? ` · ${profileName(m.profileId) ?? "profile"}` : ""}
                      {m.folder ? ` · ${m.folder}` : ""})
                    </span>
                  </span>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-emerald-400"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRunMacro?.(m.id);
                      }}
                      title="Run macro"
                    >
                      <Play className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditMacro(m.id);
                      }}
                      title="Edit macro"
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <div onClick={(e) => e.stopPropagation()}>
                      <NativeDelete size="sm" onConfirm={() => {}} onDelete={() => onDelete(m.id)} />
                    </div>
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
  );
}
