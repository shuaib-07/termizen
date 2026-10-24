import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Folder,
  Layers,
  Plus,
  Trash2,
  Zap,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { AnimatedCombobox, type ComboboxItem } from "@/components/ui/combobox";
import { FolderModal } from "@/components/folders/FolderModal";
import { addEmptyFolder, getEmptyFolders, getFolderColor } from "@/lib/folderMetadata";
import { HoverMarquee } from "@/components/ui/HoverMarquee";
import type { MacroGroupSummary, MacroSummary, ProfileSummary } from "@/types";

export interface MacroGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (params: {
    id?: number;
    name: string;
    folder?: string;
    haltOnError: boolean;
    macroIds: number[];
  }) => Promise<void>;
  editingGroup?: MacroGroupSummary | null;
  macros: MacroSummary[];
  profiles: ProfileSummary[];
  macroGroups: MacroGroupSummary[];
}

export default function MacroGroupModal({
  isOpen,
  onClose,
  onSave,
  editingGroup,
  macros,
  profiles,
  macroGroups,
}: MacroGroupModalProps) {
  const [name, setName] = useState("");
  const [folder, setFolder] = useState("");
  const [haltOnError, setHaltOnError] = useState(true);
  const [selectedMacroIds, setSelectedMacroIds] = useState<number[]>([]);
  const [newFolderModalOpen, setNewFolderModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedToAdd, setSelectedToAdd] = useState<string>("");

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setIsSubmitting(false);
    setSelectedToAdd("");

    if (editingGroup) {
      setName(editingGroup.name);
      setFolder(editingGroup.folder || "");
      setHaltOnError(editingGroup.haltOnError);
      setSelectedMacroIds(editingGroup.macroIds || []);
    } else {
      setName("");
      setFolder("");
      setHaltOnError(true);
      setSelectedMacroIds([]);
    }
  }, [editingGroup, isOpen]);

  const existingFolders = useMemo(() => {
    return Array.from(
      new Set([
        ...profiles.map((p) => p.folder).filter((f): f is string => !!f && f.trim().length > 0),
        ...macros.map((m) => m.folder).filter((f): f is string => !!f && f.trim().length > 0),
        ...macroGroups.map((g) => g.folder).filter((f): f is string => !!f && f.trim().length > 0),
        ...getEmptyFolders(),
      ])
    ).sort((a, b) => a.localeCompare(b));
  }, [profiles, macros, macroGroups, folder]);

  const folderComboboxItems: ComboboxItem[] = useMemo(() => {
    return existingFolders.map((f) => ({
      value: f,
      label: f,
      color: getFolderColor(f),
      icon: <Folder className="h-3.5 w-3.5" />,
    }));
  }, [existingFolders]);

  const availableMacrosToAdd: ComboboxItem[] = useMemo(() => {
    return macros.map((m) => ({
      value: String(m.id),
      label: m.name,
      description: m.folder ? `Folder: ${m.folder}` : m.profileId ? "SSH Macro" : "Local / Active",
      icon: <Zap className="h-3.5 w-3.5 text-amber-400" />,
    }));
  }, [macros]);

  const handleAddMacro = (idStr: string) => {
    const id = Number(idStr);
    if (!id || isNaN(id)) return;
    setSelectedMacroIds((prev) => [...prev, id]);
    setSelectedToAdd("");
  };

  const handleMoveUp = (index: number) => {
    if (index <= 0) return;
    setSelectedMacroIds((prev) => {
      const next = [...prev];
      const temp = next[index - 1];
      next[index - 1] = next[index];
      next[index] = temp;
      return next;
    });
  };

  const handleMoveDown = (index: number) => {
    if (index >= selectedMacroIds.length - 1) return;
    setSelectedMacroIds((prev) => {
      const next = [...prev];
      const temp = next[index + 1];
      next[index + 1] = next[index];
      next[index] = temp;
      return next;
    });
  };

  const handleRemove = (index: number) => {
    setSelectedMacroIds((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Please provide a group name");
      return;
    }
    if (selectedMacroIds.length === 0) {
      setError("Please add at least one macro to the group pipeline");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (folder.trim() && !existingFolders.includes(folder.trim())) {
        addEmptyFolder(folder.trim());
      }

      await onSave({
        id: editingGroup?.id,
        name: trimmedName,
        folder: folder.trim() || undefined,
        haltOnError,
        macroIds: selectedMacroIds,
      });

      onClose();
    } catch (err: any) {
      setError(String(err?.message || err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={editingGroup ? `Edit Macro Group: ${editingGroup.name}` : "Create Macro Group"}
        description="Sequential pipeline of macros executed step-by-step"
        icon={<Layers className="h-4 w-4 text-amber-400" />}
        maxWidth="max-w-xl"
      >
        {error && (
          <div className="p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive mb-3">
            {error}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 sm:col-span-1">
              <label className="text-xs font-medium text-muted-foreground">Group Name</label>
              <Input
                placeholder="e.g. Deploy Full Stack"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 text-xs bg-zinc-950/80 border-white/[0.08]"
                required
              />
            </div>

            <div className="col-span-2 sm:col-span-1">
              <label className="text-xs font-medium text-muted-foreground">Folder (Optional)</label>
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
                  createNewText="Create new folder..."
                />
              </div>
            </div>
          </div>

          {/* Halt On Error Checkbox */}
          <div className="pt-1">
            <Checkbox
              checked={haltOnError}
              onCheckedChange={setHaltOnError}
              label="Halt on Error (Stop running remaining macros if any command fails)"
            />
          </div>

          {/* Pipeline Steps List */}
          <div className="space-y-2 pt-1 border-t border-white/[0.07]">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-foreground">
                Pipeline Steps ({selectedMacroIds.length})
              </label>
              <span className="text-[11px] text-muted-foreground">Executes in this order</span>
            </div>

            {selectedMacroIds.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-white/[0.08] text-center text-xs text-muted-foreground/70">
                No macros added to this group yet. Use the selector below to add steps.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1 scrollbar-thin">
                {selectedMacroIds.map((mId, index) => {
                  const m = macros.find((macro) => macro.id === mId);
                  return (
                    <div
                      key={`pipeline-item-${index}-${mId}`}
                      className="flex items-center justify-between p-2 rounded-lg bg-zinc-900/60 border border-white/[0.06] text-xs"
                    >
                      <div className="flex items-center gap-2 truncate flex-1 min-w-0 pr-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded bg-amber-400/10 text-amber-400 font-mono text-[10px] flex-shrink-0">
                          {index + 1}
                        </span>
                        <Zap className="h-3.5 w-3.5 text-amber-400 flex-shrink-0" />
                        <div className="truncate flex-1 min-w-0">
                          <HoverMarquee text={m?.name ?? `Macro #${mId}`} className="font-medium text-foreground" />
                          {m?.folder && (
                            <span className="text-[10px] text-muted-foreground ml-1.5">
                              ({m.folder})
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Tooltip content="Move step up" side="top">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={index === 0}
                            onClick={() => handleMoveUp(index)}
                            className="h-6 w-6 text-muted-foreground hover:text-foreground"
                          >
                            <ArrowUp className="h-3 w-3" />
                          </Button>
                        </Tooltip>
                        <Tooltip content="Move step down" side="top">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={index === selectedMacroIds.length - 1}
                            onClick={() => handleMoveDown(index)}
                            className="h-6 w-6 text-muted-foreground hover:text-foreground"
                          >
                            <ArrowDown className="h-3 w-3" />
                          </Button>
                        </Tooltip>
                        <Tooltip content="Remove from group" side="top">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemove(index)}
                            className="h-6 w-6 text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </Tooltip>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add Macro to Pipeline */}
            <div className="pt-1">
              <AnimatedCombobox
                value={selectedToAdd}
                onChange={handleAddMacro}
                items={availableMacrosToAdd}
                placeholder="Add macro to pipeline..."
                searchPlaceholder="Search macros to append..."
                clearLabel=""
                clearValue=""
                icon={<Plus className="h-3.5 w-3.5 text-amber-400" />}
                className="w-full text-xs"
                placement="top"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-3 border-t border-white/[0.08]">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || !name.trim() || selectedMacroIds.length === 0}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {isSubmitting ? "Saving..." : editingGroup ? "Update Group" : "Create Group"}
            </Button>
          </div>
        </form>
      </Modal>

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
    </>
  );
}
