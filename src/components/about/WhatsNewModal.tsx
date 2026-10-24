import { Sparkles, Terminal, Activity, Zap, Globe, CheckCircle2, ExternalLink, Layers } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { openExternalUrl, APP_VERSION, type UpdateInfo } from "@/lib/updater";

interface WhatsNewModalProps {
  isOpen: boolean;
  onClose: () => void;
  latestUpdate?: UpdateInfo | null;
}

export function WhatsNewModal({ isOpen, onClose, latestUpdate }: WhatsNewModalProps) {
  const HIGHLIGHTS = [
    {
      icon: Layers,
      title: "Workspaces & Multi-Terminal Stacks",
      description: "Define multi-terminal environment stacks to launch in separate tabs or unified split-screen grids with optional automated startup macros.",
    },
    {
      icon: Zap,
      title: "Dedicated Macros View & Pipelines",
      description: "Full-page macro cockpit with live search, execution mode filters (Interactive PTY vs Direct exec), folder tags, and sequential multi-macro Group Pipelines.",
    },
    {
      icon: Globe,
      title: "Traffic Health & Scanner Detection",
      description: "Plain-English server diagnosis banners, automatic 4xx/5xx security bot scanner detection, and live access log quick filter chips.",
    },
    {
      icon: Terminal,
      title: "Pane Drag-Drop & Tab Extraction",
      description: "Intuitive drag handle to swap or dock terminal panes in any tree configuration, plus one-click pop-out to extract any split pane into a new dedicated tab.",
    },
    {
      icon: Sparkles,
      title: "Spring-Animated Tooltips & UI Polish",
      description: "Collision-aware, portal-rendered spring tooltips across all buttons, standardized rectangular folder badges, and dynamic theme accent alignment.",
    },
    {
      icon: Activity,
      title: "Automated Launch Update Alerts",
      description: "Optional startup update checks with instant update notification modal and direct one-click installer downloads from GitHub releases.",
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
              <span className="font-semibold text-sm text-foreground">Termizen v{APP_VERSION}</span>
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
