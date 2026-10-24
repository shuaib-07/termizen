import { useEffect, useState, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { AnimatedCombobox, type ComboboxItem } from "@/components/ui/combobox";
import { Loader } from "@/components/Loader";
import { Folder, Play, Plus, Server } from "lucide-react";
import { FolderModal } from "@/components/folders/FolderModal";
import { cn } from "@/lib/utils";
import { getFolderColor, getEmptyFolders, addEmptyFolder } from "@/lib/folderMetadata";
import { getMacroSteps } from "@/sessions";
import type { MacroSummary, ProfileSummary, SaveMacroParams } from "@/sessions";

export interface MacroModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingMacroId?: number | null;
  defaultFolder?: string;
  profiles: ProfileSummary[];
  macros: MacroSummary[];
  onSaveMacro: (params: SaveMacroParams, macroId?: number) => Promise<void> | void;
}

export function MacroModal({
  isOpen,
  onClose,
  editingMacroId,
  defaultFolder,
  profiles,
  macros,
  onSaveMacro,
}: MacroModalProps) {
  const editing = useMemo(
    () => (editingMacroId != null ? macros.find((m) => m.id === editingMacroId) : null),
    [editingMacroId, macros]
  );

  const [name, setName] = useState("");
  const [runMode, setRunMode] = useState<"exec" | "pty">("exec");
  const [haltOnError, setHaltOnError] = useState(true);
  const [folder, setFolder] = useState("");
  const [newFolderModalOpen, setNewFolderModalOpen] = useState(false);
  const [targetEnv, setTargetEnv] = useState<"active" | "local" | "server">("active");
  const [localShell, setLocalShell] = useState<"powershell" | "cmd" | "wsl">("powershell");
  const [selectedProfileId, setSelectedProfileId] = useState<number | undefined>(undefined);
  const [stepsText, setStepsText] = useState("");
  const [loadingSteps, setLoadingSteps] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Collect existing folders
  const existingFolders = useMemo(() => {
    return Array.from(
      new Set([
        ...profiles.map((p) => p.folder).filter((f): f is string => !!f && f.trim().length > 0),
        ...macros.map((m) => m.folder).filter((f): f is string => !!f && f.trim().length > 0),
        ...getEmptyFolders(),
      ])
    ).sort((a, b) => a.localeCompare(b));
  }, [profiles, macros, folder]);

  const folderComboboxItems: ComboboxItem[] = useMemo(() => {
    return existingFolders.map((f) => ({
      value: f,
      label: f,
      color: getFolderColor(f),
      icon: <Folder className="h-3.5 w-3.5" />,
    }));
  }, [existingFolders]);

  const serverComboboxItems: ComboboxItem[] = useMemo(() => {
    return profiles
      .filter((p) => p.kind === "ssh")
      .map((p) => ({
        value: String(p.id),
        label: p.name,
        description: p.host,
        icon: <Server className="h-3.5 w-3.5 text-zinc-400" />,
      }));
  }, [profiles]);

  // Reset or load macro data when modal opens or editingMacroId changes
  useEffect(() => {
    if (!isOpen) return;

    setError(null);
    setIsSubmitting(false);

    if (editing) {
      setName(editing.name);
      setRunMode(editing.runMode);
      setHaltOnError(editing.haltOnError);
      setFolder(editing.folder ?? "");

      if (editing.profileId != null) {
        setTargetEnv("server");
        setSelectedProfileId(editing.profileId);
        setLocalShell("powershell");
      } else if (
        editing.shell === "powershell" ||
        editing.shell === "cmd" ||
        editing.shell === "wsl"
      ) {
        setTargetEnv("local");
        setLocalShell(editing.shell as "powershell" | "cmd" | "wsl");
        setSelectedProfileId(undefined);
      } else {
        setTargetEnv("active");
        setSelectedProfileId(undefined);
        setLocalShell("powershell");
      }

      setLoadingSteps(true);

      let cancelled = false;
      getMacroSteps(editing.id)
        .then((steps) => {
          if (!cancelled) {
            setStepsText(steps.join("\n"));
            setLoadingSteps(false);
          }
        })
        .catch((err) => {
          if (!cancelled) {
            setError(String(err?.message || err));
            setLoadingSteps(false);
          }
        });

      return () => {
        cancelled = true;
      };
    } else {
      setName("");
      setRunMode("exec");
      setHaltOnError(true);
      setFolder(defaultFolder ?? "");
      setTargetEnv("active");
      setLocalShell("powershell");
      setSelectedProfileId(undefined);
      setStepsText("");
      setLoadingSteps(false);
    }
  }, [isOpen, editing, editingMacroId, defaultFolder]);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const steps = stepsText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

    if (!name.trim()) {
      setError("Please provide a name for this macro.");
      return;
    }
    if (steps.length === 0) {
      setError("Please add at least one command step.");
      return;
    }
    if (targetEnv === "server" && !selectedProfileId) {
      setError("Please select a target server, or switch Target Environment to Active Tab / Local Machine.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      if (folder.trim() && !existingFolders.includes(folder.trim())) {
        addEmptyFolder(folder.trim());
      }

      let resolvedProfileId: number | undefined = undefined;
      let resolvedShell: string | undefined = undefined;

      if (targetEnv === "server") {
        resolvedProfileId = selectedProfileId;
        resolvedShell = undefined;
      } else if (targetEnv === "local") {
        resolvedProfileId = undefined;
        resolvedShell = localShell;
      } else {
        resolvedProfileId = undefined;
        resolvedShell = "active";
      }

      await onSaveMacro(
        {
          name: name.trim(),
          runMode,
          haltOnError,
          steps,
          folder: folder.trim() || undefined,
          profileId: resolvedProfileId,
          shell: resolvedShell,
        },
        editing?.id
      );

      onClose();
    } catch (err: any) {
      setError(String(err?.message || err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editing ? `Edit Macro: ${editing.name}` : "Create New Macro"}
      description="Configure commands and execution environment"
      icon={<Play className="h-4 w-4" />}
      maxWidth="max-w-xl"
    >
      {error && (
        <div className="p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive">
          {error}
        </div>
      )}

      {loadingSteps ? (
        <div className="flex h-48 items-center justify-center">
          <Loader />
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 sm:col-span-1">
              <label className="text-xs font-medium text-muted-foreground">Macro Name</label>
              <Input
                placeholder="e.g. Deploy Backend"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 text-xs bg-zinc-950/80 border-white/[0.08]"
                required
              />
            </div>

            <div className="col-span-2 sm:col-span-1">
              <label className="text-xs font-medium text-muted-foreground">Run Mode</label>
              <div className="mt-1">
                <Select value={runMode} onValueChange={(v) => setRunMode(v as "exec" | "pty")}>
                  <SelectTrigger className="h-9 text-xs bg-zinc-950/80 border-white/[0.08]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="exec">Exec (own connection, per-profile)</SelectItem>
                    <SelectItem value="pty">Live PTY (types into open tab)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground">Folder (Optional)</label>
                <button
                  type="button"
                  onClick={() => setNewFolderModalOpen(true)}
                  className="text-[11px] text-primary hover:underline flex items-center gap-1 cursor-pointer font-medium"
                >
                  <Plus className="h-3 w-3" />
                  <span>New Folder</span>
                </button>
              </div>
              <div className="mt-1">
                <AnimatedCombobox
                  value={folder}
                  onChange={(val) => {
                    setFolder(val);
                    if (val.trim() && !existingFolders.includes(val.trim())) {
                      addEmptyFolder(val.trim());
                    }
                  }}
                  items={folderComboboxItems}
                  placeholder="Select or create folder..."
                  searchPlaceholder="Search or type new folder..."
                  allowCreate
                  createPrefix="Create new folder"
                  clearLabel="No Folder (Root)"
                  clearValue=""
                  icon={<Folder className="h-3.5 w-3.5" />}
                  className="w-full text-xs"
                  onCreateNew={() => setNewFolderModalOpen(true)}
                  createNewText="+ Create new folder..."
                />
              </div>
            </div>
          </div>

          {/* Target Environment Switcher */}
          <div className="space-y-2.5 pt-2 border-t border-white/[0.07]">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-xs font-medium text-foreground">Target Environment</label>
                <p className="text-[11px] text-muted-foreground">Choose where commands execute</p>
              </div>
              <div className="relative flex items-center rounded-lg bg-zinc-900/80 p-0.5 border border-white/[0.08]">
                {(
                  [
                    { id: "active", label: "Active Tab" },
                    { id: "local", label: "Local Machine" },
                    { id: "server", label: "Specific Server" },
                  ] as const
                ).map((tab) => {
                  const isSelected = targetEnv === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setTargetEnv(tab.id)}
                      className={cn(
                        "relative z-10 px-2.5 py-1 text-xs rounded-md font-medium transition-colors cursor-pointer",
                        isSelected
                          ? "text-foreground font-semibold"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {isSelected && (
                        <motion.div
                          layoutId="macro-target-env-pill"
                          className="absolute inset-0 z-[-1] rounded-md border border-border bg-background shadow-xs"
                          transition={{ type: "spring", duration: 0.35, bounce: 0.15 }}
                        />
                      )}
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Conditional Environment Options */}
            <AnimatePresence mode="wait">
              {targetEnv === "local" && (
                <motion.div
                  key="local-settings"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/[0.06]"
                >
                  <div className="col-span-2 sm:col-span-1">
                    <label className="text-xs font-medium text-muted-foreground">Local Shell</label>
                    <div className="mt-1">
                      <Select
                        value={localShell}
                        onValueChange={(v) => setLocalShell(v as "powershell" | "cmd" | "wsl")}
                      >
                        <SelectTrigger className="h-9 text-xs bg-zinc-950/80 border-white/[0.08]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="powershell">PowerShell (powershell.exe)</SelectItem>
                          <SelectItem value="cmd">Command Prompt (cmd.exe)</SelectItem>
                          <SelectItem value="wsl">WSL (Linux)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="col-span-2 sm:col-span-1 flex items-center pt-2 sm:pt-4">
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Always runs on your local machine. If connected to a server tab, Termizen safely opens a local terminal.
                    </p>
                  </div>
                </motion.div>
              )}

              {targetEnv === "server" && (
                <motion.div
                  key="server-settings"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.06] space-y-2"
                >
                  <label className="text-xs font-medium text-muted-foreground">Target SSH Server</label>
                  <AnimatedCombobox
                    value={selectedProfileId ? String(selectedProfileId) : ""}
                    onChange={(val) => setSelectedProfileId(val ? Number(val) : undefined)}
                    items={serverComboboxItems}
                    placeholder="Choose SSH server..."
                    searchPlaceholder="Search servers..."
                    className="w-full text-xs"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    This macro is dedicated to this server and will always run in its remote terminal.
                  </p>
                </motion.div>
              )}

              {targetEnv === "active" && (
                <motion.div
                  key="active-settings"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.06]"
                >
                  <p className="text-[11px] text-muted-foreground">
                    Runs dynamically inside whichever terminal tab is currently focused (local or remote server).
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="pt-1">
            <Checkbox
              checked={haltOnError}
              onCheckedChange={setHaltOnError}
              label="Halt on non-zero exit"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Steps (one command per line)
            </label>
            <textarea
              placeholder={"git fetch --all\ngit pull origin main\nnpm install\nnpm run build"}
              value={stepsText}
              onChange={(e) => setStepsText(e.target.value)}
              rows={8}
              className="w-full rounded-lg border border-white/[0.08] bg-zinc-950/80 p-3 font-mono text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/50 text-foreground"
              required
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/[0.07]">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
              className="h-8 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || !name.trim() || !stepsText.trim()}
              className="h-8 text-xs font-medium"
            >
              {isSubmitting
                ? "Saving..."
                : editing
                ? "Save Changes"
                : "Create Macro"}
            </Button>
          </div>
        </form>
      )}

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
