import { useState } from "react";
import {
  Activity,
  FileText,
  Folder,
  MoreHorizontal,
  Palette,
  Pencil,
  Pin,
  Play,
  Server,
  Terminal,
  Trash2,
  Zap,
} from "lucide-react";
import type { MacroSummary, ProfileSummary } from "./sessions";
import type { ServerHubSubView } from "./types";
import { NativeNestedList, ListItem } from "@/components/NativeNestedList";
import { NativeDelete } from "@/components/NativeDelete";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
} from "@/components/ui/context-menu";
import {
  macroAppliesToProfile,
  updateProfileFolder,
  updateMacroFolder,
  deleteMacro,
} from "./sessions";
import { FolderModal } from "@/components/folders/FolderModal";
import { DeleteFolderModal } from "@/components/folders/DeleteFolderModal";
import {
  getFolderColor,
  getEmptyFolders,
  addEmptyFolder,
  renameFolderMetadata,
  deleteFolderMetadata,
  saveFolderColor,
} from "@/lib/folderMetadata";

function ProfileActions({
  profile,
  onDelete,
  onOpenSubView,
}: {
  profile: ProfileSummary;
  onDelete: (id: number) => void;
  onOpenSubView: (profile: ProfileSummary, subView: ServerHubSubView) => void;
}) {
  return (
    <span className="flex items-center gap-0.5">
      {profile.kind === "ssh" && (
        <>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-cyan-400 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              onOpenSubView(profile, "monitor");
            }}
            title="Open Live Status Charts"
          >
            <Activity className="h-3.5 w-3.5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-emerald-400 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              onOpenSubView(profile, "logs");
            }}
            title="Open Live Service Logs"
          >
            <FileText className="h-3.5 w-3.5" />
          </Button>
        </>
      )}
      <NativeDelete size="sm" onConfirm={() => {}} onDelete={() => onDelete(profile.id)} />
    </span>
  );
}

