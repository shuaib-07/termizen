import { ArrowUpCircle, Download, ExternalLink } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { openExternalUrl, type UpdateInfo } from "@/lib/updater";

interface UpdatePromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  updateInfo: UpdateInfo | null;
}

export function UpdatePromptModal({ isOpen, onClose, updateInfo }: UpdatePromptModalProps) {
  if (!updateInfo || !updateInfo.updateAvailable) return null;

  const handleUpdate = () => {
    const targetUrl = updateInfo.assetUrl || updateInfo.releaseUrl;
    openExternalUrl(targetUrl);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Update Available"
      description="A new version of Termizen is ready to download."
      icon={<ArrowUpCircle className="h-4 w-4 text-primary" />}
      maxWidth="max-w-md"
    >
      <div className="space-y-4 pt-1">
        {/* Version Comparison Card */}
        <div className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.03] p-3.5">
          <div className="space-y-0.5">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Installed</span>
            <div className="text-sm font-semibold text-zinc-300 font-mono">
              v{updateInfo.currentVersion}
            </div>
          </div>

          <div className="flex items-center px-2 text-muted-foreground/60">
            <span className="text-xs">→</span>
          </div>

          <div className="space-y-0.5 text-right">
            <span className="text-[11px] font-medium text-primary uppercase tracking-wider">Latest Version</span>
            <div className="flex items-center justify-end gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-sm font-bold text-foreground font-mono">
                v{updateInfo.latestVersion}
              </span>
            </div>
          </div>
        </div>

        {/* Release Notes Preview */}
        {updateInfo.releaseNotes && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between px-0.5">
              <span className="text-[11px] font-medium text-muted-foreground">Release Notes</span>
              {updateInfo.releaseName && updateInfo.releaseName !== updateInfo.latestVersion && (
                <span className="text-[10px] text-zinc-400 truncate max-w-[200px]">
                  {updateInfo.releaseName}
                </span>
              )}
            </div>
            <div className="text-xs text-muted-foreground/90 whitespace-pre-wrap max-h-44 overflow-y-auto bg-black/30 p-3 rounded-xl border border-white/[0.06] scrollbar-thin leading-relaxed">
              {updateInfo.releaseNotes}
            </div>
          </div>
        )}

        {/* Subdued Notice */}
        <p className="text-[11px] text-muted-foreground/80 leading-normal">
          Updating is optional. You can download the latest installer now or continue using your current version.
        </p>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-border/40 pt-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
          >
            Remind Me Later
          </Button>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => openExternalUrl(updateInfo.releaseUrl)}
              className="text-xs gap-1.5 cursor-pointer h-8"
              title="View full release on GitHub"
            >
              <span>GitHub</span>
              <ExternalLink className="h-3 w-3" />
            </Button>

            <Button
              size="sm"
              onClick={handleUpdate}
              className="text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold cursor-pointer shadow-sm h-8"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Update Now</span>
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default UpdatePromptModal;
