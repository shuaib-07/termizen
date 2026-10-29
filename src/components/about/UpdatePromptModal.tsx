import { useState, useEffect } from "react";
import {
  ArrowUpCircle,
  Download,
  ExternalLink,
  Loader2,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { listen } from "@tauri-apps/api/event";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import {
  openExternalUrl,
  downloadAndInstallUpdate,
  type UpdateInfo,
  type DownloadProgress,
} from "@/lib/updater";

interface UpdatePromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  updateInfo: UpdateInfo | null;
}

function formatBytes(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function UpdatePromptModal({ isOpen, onClose, updateInfo }: UpdatePromptModalProps) {
  const [status, setStatus] = useState<"idle" | "downloading" | "installing" | "error">("idle");
  const [progress, setProgress] = useState<DownloadProgress>({
    downloadedBytes: 0,
    totalBytes: null,
    percent: 0,
    speedBytesPerSec: 0,
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setStatus("idle");
      setErrorMessage(null);
      setProgress({
        downloadedBytes: 0,
        totalBytes: null,
        percent: 0,
        speedBytesPerSec: 0,
      });
      return;
    }

    let unlistenProgress: (() => void) | null = null;
    let unlistenComplete: (() => void) | null = null;

    listen<DownloadProgress>("update-download-progress", (event) => {
      setProgress(event.payload);
      if (event.payload.percent >= 99.9) {
        setStatus("installing");
      }
    }).then((fn) => {
      unlistenProgress = fn;
    });

    listen("update-download-complete", () => {
      setStatus("installing");
    }).then((fn) => {
      unlistenComplete = fn;
    });

    return () => {
      unlistenProgress?.();
      unlistenComplete?.();
    };
  }, [isOpen]);

  if (!updateInfo || !updateInfo.updateAvailable) return null;

  const handleStartUpdate = async () => {
    const targetUrl = updateInfo.assetUrl || updateInfo.releaseUrl;

    // If there is no direct installer .exe file (e.g. source only), open browser directly
    if (!targetUrl.endsWith(".exe") && !targetUrl.endsWith(".msi") && !updateInfo.hasDirectInstaller) {
      openExternalUrl(targetUrl);
      onClose();
      return;
    }

    try {
      setStatus("downloading");
      setErrorMessage(null);
      setProgress({
        downloadedBytes: 0,
        totalBytes: null,
        percent: 0,
        speedBytesPerSec: 0,
      });

      await downloadAndInstallUpdate(targetUrl, updateInfo.latestVersion, true);
    } catch (err: any) {
      console.error("In-app update failed:", err);
      setStatus("error");
      setErrorMessage(String(err?.message || err));
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={status === "downloading" || status === "installing" ? () => {} : onClose}
      title="Update Available"
      description="A new version of Termizen is ready to download."
      icon={<ArrowUpCircle className="h-4 w-4 text-primary" />}
      maxWidth="max-w-md"
    >
      <div className="space-y-4 pt-1">
        {/* Version Comparison Card */}
        <div className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.03] p-3.5">
          <div className="space-y-0.5">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Installed
            </span>
            <div className="text-sm font-semibold text-zinc-300 font-mono">
              v{updateInfo.currentVersion}
            </div>
          </div>

          <div className="flex items-center px-2 text-muted-foreground/60">
            <span className="text-xs">→</span>
          </div>

          <div className="space-y-0.5 text-right">
            <span className="text-[11px] font-medium text-primary uppercase tracking-wider">
              Latest Version
            </span>
            <div className="flex items-center justify-end gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-sm font-bold text-foreground font-mono">
                v{updateInfo.latestVersion}
              </span>
            </div>
          </div>
        </div>

        {/* Live Download & Install Progress Bar */}
        {(status === "downloading" || status === "installing") && (
          <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-3 shadow-inner">
            <div className="flex items-center justify-between text-xs font-medium">
              <span className="flex items-center gap-2 text-foreground">
                <Loader2 className="h-4 w-4 text-primary animate-spin" />
                <span>
                  {status === "installing"
                    ? "Launching installer & restarting Termizen…"
                    : "Downloading update package in-app…"}
                </span>
              </span>
              <span className="font-mono text-primary font-bold">
                {Math.round(progress.percent)}%
              </span>
            </div>

            {/* Glowing animated progress track */}
            <div className="relative w-full h-2.5 rounded-full bg-zinc-900 overflow-hidden border border-white/[0.08]">
              <div
                className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-primary rounded-full transition-all duration-200 ease-out shadow-sm shadow-primary/50"
                style={{ width: `${Math.max(4, Math.min(100, progress.percent))}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono">
              <span>
                {formatBytes(progress.downloadedBytes)}
                {progress.totalBytes ? ` / ${formatBytes(progress.totalBytes)}` : ""}
              </span>
              {status === "downloading" && progress.speedBytesPerSec > 0 && (
                <span>{formatBytes(progress.speedBytesPerSec)}/s</span>
              )}
            </div>
          </div>
        )}

        {/* Error Card */}
        {status === "error" && (
          <div className="flex flex-col gap-2 p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-xs text-red-300">
            <div className="flex items-center gap-2 font-medium text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>In-app download encountered an issue</span>
            </div>
            <p className="text-[11px] opacity-90 leading-relaxed">
              {errorMessage || "Failed to download update package."}
            </p>
            <div className="flex items-center gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={handleStartUpdate}
                className="h-7 text-xs gap-1 border-red-500/30 bg-red-950/40 text-red-200 hover:bg-red-900/50"
              >
                <RefreshCw className="h-3 w-3" />
                <span>Try Again</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => openExternalUrl(updateInfo.releaseUrl)}
                className="h-7 text-xs gap-1 text-red-300 hover:bg-white/[0.06]"
              >
                <span>Download via Browser</span>
                <ExternalLink className="h-3 w-3" />
              </Button>
            </div>
          </div>
        )}

        {/* Release Notes Preview */}
        {status === "idle" && updateInfo.releaseNotes && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between px-0.5">
              <span className="text-[11px] font-medium text-muted-foreground">Release Notes</span>
              {updateInfo.releaseName && updateInfo.releaseName !== updateInfo.latestVersion && (
                <span className="text-[10px] text-zinc-400 truncate max-w-[200px]">
                  {updateInfo.releaseName}
                </span>
              )}
            </div>
            <div className="text-xs text-muted-foreground/90 whitespace-pre-wrap max-h-40 overflow-y-auto bg-black/30 p-3 rounded-xl border border-white/[0.06] scrollbar-thin leading-relaxed">
              {updateInfo.releaseNotes}
            </div>
          </div>
        )}

        {/* Subdued Notice */}
        {status === "idle" && (
          <p className="text-[11px] text-muted-foreground/80 leading-normal">
            Termizen will download the update package directly, install smoothly in the background, and restart with the latest version.
          </p>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-border/40 pt-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={status === "downloading" || status === "installing"}
            className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
          >
            Remind Me Later
          </Button>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => openExternalUrl(updateInfo.releaseUrl)}
              disabled={status === "downloading" || status === "installing"}
              className="text-xs gap-1.5 cursor-pointer h-8"
              title="View full release on GitHub"
            >
              <span>GitHub</span>
              <ExternalLink className="h-3 w-3" />
            </Button>

            <Button
              size="sm"
              onClick={handleStartUpdate}
              disabled={status === "downloading" || status === "installing"}
              className="text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold cursor-pointer shadow-sm h-8"
            >
              {status === "downloading" || status === "installing" ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Updating…</span>
                </>
              ) : (
                <>
                  <Download className="h-3.5 w-3.5" />
                  <span>Update In-App</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default UpdatePromptModal;
