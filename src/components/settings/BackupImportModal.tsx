"use client";

import { useState, useRef } from "react";
import {
  Upload,
  FileArchive,
  Lock,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Server,
  Layers,
  Terminal,
  Palette,
  RotateCcw,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import {
  vaultInspectBackup,
  vaultImportBackup,
  type BackupSummary,
  type ImportResult,
} from "@/sessions";
import { applyTheme, type ThemeMode, type AccentMode } from "./SettingsView";
import { cn } from "@/lib/utils";

interface BackupImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRestoreComplete?: () => void;
}

type ImportStep = "select_file" | "preview" | "success";

export function BackupImportModal({
  isOpen,
  onClose,
  onRestoreComplete,
}: BackupImportModalProps) {
  const [step, setStep] = useState<ImportStep>("select_file");
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<string | null>(null);
  const [encryptedData, setEncryptedData] = useState<string>("");
  const [password, setPassword] = useState("");
  const [summary, setSummary] = useState<BackupSummary | null>(null);
  const [mode, setMode] = useState<"merge" | "replace">("merge");
  const [isInspecting, setIsInspecting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleReset = () => {
    setStep("select_file");
    setFileName(null);
    setFileSize(null);
    setEncryptedData("");
    setPassword("");
    setSummary(null);
    setMode("merge");
    setError(null);
    setIsInspecting(false);
    setIsRestoring(false);
    setImportResult(null);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setFileName(file.name);
    setFileSize(`${(file.size / 1024).toFixed(1)} KB`);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setEncryptedData(content.trim());
    };
    reader.onerror = () => {
      setError("Failed to read the selected backup file.");
    };
    reader.readAsText(file);
  };

  const handleInspect = async () => {
    setError(null);
    if (!encryptedData) {
      setError("Please select a valid .tzbackup file.");
      return;
    }
    if (!password) {
      setError("Please enter the decryption password for this backup.");
      return;
    }

    setIsInspecting(true);
    try {
      const inspected = await vaultInspectBackup(encryptedData, password);
      setSummary(inspected);
      setStep("preview");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsInspecting(false);
    }
  };

  const handleApplyRestore = async () => {
    setError(null);
    setIsRestoring(true);

    try {
      const result = await vaultImportBackup(encryptedData, password, mode);
      setImportResult(result);

      // Restore localStorage settings if present
      if (result.settings && typeof window !== "undefined") {
        const s = result.settings as Record<string, string | null>;
        if (s.theme) localStorage.setItem("termizen_theme", s.theme);
        if (s.accent) localStorage.setItem("termizen_accent", s.accent);
        if (s.closeBehavior) localStorage.setItem("termizen_close_behavior", s.closeBehavior);
        if (s.autoCheckUpdates) localStorage.setItem("termizen_auto_check_updates", s.autoCheckUpdates);
        if (s.sidebarOpen) localStorage.setItem("termizen_sidebar_open", s.sidebarOpen);

        if (s.theme && s.accent) {
          applyTheme(s.theme as ThemeMode, s.accent as AccentMode);
        }
      }

      // Restore folder metadata if present
      if (result.folderMetadata && typeof window !== "undefined") {
        const fm = result.folderMetadata as { meta?: unknown; empty?: unknown };
        if (fm.meta) {
          localStorage.setItem(
            "termizen_folder_metadata",
            typeof fm.meta === "string" ? fm.meta : JSON.stringify(fm.meta)
          );
        }
        if (fm.empty) {
          localStorage.setItem(
            "termizen_empty_folders",
            typeof fm.empty === "string" ? fm.empty : JSON.stringify(fm.empty)
          );
        }
      }

      // Trigger app refresh
      onRestoreComplete?.();
      setStep("success");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={
        <div className="flex items-center gap-2.5 text-foreground font-semibold text-base">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 border border-primary/20 text-primary">
            <RotateCcw className="h-4 w-4" />
          </div>
          Restore Backup Archive
        </div>
      }
      description="Import a .tzbackup file to restore or migrate your servers, keys, macros, and configuration."
      maxWidth="max-w-lg"
    >
      <div className="space-y-4 pt-1">
        {step === "select_file" && (
          <div className="space-y-4">
            {/* File selection box */}
            <input
              type="file"
              ref={fileInputRef}
              accept=".tzbackup,application/octet-stream"
              className="hidden"
              onChange={handleFileChange}
            />

            <div
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl cursor-pointer transition-all",
                fileName
                  ? "border-primary/50 bg-primary/5"
                  : "border-white/[0.1] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.2]"
              )}
            >
              {fileName ? (
                <div className="flex flex-col items-center gap-2 text-center">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center text-primary">
                    <FileArchive className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-foreground font-mono">{fileName}</div>
                    <div className="text-[11px] text-muted-foreground">{fileSize}</div>
                  </div>
                  <span className="text-[11px] text-primary hover:underline mt-1">
                    Click to change file
                  </span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-center">
                  <div className="h-10 w-10 rounded-lg bg-white/[0.05] border border-white/[0.08] flex items-center justify-center text-muted-foreground">
                    <Upload className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-xs font-medium text-foreground">
                      Click to choose a <span className="font-mono text-primary">.tzbackup</span> file
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      Encrypted archive generated by Termizen
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Password input */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-primary" />
                Decryption Password
              </label>
              <PasswordInput
                placeholder="Enter the password used when exporting..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="text-xs"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && fileName && password) {
                    handleInspect();
                  }
                }}
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 p-2.5 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-xs">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button variant="ghost" onClick={handleClose} className="text-xs">
                Cancel
              </Button>
              <Button
                onClick={handleInspect}
                disabled={!fileName || !password || isInspecting}
                className="text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {isInspecting ? (
                  <>Decrypting...</>
                ) : (
                  <>
                    Inspect Archive
                    <ArrowRight className="h-3.5 w-3.5" />
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {step === "preview" && summary && (
          <div className="space-y-4">
            {/* Header / Origin info */}
            <div className="p-3 rounded-xl border border-white/[0.08] bg-white/[0.03] flex items-center justify-between text-xs">
              <div>
                <span className="text-muted-foreground">Exported: </span>
                <span className="text-foreground font-medium">
                  {summary.exportedAt ? new Date(summary.exportedAt).toLocaleString() : "Unknown"}
                </span>
              </div>
              <div className="text-[11px] font-mono text-muted-foreground bg-white/[0.04] px-2 py-0.5 rounded border border-white/[0.06]">
                App v{summary.appVersion}
              </div>
            </div>

            {/* Archive Contents Grid */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Detected Contents
              </label>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-2.5 p-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02]">
                  <Server className="h-4 w-4 text-sky-400 shrink-0" />
                  <div>
                    <div className="text-xs font-semibold text-foreground">
                      {summary.serverCount} Servers
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {summary.keyCount} SSH Keys
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 p-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02]">
                  <Terminal className="h-4 w-4 text-purple-400 shrink-0" />
                  <div>
                    <div className="text-xs font-semibold text-foreground">
                      {summary.macroCount} Macros
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {summary.macroGroupCount} Pipelines
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 p-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02]">
                  <Layers className="h-4 w-4 text-emerald-400 shrink-0" />
                  <div>
                    <div className="text-xs font-semibold text-foreground">
                      {summary.workspaceCount} Workspaces
                    </div>
                    <div className="text-[10px] text-muted-foreground">Layouts & tabs</div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 p-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02]">
                  <Palette className="h-4 w-4 text-amber-400 shrink-0" />
                  <div>
                    <div className="text-xs font-semibold text-foreground">Settings & Colors</div>
                    <div className="text-[10px] text-muted-foreground">
                      {summary.hasSettings ? "Included" : "None"}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Mode selection */}
            <div className="space-y-2 pt-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Restore Strategy
              </label>

              <div className="space-y-2">
                <div
                  onClick={() => setMode("merge")}
                  className={cn(
                    "p-3 rounded-xl border text-left cursor-pointer transition-all",
                    mode === "merge"
                      ? "border-primary bg-primary/10 shadow-xs"
                      : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground">
                      Merge with Existing (Recommended)
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/20 text-primary font-medium">
                      Safe
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Adds imported servers, keys, and macros alongside your existing data. Existing items are preserved.
                  </p>
                </div>

                <div
                  onClick={() => setMode("replace")}
                  className={cn(
                    "p-3 rounded-xl border text-left cursor-pointer transition-all",
                    mode === "replace"
                      ? "border-destructive/60 bg-destructive/10 shadow-xs"
                      : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground">
                      Fresh Restore (Replace All)
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-destructive/20 text-destructive font-medium">
                      Destructive
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Completely resets local storage and database, replacing everything with this archive.
                  </p>
                </div>
              </div>

              {mode === "replace" && (
                <div className="flex items-start gap-2 p-2.5 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-[11px] leading-relaxed">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    Warning: All current local server profiles, stored passwords, keys, and macros will be deleted before restoring.
                  </span>
                </div>
              )}
            </div>

            {error && (
              <div className="flex items-center gap-2 p-2.5 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-xs">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <Button
                variant="ghost"
                onClick={() => setStep("select_file")}
                disabled={isRestoring}
                className="text-xs"
              >
                Back
              </Button>
              <Button
                onClick={handleApplyRestore}
                disabled={isRestoring}
                className={cn(
                  "text-xs gap-1.5",
                  mode === "replace"
                    ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    : "bg-primary text-primary-foreground hover:bg-primary/90"
                )}
              >
                {isRestoring ? (
                  <>Restoring Data...</>
                ) : (
                  <>
                    <RotateCcw className="h-3.5 w-3.5" />
                    {mode === "replace" ? "Replace All & Restore" : "Merge & Restore"}
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {step === "success" && (
          <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 space-y-3 text-center">
            <div className="flex justify-center">
              <div className="h-12 w-12 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="h-6 w-6" />
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-foreground">Restore Complete</h4>
              <p className="text-xs text-muted-foreground mt-1">
                Your Termizen vault has been successfully restored.
              </p>
            </div>

            {importResult && (
              <div className="grid grid-cols-2 gap-2 text-left pt-1">
                <div className="p-2 rounded-lg bg-black/20 border border-white/[0.04] text-[11px]">
                  <span className="text-muted-foreground">Servers: </span>
                  <span className="text-foreground font-semibold">
                    {importResult.serversImported} imported
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-black/20 border border-white/[0.04] text-[11px]">
                  <span className="text-muted-foreground">Keys: </span>
                  <span className="text-foreground font-semibold">
                    {importResult.keysImported} imported
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-black/20 border border-white/[0.04] text-[11px]">
                  <span className="text-muted-foreground">Macros: </span>
                  <span className="text-foreground font-semibold">
                    {importResult.macrosImported} imported
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-black/20 border border-white/[0.04] text-[11px]">
                  <span className="text-muted-foreground">Workspaces: </span>
                  <span className="text-foreground font-semibold">
                    {importResult.workspacesImported} imported
                  </span>
                </div>
              </div>
            )}

            <div className="pt-2">
              <Button onClick={handleClose} className="w-full text-xs">
                Finish & Close
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