function ProfileMacroRow({
  profile,
  execMacros,
  onRunMacro,
}: {
  profile: ProfileSummary;
  execMacros: MacroSummary[];
  onRunMacro: (profileId: number, macroId: number) => void;
}) {
  const [selectedMacro, setSelectedMacro] = useState("");

  return (
    <div
      className="flex items-center gap-1.5 pl-7 pr-2 pt-0.5 pb-1 w-full"
      onClick={(e) => e.stopPropagation()}
    >
      <Select value={selectedMacro || undefined} onValueChange={setSelectedMacro}>
        <SelectTrigger className="h-6 flex-1 min-w-0 px-2 text-[11px] bg-background/50 border-border/60 hover:bg-background/80 hover:border-border transition-colors">
          <SelectValue placeholder="Macro…" />
        </SelectTrigger>
        <SelectContent>
          {execMacros.map((m) => (
            <SelectItem key={m.id} value={String(m.id)}>
              {m.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 flex-shrink-0 text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-40"
        disabled={!selectedMacro}
        onClick={(e) => {
          e.stopPropagation();
          onRunMacro(profile.id, Number(selectedMacro));
        }}
        title="Run exec-mode macro against this profile"
      >
        <Play className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

export default function ProfileSidebar({
  profiles,
  macros,
  onOpen,
  onEditProfile,
  onDelete,
  onRunMacro,
  onEditMacro,
  onDeleteMacro,
  onTogglePin,
  onToggleBgMonitoring,
  onRefresh,
}: {
  profiles: ProfileSummary[];
  macros: MacroSummary[];
  onOpen: (profile: ProfileSummary, subView?: ServerHubSubView) => void;
  onEditProfile: (profile: ProfileSummary) => void;
  onDelete: (id: number) => void;
  onRunMacro: (macroIdOrProfileId: number, macroIdOrOptions?: number | { profileId?: number; shell?: string }) => void;
  onEditMacro: (id: number) => void;
  onDeleteMacro?: (id: number) => void;
  onTogglePin?: (id: number, pinned: boolean) => void;
  onToggleBgMonitoring?: (id: number, enabled: boolean) => void;
  onRefresh?: () => void;
}) {
  // Folder modals state
  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<string | undefined>(undefined);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingFolder, setDeletingFolder] = useState<{
    name: string;
    serverCount: number;
    macroCount: number;
  } | null>(null);

  const toProfileItem = (p: ProfileSummary): ListItem => {
    const execMacros = macros.filter((m) => m.runMode === "exec" && macroAppliesToProfile(m, p.id));
    return {
      id: `profile-${p.id}`,
      label: p.name,
      icon: <Server className={`h-3.5 w-3.5 ${p.pinned ? "text-amber-400" : "text-muted-foreground"}`} />,
      onClick: () => onOpen(p, "terminal"),
      actions: (
        <ProfileActions
          profile={p}
          onDelete={onDelete}
          onOpenSubView={onOpen}
        />
      ),
      subRow:
        p.kind === "ssh" && execMacros.length > 0 ? (
          <ProfileMacroRow
            profile={p}
            execMacros={execMacros}
            onRunMacro={onRunMacro}
          />
        ) : undefined,
      contextMenu: (
        <ContextMenuContent ariaLabel={`Actions for ${p.name}`}>
          <ContextMenuLabel>{p.name}</ContextMenuLabel>
          <ContextMenuItem onSelect={() => onOpen(p, "terminal")}>
            <Terminal className="h-4 w-4 mr-2" />
            <span>Open Terminal</span>
            <ContextMenuShortcut>Enter</ContextMenuShortcut>
          </ContextMenuItem>

          {p.kind === "ssh" && (
            <>
              <ContextMenuItem onSelect={() => onOpen(p, "monitor")}>
                <Activity className="h-4 w-4 text-cyan-400" />
                <span>Live Status Charts</span>
              </ContextMenuItem>
              <ContextMenuItem onSelect={() => onOpen(p, "logs")}>
                <FileText className="h-4 w-4 text-emerald-400" />
                <span>Live Service Logs</span>
              </ContextMenuItem>
            </>
          )}

          <ContextMenuSeparator />

          {onTogglePin && p.kind === "ssh" && (
            <ContextMenuItem onSelect={() => onTogglePin(p.id, !p.pinned)}>
              <Pin className={`h-4 w-4 ${p.pinned ? "text-amber-400 fill-amber-400" : "text-muted-foreground"}`} />
              <span>{p.pinned ? "Unpin Server" : "Pin Server"}</span>
            </ContextMenuItem>
          )}

          {onToggleBgMonitoring && p.kind === "ssh" && (
            <ContextMenuItem onSelect={() => onToggleBgMonitoring(p.id, !p.bgMonitoring)}>
              <Activity className={`h-4 w-4 ${p.bgMonitoring ? "text-emerald-400" : "text-muted-foreground"}`} />
              <span>{p.bgMonitoring ? "Switch to Smart Monitoring" : "Enable 24/7 Monitoring"}</span>
            </ContextMenuItem>
          )}

          {p.kind === "ssh" && (
            <ContextMenuItem onSelect={() => onEditProfile(p)}>
              <Pencil className="h-4 w-4 text-muted-foreground" />
              <span>Edit Server Connection…</span>
            </ContextMenuItem>
          )}

          <ContextMenuSeparator />

          <ContextMenuItem tone="destructive" onSelect={() => onDelete(p.id)}>
            <Trash2 className="h-4 w-4" />
            <span>Delete Server</span>
          </ContextMenuItem>
        </ContextMenuContent>
      ),
    };
  };

  const toMacroItem = (m: MacroSummary): ListItem => {
    const assignedProfile = m.profileId ? profiles.find((p) => p.id === m.profileId) : undefined;
    return {
      id: `macro-${m.id}`,
      label: m.name,
      icon: <Zap className="h-3.5 w-3.5 text-amber-400" />,
      onClick: () => onRunMacro(m.id),
      actions: (
        <button
          type="button"
          className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground/60 hover:bg-white/[0.08] hover:text-foreground cursor-pointer transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            onEditMacro(m.id);
          }}
          title="Edit Macro"
        >
          <Pencil className="h-3 w-3" />
        </button>
      ),
      contextMenu: (
        <ContextMenuContent ariaLabel={`Actions for ${m.name}`}>
          <ContextMenuLabel>{m.name}</ContextMenuLabel>
          <ContextMenuItem onSelect={() => onRunMacro(m.id)}>
            <Play className="h-4 w-4 mr-2 text-emerald-400" />
            <span>Run Macro</span>
          </ContextMenuItem>
          {assignedProfile ? (
            <ContextMenuItem onSelect={() => onRunMacro(m.id, { profileId: assignedProfile.id })}>
              <Server className="h-4 w-4 mr-2 text-cyan-400" />
              <span>Run on {assignedProfile.name}</span>
            </ContextMenuItem>
          ) : (
            <>
              <ContextMenuItem onSelect={() => onRunMacro(m.id, { shell: "powershell" })}>
                <Terminal className="h-4 w-4 mr-2 text-sky-400" />
                <span>Run in PowerShell</span>
              </ContextMenuItem>
              <ContextMenuItem onSelect={() => onRunMacro(m.id, { shell: "cmd" })}>
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
          {onDeleteMacro && (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem tone="destructive" onSelect={() => onDeleteMacro(m.id)}>
                <Trash2 className="h-4 w-4 mr-2" />
                <span>Delete Macro</span>
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      ),
    };
  };

  const folders = new Map<string, { profiles: ProfileSummary[]; macros: MacroSummary[] }>();
  const getFolder = (name: string) => {
    if (!folders.has(name)) folders.set(name, { profiles: [], macros: [] });
    return folders.get(name)!;
  };

  // Seed with empty folders so empty created folders show up in the tree
  for (const emptyFolder of getEmptyFolders()) {
    getFolder(emptyFolder);
  }

  const topLevelProfiles: ProfileSummary[] = [];
  for (const p of profiles) {
    if (p.folder) getFolder(p.folder).profiles.push(p);
    else topLevelProfiles.push(p);
  }

  for (const m of macros) {
    if (m.folder) getFolder(m.folder).macros.push(m);
  }

  const allFolderNames = Array.from(folders.keys());

  const handleSaveFolder = async (oldName: string | undefined, newName: string, color: string) => {
    if (oldName) {
      if (oldName !== newName) {
        renameFolderMetadata(oldName, newName);
        saveFolderColor(newName, color);
        // Cascade update to matching profiles
        for (const p of profiles.filter((p) => p.folder === oldName)) {
          await updateProfileFolder(p, newName);
        }
        // Cascade update to matching macros
        for (const m of macros.filter((m) => m.folder === oldName)) {
          await updateMacroFolder(m, newName);
        }
      } else {
        saveFolderColor(newName, color);
      }
    } else {
      addEmptyFolder(newName, color);
    }
    onRefresh?.();
  };

  const handleUngroupFolder = async (folderName: string) => {
    for (const p of profiles.filter((p) => p.folder === folderName)) {
      await updateProfileFolder(p, undefined);
    }
    for (const m of macros.filter((m) => m.folder === folderName)) {
      await updateMacroFolder(m, undefined);
    }
    deleteFolderMetadata(folderName);
    onRefresh?.();
  };

  const handleDeleteAllInFolder = async (folderName: string) => {
    for (const p of profiles.filter((p) => p.folder === folderName)) {
      await onDelete(p.id);
    }
    for (const m of macros.filter((m) => m.folder === folderName)) {
      await deleteMacro(m.id);
    }
    deleteFolderMetadata(folderName);
    onRefresh?.();
  };

  const items: ListItem[] = [
    ...[...folders.entries()].map(([folder, { profiles: folderProfiles, macros: folderMacros }]) => {
      const color = getFolderColor(folder);
      return {
        id: `folder-${folder}`,
        label: folder,
        icon: <Folder className="h-3.5 w-3.5" style={{ color: color || "var(--muted-foreground)" }} />,
        children: [...folderProfiles.map(toProfileItem), ...folderMacros.map(toMacroItem)],
        actions: (
          <button
            type="button"
            className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground/60 hover:bg-white/[0.08] hover:text-foreground cursor-pointer transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              setEditingFolder(folder);
              setFolderModalOpen(true);
            }}
            title="Customize Folder"
          >
            <MoreHorizontal className="h-3 w-3" />
          </button>
        ),
        contextMenu: (
          <ContextMenuContent ariaLabel={`Actions for ${folder}`}>
            <ContextMenuLabel>{folder}</ContextMenuLabel>
            <ContextMenuSeparator />
            <ContextMenuItem
              onSelect={() => {
                setEditingFolder(folder);
                setFolderModalOpen(true);
              }}
            >
              <Palette className="h-4 w-4 mr-2" />
              <span>Customize Folder…</span>
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem
              tone="destructive"
              onSelect={() => {
                setDeletingFolder({
                  name: folder,
                  serverCount: folderProfiles.length,
                  macroCount: folderMacros.length,
                });
                setDeleteModalOpen(true);
              }}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              <span>Delete Folder…</span>
            </ContextMenuItem>
          </ContextMenuContent>
        ),
      };
    }),
    ...topLevelProfiles.map(toProfileItem),
  ];

  return (
    <div className="h-full overflow-y-auto p-2">
      {profiles.length === 0 && folders.size === 0 && (
        <div className="px-1 text-sm text-muted-foreground/70">No saved profiles yet</div>
      )}
      <NativeNestedList items={items} size="sm" defaultExpanded />

      {/* Edit / Customize Folder Modal */}
      <FolderModal
        isOpen={folderModalOpen}
        onClose={() => setFolderModalOpen(false)}
        folderName={editingFolder}
        existingFolders={allFolderNames}
        onSave={handleSaveFolder}
      />

      {/* Delete Folder Modal */}
      {deletingFolder && (
        <DeleteFolderModal
          isOpen={deleteModalOpen}
          onClose={() => {
            setDeleteModalOpen(false);
            setDeletingFolder(null);
          }}
          folderName={deletingFolder.name}
          serverCount={deletingFolder.serverCount}
          macroCount={deletingFolder.macroCount}
          onUngroup={handleUngroupFolder}
          onDeleteAll={handleDeleteAllInFolder}
        />
      )}
    </div>
  );
}
