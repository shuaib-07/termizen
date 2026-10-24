import { useState } from "react";
import {
  Activity,
  FileText,
  Folder,
  MoreHorizontal,
  Palette,
  Pencil,
  Pin,
  Plus,
  Server,
  Terminal,
  Trash2,
  Zap,
} from "lucide-react";
import type { MacroSummary, ProfileSummary } from "./sessions";
import type { ServerHubSubView } from "./types";
import { NativeNestedList, ListItem } from "@/components/NativeNestedList";
import { NativeDelete } from "@/components/NativeDelete";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
} from "@/components/ui/context-menu";
import {
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
  onOpenNewTab,
  onOpenMacroSidesheet,
}: {
  profile: ProfileSummary;
  onDelete: (id: number) => void;
  onOpenSubView: (profile: ProfileSummary, subView: ServerHubSubView) => void;
  onOpenNewTab?: (profile: ProfileSummary) => void;
  onOpenMacroSidesheet?: (profileId: number) => void;
}) {
  const [isDeleting, setIsDeleting] = useState(false);

  return (
    <div
      className="flex items-center pl-6 pt-0.5 pb-1 max-w-full"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-0.5 rounded-lg bg-zinc-950/80 border border-white/[0.08] p-0.5 shadow-sm backdrop-blur-md transition-all">
        {!isDeleting && profile.kind === "ssh" && (
          <>
            {onOpenNewTab && (
              <Tooltip content="Open in New Terminal Tab" side="top">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 rounded-md text-muted-foreground hover:text-primary hover:bg-white/[0.08] cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenNewTab(profile);
                  }}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </Tooltip>
            )}

            {onOpenMacroSidesheet && (
              <Tooltip content="Macros for this server" side="top">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 rounded-md text-muted-foreground hover:text-amber-400 hover:bg-amber-400/10 cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenMacroSidesheet(profile.id);
                  }}
                >
                  <Zap className="h-3.5 w-3.5 text-amber-400/90" />
                </Button>
              </Tooltip>
            )}

            <Tooltip content="Live Status Charts" side="top">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 rounded-md text-muted-foreground hover:text-cyan-400 hover:bg-cyan-400/10 cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenSubView(profile, "monitor");
                }}
              >
                <Activity className="h-3.5 w-3.5" />
              </Button>
            </Tooltip>

            <Tooltip content="Live Service Logs" side="top">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 rounded-md text-muted-foreground hover:text-emerald-400 hover:bg-emerald-400/10 cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenSubView(profile, "logs");
                }}
              >
                <FileText className="h-3.5 w-3.5" />
              </Button>
            </Tooltip>
            <div className="h-3 w-[1px] bg-white/[0.08] mx-0.5" />
          </>
        )}
        <NativeDelete
          size="sm"
          onConfirm={() => setIsDeleting(true)}
          onDelete={() => {
            setIsDeleting(false);
            onDelete(profile.id);
          }}
          onExpandedChange={setIsDeleting}
        />
      </div>
    </div>
  );
}

export default function ProfileSidebar({
  profiles,
  macros,
  onOpen,
  onOpenNewTab,
  onOpenMacroSidesheet,
  onEditProfile,
  onDelete,
  onRunMacro: _onRunMacro,
  onEditMacro: _onEditMacro,
  onDeleteMacro: _onDeleteMacro,
  onTogglePin,
  onToggleBgMonitoring,
  onRefresh,
}: {
  profiles: ProfileSummary[];
  macros: MacroSummary[];
  onOpen: (profile: ProfileSummary, subView?: ServerHubSubView, forceNewTab?: boolean) => void;
  onOpenNewTab?: (profile: ProfileSummary) => void;
  onOpenMacroSidesheet?: (profileId: number) => void;
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
    return {
      id: `profile-${p.id}`,
      label: p.name,
      icon: <Server className={`h-3.5 w-3.5 ${p.pinned ? "text-amber-400" : "text-muted-foreground"}`} />,
      onClick: () => onOpen(p, "terminal"),
      subRow: (
        <ProfileActions
          profile={p}
          onDelete={onDelete}
          onOpenSubView={onOpen}
          onOpenNewTab={onOpenNewTab}
          onOpenMacroSidesheet={onOpenMacroSidesheet}
        />
      ),
      contextMenu: (
        <ContextMenuContent ariaLabel={`Actions for ${p.name}`}>
          <ContextMenuLabel>{p.name}</ContextMenuLabel>
          <ContextMenuItem onSelect={() => onOpen(p, "terminal")}>
            <Terminal className="h-4 w-4 mr-2" />
            <span>Open Terminal</span>
            <ContextMenuShortcut>Enter</ContextMenuShortcut>
          </ContextMenuItem>

          {onOpenNewTab && (
            <ContextMenuItem onSelect={() => onOpenNewTab(p)}>
              <Plus className="h-4 w-4 mr-2 text-primary" />
              <span>Open in New Terminal Tab</span>
            </ContextMenuItem>
          )}

          {onOpenMacroSidesheet && (
            <ContextMenuItem onSelect={() => onOpenMacroSidesheet(p.id)}>
              <Zap className="h-4 w-4 mr-2 text-amber-400" />
              <span>Run Macros…</span>
            </ContextMenuItem>
          )}
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
        children: folderProfiles.map(toProfileItem),
        actions: (
          <Tooltip content="Customize Folder" side="right">
            <button
              type="button"
              className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground/60 hover:bg-white/[0.08] hover:text-foreground cursor-pointer transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                setEditingFolder(folder);
                setFolderModalOpen(true);
              }}
            >
              <MoreHorizontal className="h-3 w-3" />
            </button>
          </Tooltip>
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
