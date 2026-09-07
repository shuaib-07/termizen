import { useId, useState } from "react";
import { motion, MotionConfig } from "framer-motion";
import { FolderPlus, Key, LayoutDashboard, Server, Settings, Terminal, Zap } from "lucide-react";
import { BloomMenu, type BloomMenuItem } from "@/components/ui/bloom-menu";
import { FolderModal } from "@/components/folders/FolderModal";
import { addEmptyFolder, getEmptyFolders } from "@/lib/folderMetadata";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import logo from "@/assets/logo.png";
import ProfileSidebar from "./ProfileSidebar";
import MacrosPanel from "./MacrosPanel";
import type { MacroSummary, ProfileSummary } from "./sessions";
import type { ServerHubSubView, SidebarViewMode } from "./types";

export default function Sidebar({
  activeNav,
  onSelectNav,
  profiles,
  macros,
  onOpenProfile,
  onEditProfile,
  onDeleteProfile,
  onRunMacro,
  onNewMacro,
  onEditMacro,
  onDeleteMacro,
  onTogglePin,
  onToggleBgMonitoring,
  onAddServer,
  onNewTab,
  onOpenKeyVault,
  onRefresh,
}: {
  activeNav: SidebarViewMode;
  onSelectNav: (nav: SidebarViewMode) => void;
  profiles: ProfileSummary[];
  macros: MacroSummary[];
  onOpenProfile: (profile: ProfileSummary, subView?: ServerHubSubView) => void;
  onEditProfile: (profile: ProfileSummary) => void;
  onDeleteProfile: (id: number) => void;
  onRunMacro: (macroIdOrProfileId: number, macroIdOrOptions?: number | { profileId?: number; shell?: string }) => void;
  onNewMacro: () => void;
  onEditMacro: (id: number) => void;
  onDeleteMacro: (id: number) => void;
  onTogglePin?: (id: number, pinned: boolean) => void;
  onToggleBgMonitoring?: (id: number, enabled: boolean) => void;
  onAddServer: () => void;
  onNewTab?: () => void;
  onOpenKeyVault?: () => void;
  onRefresh?: () => void;
}) {
  const pillLayoutId = useId();
  const [newFolderModalOpen, setNewFolderModalOpen] = useState(false);

  const NAV_ITEMS: { id: SidebarViewMode; label: string; icon: any; count?: number }[] = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "servers", label: "Servers", icon: Server, count: profiles.length },
    { id: "macros", label: "Macros", icon: Zap, count: macros.length },
    { id: "keys", label: "Key Vault", icon: Key },
  ];

  const bloomItems: BloomMenuItem[] = [
    {
      id: "add-server",
      label: "Add Server",
      description: "New SSH profile",
      icon: Server,
      onClick: onAddServer,
    },
    {
      id: "new-macro",
      label: "Create Macro",
      description: "Automate commands",
      icon: Zap,
      onClick: onNewMacro,
    },
    {
      id: "new-tab",
      label: "New Terminal",
      description: "Local / split session",
      icon: Terminal,
      onClick: onNewTab,
    },
    {
      id: "key-vault",
      label: "SSH Key Vault",
      description: "Manage credentials",
      icon: Key,
      onClick: onOpenKeyVault ? onOpenKeyVault : () => onSelectNav("keys"),
    },
  ];

  return (
    <Card className="flex h-full min-h-0 flex-col border border-white/[0.04] bg-card relative">
      {/* Top Brand & Add Server CTA */}
      <div className="p-3 border-b border-white/[0.03] space-y-2.5 relative z-20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={logo} alt="Termizen" className="h-6 w-6 rounded-md object-contain" />
            <span className="font-bold text-sm tracking-tight text-foreground">Termizen</span>
          </div>
          <span className="rounded bg-muted/60 px-1.5 py-0.2 text-[10px] font-mono text-muted-foreground">
            v0.2.0
          </span>
        </div>

        <BloomMenu items={bloomItems} triggerLabel="Create" />
      </div>

      {/* Navigation Rail Tabs */}
      <div className="p-2 border-b border-border">
        <MotionConfig reducedMotion="user">
          <div className="grid grid-cols-2 gap-1 bg-muted/30 p-1 rounded-lg">
            {NAV_ITEMS.map((item) => {
              const isActive = activeNav === item.id;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectNav(item.id)}
                  className={`relative z-10 flex items-center justify-between rounded-md px-2 py-1.5 text-xs transition-colors ${
                    isActive ? "text-foreground font-semibold" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId={pillLayoutId}
                      className="absolute inset-0 z-[-1] rounded-md border border-border bg-background shadow-sm"
                      transition={{ type: "spring", duration: 0.35, bounce: 0.15 }}
                    />
                  )}
                  <span className="flex items-center gap-1.5 truncate">
                    <Icon className="h-3.5 w-3.5" />
                    <span className="truncate">{item.label}</span>
                  </span>
                  {item.count !== undefined && item.count > 0 && (
                    <span className="text-[10px] font-mono opacity-70 ml-1">
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </MotionConfig>
      </div>

      {/* Body: Profile Explorer or Content Panel */}
      <div className="min-h-0 flex-1 overflow-y-auto rounded-b-xl">
        {activeNav === "servers" || activeNav === "dashboard" ? (
          <div className="h-full flex flex-col">
            <div className="px-3 pt-2 flex items-center justify-between text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              <span>Saved Servers</span>
              <button
                type="button"
                onClick={() => setNewFolderModalOpen(true)}
                title="Create New Folder"
                className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground normal-case font-medium hover:bg-white/[0.06] px-1.5 py-0.5 rounded cursor-pointer transition-colors"
              >
                <FolderPlus className="h-3 w-3" />
                <span>Folder</span>
              </button>
            </div>
            <div className="flex-1 min-h-0">
              <ProfileSidebar
                profiles={profiles}
                macros={macros}
                onOpen={onOpenProfile}
                onEditProfile={onEditProfile}
                onDelete={onDeleteProfile}
                onRunMacro={onRunMacro}
                onEditMacro={onEditMacro}
                onDeleteMacro={onDeleteMacro}
                onTogglePin={onTogglePin}
                onToggleBgMonitoring={onToggleBgMonitoring}
                onRefresh={onRefresh}
              />
            </div>
          </div>
        ) : activeNav === "macros" ? (
          <MacrosPanel
            macros={macros}
            profiles={profiles}
            onNewMacro={onNewMacro}
            onRunMacro={onRunMacro}
            onEditMacro={onEditMacro}
            onDelete={onDeleteMacro}
          />
        ) : activeNav === "settings" ? (
          <div className="p-4 text-xs text-muted-foreground">
            <p className="font-semibold text-foreground mb-1">Settings Active</p>
            <p>Customize themes, colors, and container appearance in the main workspace.</p>
          </div>
        ) : (
          <div className="p-4 text-xs text-muted-foreground">
            <p>Key Vault active in main view.</p>
          </div>
        )}
      </div>

      {/* Footer: Settings */}
      <div className="p-2 border-t border-white/[0.04]">
        <button
          onClick={() => onSelectNav("settings")}
          className={cn(
            "relative z-10 flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs transition-colors cursor-pointer",
            activeNav === "settings"
              ? "text-foreground font-semibold bg-white/[0.06]"
              : "text-muted-foreground hover:bg-white/[0.03] hover:text-foreground"
          )}
        >
          <span className="flex items-center gap-2">
            <Settings className="h-3.5 w-3.5" />
            <span>Settings</span>
          </span>
          {activeNav === "settings" && (
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          )}
        </button>
      </div>

      {/* New Folder Modal */}
      <FolderModal
        isOpen={newFolderModalOpen}
        onClose={() => setNewFolderModalOpen(false)}
        existingFolders={Array.from(new Set([...profiles.map((p) => p.folder).filter(Boolean), ...macros.map((m) => m.folder).filter(Boolean), ...getEmptyFolders()])) as string[]}
        onSave={async (_, newName, color) => {
          addEmptyFolder(newName, color);
          onRefresh?.();
        }}
      />
    </Card>
  );
}
