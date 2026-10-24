import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import { Folder, Layers, Plus, Server, Terminal, Trash2, Zap } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AnimatedCombobox, type ComboboxItem } from "@/components/ui/combobox";
import { FolderModal } from "@/components/folders/FolderModal";
import { getFolderColor, getEmptyFolders, addEmptyFolder } from "@/lib/folderMetadata";
import { getMacroSteps } from "@/sessions";
import { cn } from "@/lib/utils";
import type { GridPreset, MacroSummary, ProfileSummary, WorkspaceSummary, WorkspaceTerminalDef } from "@/types";

export interface WorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (params: {
    id?: number;
    name: string;
    folder?: string;
    layoutMode: "tabs" | "split";
    gridPreset?: GridPreset;
    terminals: WorkspaceTerminalDef[];
  }) => Promise<void>;
  editingWorkspace?: WorkspaceSummary | null;
  profiles: ProfileSummary[];
  macros?: MacroSummary[];
}

export default function WorkspaceModal({
  isOpen,
  onClose,
  onSave,
  editingWorkspace,
  profiles,
  macros = [],
}: WorkspaceModalProps) {
  const [name, setName] = useState("");
  const [folder, setFolder] = useState("");
  const [newFolderModalOpen, setNewFolderModalOpen] = useState(false);
  const [layoutMode, setLayoutMode] = useState<"tabs" | "split">("tabs");
  const [gridPreset, setGridPreset] = useState<GridPreset>("auto");
  const [terminals, setTerminals] = useState<WorkspaceTerminalDef[]>([
    {
      position: 0,
      title: "Terminal 1",
      targetKind: "local",
      shell: "powershell",
      cwd: "",
      startupCommand: "",
    },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (editingWorkspace) {
      setName(editingWorkspace.name);
      setFolder(editingWorkspace.folder || "");
      setLayoutMode(editingWorkspace.layoutMode);
      setGridPreset(editingWorkspace.gridPreset || "auto");
      setTerminals(
        editingWorkspace.terminals.length > 0
          ? editingWorkspace.terminals
          : [
              {
                position: 0,
                title: "Terminal 1",
                targetKind: "local",
                shell: "powershell",
                cwd: "",
                startupCommand: "",
              },
            ]
      );
    } else {
      setName("");
      setFolder("");
      setLayoutMode("tabs");
      setGridPreset("auto");
      setTerminals([
        {
          position: 0,
          title: "",
          targetKind: "local",
          shell: "powershell",
          cwd: "",
          startupCommand: "",
        },
      ]);
    }
  }, [editingWorkspace, isOpen]);

  const applyMacroToTerminal = async (index: number, macroId: number) => {
    const m = macros.find((mac) => mac.id === macroId);
    if (!m) return;
    try {
      const steps = await getMacroSteps(m.id);
      updateTerminal(index, {
        title: terminals[index]?.title?.trim() ? terminals[index].title : m.name,
        startupCommand: steps.join("\n"),
        targetKind: m.profileId ? "ssh" : "local",
        profileId: m.profileId ?? undefined,
        shell: m.shell || "powershell",
      });
    } catch (e) {
      console.warn("Failed to load macro steps:", e);
    }
  };

  const addTerminalFromMacro = async (macroId: number) => {
    const m = macros.find((mac) => mac.id === macroId);
    if (!m) return;
    try {
      const steps = await getMacroSteps(m.id);
      setTerminals((prev) => [
        ...prev,
        {
          position: prev.length,
          title: m.name,
          targetKind: m.profileId ? "ssh" : "local",
          profileId: m.profileId ?? undefined,
          shell: m.shell || "powershell",
          cwd: "",
          startupCommand: steps.join("\n"),
        },
      ]);
    } catch (e) {
      console.warn("Failed to load macro steps:", e);
    }
  };

  const existingFolders = useMemo(() => {
    return Array.from(
      new Set([
        ...profiles.map((p) => p.folder).filter((f): f is string => !!f && f.trim().length > 0),
        ...getEmptyFolders(),
      ])
    ).sort((a, b) => a.localeCompare(b));
  }, [profiles, folder]);

  const folderComboboxItems: ComboboxItem[] = useMemo(() => {
    return existingFolders.map((f) => ({
      value: f,
      label: f,
      color: getFolderColor(f),
      icon: <Folder className="h-3.5 w-3.5" />,
    }));
  }, [existingFolders]);

  const sshProfileItems: ComboboxItem[] = useMemo(() => {
    return profiles
      .filter((p) => p.kind === "ssh")
      .map((p) => ({
        value: String(p.id),
        label: p.name,
        description: `${p.username}@${p.host}`,
        icon: <Server className="h-3.5 w-3.5 text-primary" />,
      }));
  }, [profiles]);

  const addTerminal = () => {
    setTerminals((prev) => [
      ...prev,
      {
        position: prev.length,
        title: `Terminal ${prev.length + 1}`,
        targetKind: "local",
        shell: "powershell",
        cwd: "",
        startupCommand: "",
      },
    ]);
  };

  const updateTerminal = (index: number, updates: Partial<WorkspaceTerminalDef>) => {
    setTerminals((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...updates };
      return next;
    });
  };

  const removeTerminal = (index: number) => {
    if (terminals.length <= 1) return;
    setTerminals((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setIsSubmitting(true);
    try {
      await onSave({
        id: editingWorkspace?.id,
        name: name.trim(),
        folder: folder.trim() || undefined,
        layoutMode,
        gridPreset: layoutMode === "split" ? gridPreset : undefined,
        terminals,
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={editingWorkspace ? "Edit Workspace" : "Create Workspace"} maxWidth="max-w-2xl">
      <div className="space-y-4 text-xs">
        {/* Workspace Name & Folder */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground">Workspace Name</label>
            <Input
              placeholder="e.g. Zoopify Full Stack"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-8 text-xs bg-zinc-900 border-white/[0.08]"
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-medium text-muted-foreground">Folder Group (Optional)</label>
            </div>
            <AnimatedCombobox
              value={folder}
              onChange={(val) => {
                setFolder(val);
                if (val.trim() && !existingFolders.includes(val.trim())) {
                  addEmptyFolder(val.trim());
                }
              }}
              items={folderComboboxItems}
              placeholder="Select folder..."
              allowCreate
              createPrefix="Create folder"
              clearLabel="No Folder"
              clearValue=""
              icon={<Folder className="h-3.5 w-3.5" />}
              className="w-full"
              onCreateNew={() => setNewFolderModalOpen(true)}
              createNewText="Create new folder..."
            />
          </div>
        </div>

        {/* Layout Selection */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-medium text-muted-foreground">Launch Layout</label>
          <div className="grid grid-cols-2 gap-2 relative">
            <button
              type="button"
              onClick={() => setLayoutMode("tabs")}
              className={cn(
                "relative z-10 flex items-center gap-2 p-2.5 rounded-xl border text-left transition-colors cursor-pointer",
                layoutMode === "tabs"
                  ? "text-foreground font-semibold"
                  : "bg-card/40 border-white/[0.06] text-muted-foreground hover:border-white/[0.12]"
              )}
            >
              {layoutMode === "tabs" && (
                <motion.div
                  layoutId="workspace-layout-mode-pill"
                  className="absolute inset-0 z-[-1] rounded-xl border border-primary bg-primary/10 shadow-xs"
                  transition={{ type: "spring", duration: 0.35, bounce: 0.15 }}
                />
              )}
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/20 text-primary flex-shrink-0">
                <Layers className="h-4 w-4" />
              </div>
              <div>
                <div className="font-semibold text-xs text-foreground">Separate Tabs</div>
                <div className="text-[10px] text-muted-foreground">Opens each terminal in its own tab</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setLayoutMode("split")}
              className={cn(
                "relative z-10 flex items-center gap-2 p-2.5 rounded-xl border text-left transition-colors cursor-pointer",
                layoutMode === "split"
                  ? "text-foreground font-semibold"
                  : "bg-card/40 border-white/[0.06] text-muted-foreground hover:border-white/[0.12]"
              )}
            >
              {layoutMode === "split" && (
                <motion.div
                  layoutId="workspace-layout-mode-pill"
                  className="absolute inset-0 z-[-1] rounded-xl border border-primary bg-primary/10 shadow-xs"
                  transition={{ type: "spring", duration: 0.35, bounce: 0.15 }}
                />
              )}
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-400/20 text-amber-400 flex-shrink-0">
                <Terminal className="h-4 w-4" />
              </div>
              <div>
                <div className="font-semibold text-xs text-foreground">Split Panes (Grid)</div>
                <div className="text-[10px] text-muted-foreground">Up to 6 resizable terminals in 1 tab</div>
              </div>
            </button>

            {layoutMode === "split" && (
              <div className="col-span-2 pt-1">
                <label className="text-[11px] font-medium text-muted-foreground block mb-1.5">
                  Grid Preset (Up to 6 terminals in 1 tab)
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {(
                    [
                      { id: "auto", label: "Auto Grid", desc: "Adaptive 1-6" },
                      { id: "2x2", label: "2x2 Quad", desc: "4 Panes" },
                      { id: "2x3", label: "2x3 Grid", desc: "6 Panes" },
                      { id: "1+2", label: "1 + 2 Main", desc: "3 Panes" },
                      { id: "1x2", label: "Side-by-Side", desc: "2 Columns" },
                      { id: "2x1", label: "Stacked", desc: "2 Rows" },
                      { id: "3x1", label: "3 Columns", desc: "3 Columns" },
                      { id: "3x2", label: "3x2 Grid", desc: "6 Panes" },
                    ] as const
                  ).map((p) => {
                    const isSelected = gridPreset === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setGridPreset(p.id)}
                        className={cn(
                          "relative px-2 py-1.5 rounded-lg border text-left transition-colors cursor-pointer",
                          isSelected
                            ? "bg-primary/10 border-primary text-foreground font-semibold shadow-xs"
                            : "bg-card/30 border-white/[0.06] text-muted-foreground hover:border-white/[0.12] hover:text-foreground"
                        )}
                      >
                        <div className="text-[11px] leading-tight font-medium">{p.label}</div>
                        <div className="text-[9px] text-muted-foreground">{p.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Terminals List */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Terminals to Launch ({terminals.length})
            </label>
            <div className="flex items-center gap-1.5">
              {macros.length > 0 && (
                <Select
                  value=""
                  onValueChange={(val) => {
                    if (val) addTerminalFromMacro(Number(val));
                  }}
                >
                  <SelectTrigger className="h-6 px-2 text-[11px] bg-amber-400/10 border border-amber-400/30 text-amber-300 hover:bg-amber-400/20 w-auto gap-1">
                    <Zap className="h-3 w-3" />
                    <span>+ From Macro</span>
                  </SelectTrigger>
                  <SelectContent>
                    {macros.map((m) => (
                      <SelectItem key={m.id} value={String(m.id)}>
                        {m.name} {m.folder ? `(${m.folder})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Button size="sm" variant="outline" onClick={addTerminal} className="h-6 px-2 text-[11px]">
                <Plus className="h-3 w-3 mr-1" />
                Add Terminal
              </Button>
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto space-y-2.5 pr-1 scrollbar-thin">
            {terminals.map((term, index) => (
              <div
                key={index}
                className="p-3 rounded-xl border border-white/[0.06] bg-zinc-900/60 space-y-2 relative group"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1">
                    <span className="font-mono text-[10px] text-muted-foreground">{index + 1}.</span>
                    <Input
                      placeholder={`Terminal ${index + 1} (e.g. Backend API, DB Tunnel)`}
                      value={term.title}
                      onChange={(e) => updateTerminal(index, { title: e.target.value })}
                      className="h-7 text-xs bg-zinc-950/80 border-white/[0.08] flex-1"
                    />
                    {macros.length > 0 && (
                      <Select
                        value=""
                        onValueChange={(val) => {
                          if (val) applyMacroToTerminal(index, Number(val));
                        }}
                      >
                        <SelectTrigger className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground bg-zinc-950 border-white/[0.08] w-auto gap-1" title="Populate settings from existing macro">
                          <Zap className="h-3 w-3 text-amber-400" />
                          <span className="hidden sm:inline">Macro</span>
                        </SelectTrigger>
                        <SelectContent>
                          {macros.map((m) => (
                            <SelectItem key={m.id} value={String(m.id)}>
                              {m.name} {m.folder ? `(${m.folder})` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Select
                      value={term.targetKind}
                      onValueChange={(val) =>
                        updateTerminal(index, { targetKind: val as "local" | "ssh" })
                      }
                    >
                      <SelectTrigger className="h-7 w-28 text-xs bg-zinc-950 border-white/[0.08]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="local">Local Shell</SelectItem>
                        <SelectItem value="ssh">SSH Server</SelectItem>
                      </SelectContent>
                    </Select>

                    {terminals.length > 1 && (
                      <Tooltip content="Remove terminal" side="top">
                        <button
                          type="button"
                          onClick={() => removeTerminal(index)}
                          className="p-1 rounded text-muted-foreground/60 hover:text-red-400 transition-colors cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </Tooltip>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {term.targetKind === "local" ? (
                    <>
                      <Select
                        value={term.shell || "powershell"}
                        onValueChange={(val) => updateTerminal(index, { shell: val })}
                      >
                        <SelectTrigger className="h-7 text-xs bg-zinc-950 border-white/[0.08]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="powershell">PowerShell</SelectItem>
                          <SelectItem value="cmd">Command Prompt</SelectItem>
                          <SelectItem value="wsl">WSL (Linux)</SelectItem>
                        </SelectContent>
                      </Select>

                      <Input
                        placeholder="Working Dir (e.g. c:\zoopify\backend)"
                        value={term.cwd || ""}
                        onChange={(e) => updateTerminal(index, { cwd: e.target.value })}
                        className="h-7 text-xs bg-zinc-950/80 border-white/[0.08]"
                      />
                    </>
                  ) : (
                    <div className="col-span-2">
                      <AnimatedCombobox
                        value={term.profileId != null ? String(term.profileId) : ""}
                        onChange={(val) =>
                          updateTerminal(index, {
                            profileId: val ? Number(val) : undefined,
                          })
                        }
                        items={sshProfileItems}
                        placeholder="Select SSH Profile..."
                        searchPlaceholder="Search SSH profile..."
                        className="w-full text-xs"
                      />
                    </div>
                  )}
                </div>

                {/* Startup Commands (Multi-line) */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <label className="font-medium text-muted-foreground">Startup Commands (multi-line)</label>
                    <span className="text-[10px] text-muted-foreground/60">One command per line</span>
                  </div>
                  <textarea
                    rows={3}
                    placeholder={"e.g.\n.\\venv\\Scripts\\activate\nuvicorn main:app --reload"}
                    value={term.startupCommand || ""}
                    onChange={(e) => updateTerminal(index, { startupCommand: e.target.value })}
                    className="w-full rounded-lg border border-white/[0.08] bg-zinc-950/80 p-2 font-mono text-[11px] shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/50 text-foreground resize-y scrollbar-thin"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-2 border-t border-border/40">
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting} className="h-8 text-xs">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!name.trim() || isSubmitting} className="h-8 text-xs bg-primary text-primary-foreground">
            {isSubmitting ? "Saving..." : editingWorkspace ? "Save Changes" : "Create Workspace"}
          </Button>
        </div>
      </div>

      {/* Create New Folder Modal */}
      <FolderModal
        isOpen={newFolderModalOpen}
        onClose={() => setNewFolderModalOpen(false)}
        existingFolders={existingFolders}
        onSave={async (_, newName, color) => {
          addEmptyFolder(newName, color);
          setFolder(newName);
          setNewFolderModalOpen(false);
        }}
      />
    </Modal>
  );
}
