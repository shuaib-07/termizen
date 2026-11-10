"use client";

import { useState } from "react";
import { Download, KeyRound, AlertCircle, CheckCircle2, Lock } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { PasswordInput } from "@/components/ui/password-input";
import { vaultExportBackup } from "@/sessions";

interface BackupExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BackupExportModal({ isOpen, onClose }: BackupExportModalProps) {
  const [includeServers, setIncludeServers] = useState(true);
  const [includeMacros, setIncludeMacros] = useState(true);
  const [includeWorkspaces, setIncludeWorkspaces] = useState(true);
  const [includeSettings, setIncludeSettings] = useState(true);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleReset = () => {
    setPassword("");
    setConfirmPassword("");
    setError(null);
    setIsExporting(false);
    setIsSuccess(false);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleExport = async () => {
    setError(null);

    if (!password) {
      setError("Please enter an encryption password for the backup.");
      return;
    }
    if (password.length < 4) {
      setError("Password must be at least 4 characters long.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match. Please verify your password.");
      return;
    }

    const categories: string[] = [];
    if (includeServers) categories.push("servers", "keys");
    if (includeMacros) categories.push("macros");
    if (includeWorkspaces) categories.push("workspaces");
    if (includeSettings) categories.push("settings");

    if (categories.length === 0) {
      setError("Please select at least one category to include in the backup.");
      return;
    }

    setIsExporting(true);

    try {
      // Gather local storage metadata & settings
      let folderMetadata: Record<string, unknown> | null = null;
      let settingsData: Record<string, unknown> | null = null;

      if (includeSettings && typeof window !== "undefined") {
        const meta = localStorage.getItem("termizen_folder_metadata");
        const empty = localStorage.getItem("termizen_empty_folders");
        folderMetadata = {
          meta: meta ? JSON.parse(meta) : {},
          empty: empty ? JSON.parse(empty) : [],
        };

        settingsData = {
          theme: localStorage.getItem("termizen_theme"),
          accent: localStorage.getItem("termizen_accent"),
          closeBehavior: localStorage.getItem("termizen_close_behavior"),
          autoCheckUpdates: localStorage.getItem("termizen_auto_check_updates"),
          sidebarOpen: localStorage.getItem("termizen_sidebar_open"),
        };
      }

      const encryptedData = await vaultExportBackup(
        password,
        categories,
        folderMetadata,
        settingsData
      );

      // Trigger browser download of .tzbackup file
      const blob = new Blob([encryptedData], { type: "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const dateStr = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `termizen-backup-${dateStr}.tzbackup`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setIsSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={
        <div className="flex items-center gap-2.5 text-foreground font-semibold text-base">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 border border-primary/20 text-primary">
            <Download className="h-4 w-4" />
          </div>
          Export Encrypted Backup
        </div>
      }
      description="Create a portable, password-encrypted archive (.tzbackup) to backup or migrate your servers, keys, and macros."
      maxWidth="max-w-lg"
    >
      <div className="space-y-4 pt-1">
        {isSuccess ? (
          <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 space-y-3 text-center">
            <div className="flex justify-center">
              <div className="h-12 w-12 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="h-6 w-6" />
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-foreground">Backup Archive Exported</h4>
              <p className="text-xs text-muted-foreground mt-1">
                Your encrypted <span className="font-mono text-foreground font-medium">.tzbackup</span> file was generated and saved to your downloads folder.
              </p>
            </div>
            <div className="pt-2">
              <Button onClick={handleClose} className="w-full">
                Done
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Scope selection */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Include in Backup
              </label>
              <div className="grid grid-cols-1 gap-2 p-3 rounded-xl border border-white/[0.06] bg-white/[0.02]">
                <Checkbox
                  id="inc-servers"
                  checked={includeServers}
                  onCheckedChange={setIncludeServers}
                  label="Server Profiles, Services & SSH Keys"
                  className="text-xs font-medium text-foreground"
                />
                <Checkbox
                  id="inc-macros"
                  checked={includeMacros}
                  onCheckedChange={setIncludeMacros}
                  label="Macros & Sequential Pipelines"
                  className="text-xs font-medium text-foreground"
                />
                <Checkbox
                  id="inc-workspaces"
                  checked={includeWorkspaces}
                  onCheckedChange={setIncludeWorkspaces}
                  label="Workspace Layouts & Terminals"
                  className="text-xs font-medium text-foreground"
                />
                <Checkbox
                  id="inc-settings"
                  checked={includeSettings}
                  onCheckedChange={setIncludeSettings}
                  label="Folder Colors & Application Preferences"
                  className="text-xs font-medium text-foreground"
                />
              </div>
            </div>

            {/* Password Protection */}
            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5 text-primary" />
                  Backup Encryption Password
                </label>
                <span className="text-[10px] text-muted-foreground/80 font-mono">
                  AES-256-GCM + PBKDF2
                </span>
              </div>

              <div className="space-y-2">
                <PasswordInput
                  placeholder="Set an archive encryption password..."
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="text-xs"
                />
                <PasswordInput
                  placeholder="Confirm archive password..."
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="text-xs"
                />
              </div>

              <div className="flex items-start gap-2 p-2.5 rounded-lg border border-amber-500/20 bg-amber-500/[0.06] text-amber-300 text-[11px] leading-relaxed">
                <KeyRound className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  Please remember this password. The archive cannot be decrypted or restored without it on any machine.
                </span>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-2.5 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-xs">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button
                variant="ghost"
                onClick={handleClose}
                disabled={isExporting}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                onClick={handleExport}
                disabled={isExporting}
                className="text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {isExporting ? (
                  <>Encrypting & Saving...</>
                ) : (
                  <>
                    <Download className="h-3.5 w-3.5" />
                    Export Backup Archive
                  </>
                )}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
