import { Sparkles, Terminal, Activity, ShieldCheck, Zap, Globe, Cpu, CheckCircle2, ExternalLink } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { openExternalUrl, type UpdateInfo } from "@/lib/updater";

interface WhatsNewModalProps {
  isOpen: boolean;
  onClose: () => void;
  latestUpdate?: UpdateInfo | null;
}

export function WhatsNewModal({ isOpen, onClose, latestUpdate }: WhatsNewModalProps) {
  const HIGHLIGHTS = [
    {
      icon: Terminal,
      title: "Real Windows 11 Mica & Fluid Tabs",
      description: "Native OS-composited DWM Mica dark backdrop with 0% opacity root and zero glow. Multi-tab terminal with 50/50 horizontal and vertical split screen.",
    },
    {
      icon: Activity,
      title: "Server Hub & Live Status Charts",
      description: "Real-time CPU core graphs, memory allocations, disk mounts, and network throughput charts streamed over SSH without installing any agent.",
    },
    {
      icon: Globe,
      title: "Live Web Traffic Analytics",
      description: "Live access log analytics for Nginx and Apache with real-time status code distribution, top endpoints, request rates, and client IP detection.",
    },
    {
      icon: Cpu,
      title: "Service Log Tail Streaming",
      description: "Automated discovery and live log streaming for PM2 apps, Docker containers, and systemd services with instant ANSI color rendering.",
    },
    {
      icon: ShieldCheck,
      title: "Hardware Encrypted Key Vault",
      description: "Local private key and passphrase storage safeguarded with authenticated AES-256-GCM encryption in an embedded SQLite database.",
    },
    {
      icon: Zap,
      title: "Macro Script Automation",
      description: "PTY and background exec automation macros with halt-on-error policies, folder organization, and profile-specific scoping.",
    },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="What's New in Termizen"
      description="Latest updates, architecture enhancements, and release notes."
      icon={<Sparkles className="h-4 w-4" />}
      maxWidth="max-w-2xl"
    >
      <div className="space-y-4 pt-1">
        {/* Dynamic Latest Release Notice (if available) */}
        {latestUpdate && latestUpdate.updateAvailable && (
          <div className="rounded-xl border border-primary/30 bg-primary/10 p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-semibold text-xs text-foreground">
                  New Version Available: v{latestUpdate.latestVersion}
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1.5 border-primary/40 bg-primary/20 hover:bg-primary/30 text-foreground cursor-pointer"
                onClick={() => openExternalUrl(latestUpdate.releaseUrl)}
              >
                <span>View Release</span>
                <ExternalLink className="h-3 w-3" />
              </Button>
            </div>
            {latestUpdate.releaseNotes && (
              <div className="text-xs text-muted-foreground whitespace-pre-wrap max-h-36 overflow-y-auto bg-black/20 p-2.5 rounded-lg border border-white/[0.04]">
                {latestUpdate.releaseNotes}
              </div>
            )}
          </div>
        )}

        {/* Current Release Banner */}
        <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-foreground">Termizen v0.1.0</span>
              <span className="rounded bg-primary/20 px-2 py-0.5 text-[10px] font-mono text-primary font-medium border border-primary/30">
                Official Release
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Windows 11 Native Server Manager & Lightweight SSH Terminal
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Installed</span>
          </div>
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {HIGHLIGHTS.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                className="rounded-xl border border-white/[0.05] bg-card/60 p-3 space-y-1.5 hover:border-white/10 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20 flex-shrink-0">
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <h4 className="font-semibold text-xs text-foreground tracking-tight">{item.title}</h4>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {item.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between border-t border-border/40 pt-3">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground hover:text-foreground cursor-pointer gap-1.5"
            onClick={() => openExternalUrl("https://github.com/shuaib-07/termizen/releases")}
          >
            <span>Full GitHub Release History</span>
            <ExternalLink className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            onClick={onClose}
            className="text-xs cursor-pointer"
          >
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default WhatsNewModal;
