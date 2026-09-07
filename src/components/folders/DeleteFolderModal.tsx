"use client";

import { useState } from "react";
import { AlertTriangle, Layers, Trash2, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";

export interface DeleteFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  folderName: string;
  serverCount: number;
  macroCount: number;
  onUngroup: (folderName: string) => Promise<void> | void;
  onDeleteAll: (folderName: string) => Promise<void> | void;
}

export function DeleteFolderModal({
  isOpen,
  onClose,
  folderName,
  serverCount,
  macroCount,
  onUngroup,
  onDeleteAll,
}: DeleteFolderModalProps) {
  const [loading, setLoading] = useState<"ungroup" | "delete" | null>(null);
  const totalItems = serverCount + macroCount;

  const handleUngroup = async () => {
    try {
      setLoading("ungroup");
      await onUngroup(folderName);
      onClose();
    } finally {
      setLoading(null);
    }
  };

  const handleDeleteAll = async () => {
    try {
      setLoading("delete");
      await onDeleteAll(folderName);
      onClose();
    } finally {
      setLoading(null);
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

          {/* Modal Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", duration: 0.25, bounce: 0.1 }}
            className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border/80 bg-card/90 p-6 shadow-2xl backdrop-blur-xl text-card-foreground select-none"
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
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/15 text-destructive border border-destructive/20 shadow-xs">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-foreground">
                  Remove Folder: {folderName}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {totalItems > 0
                    ? `This folder currently groups ${totalItems} item${totalItems > 1 ? "s" : ""} (${serverCount} server${serverCount === 1 ? "" : "s"}, ${macroCount} macro${macroCount === 1 ? "" : "s"}).`
                    : "This folder is currently empty."}
                </p>
              </div>
            </div>

            {/* Options */}
            {totalItems > 0 ? (
              <div className="space-y-3 my-4">
                {/* Option 1: Un-group */}
                <div className="p-3.5 rounded-xl border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.04] transition-colors flex items-start gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20 shrink-0 mt-0.5">
                    <Layers className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xs font-semibold text-foreground">
                      Un-group items (Keep servers & macros)
                    </h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                      Removes this folder while safely keeping all contained servers and macros in the main list.
                    </p>
                    <div className="pt-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={loading !== null}
                        onClick={handleUngroup}
                        className="text-xs h-7 gap-1.5"
                      >
                        Un-group & Keep Items
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Option 2: Delete Everything */}
                <div className="p-3.5 rounded-xl border border-destructive/20 bg-destructive/5 hover:bg-destructive/10 transition-colors flex items-start gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/15 text-destructive border border-destructive/20 shrink-0 mt-0.5">
                    <Trash2 className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xs font-semibold text-destructive">
                      Delete folder and all {totalItems} items
                    </h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                      Permanently removes this folder and deletes all contained servers and macros from the database.
                    </p>
                    <div className="pt-2">
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={loading !== null}
                        onClick={handleDeleteAll}
                        className="text-xs h-7 gap-1.5"
                      >
                        Delete Everything
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="my-5 p-3 rounded-xl border border-white/[0.06] bg-white/[0.02] text-xs text-muted-foreground">
                Confirm removing the empty folder <strong className="text-foreground">"{folderName}"</strong>?
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/40">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClose}
                disabled={loading !== null}
                className="text-xs"
              >
                Cancel
              </Button>
              {totalItems === 0 && (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={loading !== null}
                  onClick={handleDeleteAll}
                  className="text-xs gap-1.5"
                >
                  Delete Folder
                </Button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export default DeleteFolderModal;
