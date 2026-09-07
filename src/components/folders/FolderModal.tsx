"use client";

import { useState, useEffect } from "react";
import { Folder, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ColorPicker } from "@/components/ui/color-picker";
import { getFolderColor } from "@/lib/folderMetadata";

export interface FolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  folderName?: string; // If provided, editing existing folder; otherwise creating new
  existingFolders: string[];
  onSave: (oldName: string | undefined, newName: string, color: string) => Promise<void> | void;
}

export function FolderModal({
  isOpen,
  onClose,
  folderName,
  existingFolders,
  onSave,
}: FolderModalProps) {
  const isEditing = Boolean(folderName);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#0284C7");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (folderName) {
        setName(folderName);
        setColor(getFolderColor(folderName) || "#0284C7");
      } else {
        setName("");
        setColor("#0284C7");
      }
      setError(null);
      setIsSubmitting(false);
    }
  }, [isOpen, folderName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();

    if (!trimmed) {
      setError("Folder name cannot be empty");
      return;
    }

    // Check collision with existing folders (except current name if editing)
    const isDuplicate = existingFolders.some(
      (f) => f.toLowerCase() === trimmed.toLowerCase() && f.toLowerCase() !== folderName?.toLowerCase()
    );

    if (isDuplicate) {
      setError(`A folder named "${trimmed}" already exists`);
      return;
    }

    try {
      setIsSubmitting(true);
      await onSave(folderName, trimmed, color);
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to save folder");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
          />

          {/* Modal Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", duration: 0.25, bounce: 0.1 }}
            className="relative w-full max-w-md overflow-visible rounded-2xl border border-border/80 bg-[#15161a] p-6 shadow-2xl backdrop-blur-xl text-card-foreground select-none"
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-white/[0.08] hover:text-foreground cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3 mb-5">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl shadow-inner border border-white/10"
                style={{ backgroundColor: `${color}20` }}
              >
                <Folder className="h-5 w-5" style={{ color }} />
              </div>
              <div>
                <h2 className="text-base font-semibold text-foreground">
                  {isEditing ? "Customize Folder" : "New Folder"}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {isEditing
                    ? "Update the folder name and signature color"
                    : "Create a color-coded folder to organize servers and macros"}
                </p>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Folder Name Field */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Folder Name
                </label>
                <Input
                  autoFocus
                  placeholder="e.g. Production, Databases, Staging"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (error) setError(null);
                  }}
                  className="bg-white/[0.04] border border-white/[0.08] text-foreground text-xs"
                />
                {error && (
                  <p className="text-xs text-destructive font-medium mt-1">
                    {error}
                  </p>
                )}
              </div>

              {/* Color Picker Field */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Folder Color
                </label>
                <div>
                  <ColorPicker color={color} onChange={setColor} />
                </div>
              </div>

              {/* Live Preview Card */}
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 space-y-2">
                <div className="text-[10px] uppercase font-semibold text-muted-foreground/70 tracking-wider">
                  Live Preview
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Folder className="h-4 w-4 shrink-0" style={{ color }} />
                    <span className="text-xs font-semibold text-foreground truncate max-w-[160px]">
                      {name.trim() || "Folder Name"}
                    </span>
                  </div>

                  <span
                    className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-medium border shadow-xs"
                    style={{
                      backgroundColor: `${color}18`,
                      borderColor: `${color}40`,
                      color,
                    }}
                  >
                    <Folder className="h-3 w-3" />
                    {name.trim() || "Badge"}
                  </span>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onClose}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmitting || !name.trim()}
                  className="text-xs gap-1.5"
                >
                  {isEditing ? "Save Changes" : "Create Folder"}
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export default FolderModal;
