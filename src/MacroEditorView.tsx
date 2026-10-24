import { useEffect, useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader } from "@/components/Loader";
import { Folder } from "lucide-react";
import { FolderModal } from "@/components/folders/FolderModal";
import { AnimatedCombobox, type ComboboxItem } from "@/components/ui/combobox";
import { Checkbox } from "@/components/ui/checkbox";
import { getFolderColor, getEmptyFolders, addEmptyFolder } from "@/lib/folderMetadata";
import { getMacroSteps } from "./sessions";
import type { MacroSummary, ProfileSummary, SaveMacroParams } from "./sessions";

export default function MacroEditorView({
  profiles,
  macros,
  macroId,
  onSave,
  onDone,
}: {
  profiles: ProfileSummary[];
  macros: MacroSummary[];
  macroId?: number;
  onSave: (params: SaveMacroParams) => void;
  onDone: () => void;
  onAddNewServer?: () => void;
}) {
  const editing = macros.find((m) => m.id === macroId);

  const [name, setName] = useState(editing?.name ?? "");
  const [runMode, setRunMode] = useState<"exec" | "pty">(editing?.runMode ?? "exec");
  const [haltOnError, setHaltOnError] = useState(editing?.haltOnError ?? true);
  const [folder, setFolder] = useState(editing?.folder ?? "");
  const [newFolderModalOpen, setNewFolderModalOpen] = useState(false);
  const [shell, setShell] = useState<"powershell" | "cmd">((editing?.shell as "powershell" | "cmd") || "powershell");
  const [stepsText, setStepsText] = useState("");
  const [loadingSteps, setLoadingSteps] = useState(!!macroId);

  // Folder combobox items
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

  useEffect(() => {
    if (!macroId) return;
    let cancelled = false;
    getMacroSteps(macroId).then((steps) => {
      if (!cancelled) {
        setStepsText(steps.join("\n"));
        setLoadingSteps(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [macroId]);

  const save = () => {
    const steps = stepsText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!name || steps.length === 0) return;
    onSave({
      name,
      runMode,
      haltOnError,
      steps,
      folder: folder.trim() || undefined,
      shell,
    });
    onDone();
  };

  if (loadingSteps) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader />
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-6">
      <Card className="mx-auto flex max-w-2xl flex-col gap-3 p-6">
        <h2 className="text-lg font-semibold">{editing ? `Edit macro: ${editing.name}` : "New macro"}</h2>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Name</label>
            <Input placeholder="Macro name" value={name} onChange={(e) => setName(e.currentTarget.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Run mode</label>
            <Select value={runMode} onValueChange={(v) => setRunMode(v as "exec" | "pty")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="exec">Exec (own connection, per-profile)</SelectItem>
                <SelectItem value="pty">Live PTY (types into open tab)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Assign to folder (optional)</label>
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
              className="w-full"
              onCreateNew={() => setNewFolderModalOpen(true)}
              createNewText="Create new folder..."
            />
            <p className="text-xs text-muted-foreground/70">Groups this macro under this folder for categorization.</p>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Default Local Shell</label>
            <Select value={shell} onValueChange={(v) => setShell(v as "powershell" | "cmd")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="powershell">PowerShell</SelectItem>
                <SelectItem value="cmd">Command Prompt</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground/70">Shell used when executing locally.</p>
          </div>
        </div>

        <div className="pt-0.5">
          <Checkbox
            checked={haltOnError}
            onCheckedChange={setHaltOnError}
            label="Halt on non-zero exit"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Steps (one command per line)</label>
          <textarea
            placeholder={"git fetch --all\ngit pull origin main\nnpm install --prefer-offline\nnpm run build"}
            value={stepsText}
            onChange={(e) => setStepsText(e.currentTarget.value)}
            rows={16}
            className="rounded-md border border-input bg-background/50 p-3 font-mono text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onDone}>
            Cancel
          </Button>
          <Button disabled={!name || !stepsText.trim()} onClick={save}>
            {editing ? "Save changes" : "Save macro"}
          </Button>
        </div>
      </Card>

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
    </div>
  );
}
