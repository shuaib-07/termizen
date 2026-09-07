export interface FolderMeta {
  color?: string;
}

export const FLUENT_FOLDER_COLORS = [
  "#0284C7", // Sky Blue
  "#9333EA", // Violet / Lavender
  "#059669", // Emerald
  "#D97706", // Amber
  "#E11D48", // Rose
  "#0891B2", // Cyan
  "#EA580C", // Coral
  "#64748B", // Slate
  "#3B82F6", // Electric Blue
  "#A855F7", // Sefirah Purple
  "#10B981", // Teal
  "#F59E0B", // Gold
];

const STORAGE_KEY_META = "termizen_folder_metadata";
const STORAGE_KEY_EMPTY = "termizen_empty_folders";

export function getAllFolderMetadata(): Record<string, FolderMeta> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY_META);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function getFolderColor(folderName?: string): string | undefined {
  if (!folderName) return undefined;
  const meta = getAllFolderMetadata();
  return meta[folderName]?.color;
}

export function saveFolderColor(folderName: string, color: string): void {
  if (!folderName || typeof window === "undefined") return;
  const meta = getAllFolderMetadata();
  meta[folderName] = { ...meta[folderName], color };
  localStorage.setItem(STORAGE_KEY_META, JSON.stringify(meta));
}

export function renameFolderMetadata(oldName: string, newName: string): void {
  if (!oldName || !newName || typeof window === "undefined") return;
  const meta = getAllFolderMetadata();
  if (meta[oldName]) {
    meta[newName] = meta[oldName];
    delete meta[oldName];
    localStorage.setItem(STORAGE_KEY_META, JSON.stringify(meta));
  }

  // Also rename in empty folders list if present
  const empty = getEmptyFolders();
  const idx = empty.indexOf(oldName);
  if (idx !== -1) {
    empty[idx] = newName;
    localStorage.setItem(STORAGE_KEY_EMPTY, JSON.stringify(empty));
  }
}

export function deleteFolderMetadata(folderName: string): void {
  if (!folderName || typeof window === "undefined") return;
  const meta = getAllFolderMetadata();
  delete meta[folderName];
  localStorage.setItem(STORAGE_KEY_META, JSON.stringify(meta));
  removeEmptyFolder(folderName);
}

export function getEmptyFolders(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_EMPTY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addEmptyFolder(folderName: string, color?: string): void {
  if (!folderName || typeof window === "undefined") return;
  const empty = getEmptyFolders();
  if (!empty.includes(folderName)) {
    empty.push(folderName);
    localStorage.setItem(STORAGE_KEY_EMPTY, JSON.stringify(empty));
  }
  if (color) {
    saveFolderColor(folderName, color);
  }
}

export function removeEmptyFolder(folderName: string): void {
  if (!folderName || typeof window === "undefined") return;
  const empty = getEmptyFolders().filter((f) => f !== folderName);
  localStorage.setItem(STORAGE_KEY_EMPTY, JSON.stringify(empty));
}
