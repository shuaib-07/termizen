import { useEffect, useState } from "react";
import { LayoutDashboard, Pencil, Plus as PlusIcon, Server, Terminal as TerminalIcon, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import TabBar from "./TabBar";
import PaneView from "./PaneView";
import Sidebar from "./Sidebar";
import ServerDashboard from "./components/dashboard/ServerDashboard";
import KeyVaultView from "./components/keys/KeyVaultView";
import SettingsView, { applyTheme, getStoredAccent, getStoredTheme } from "./components/settings/SettingsView";
import AboutView from "./components/about/AboutView";
import { checkAppUpdates, getAutoCheckUpdates, type UpdateInfo } from "./lib/updater";
import ServerFormModal from "./components/servers/ServerFormModal";
import { ClosePromptModal } from "@/components/ui/ClosePromptModal";
import { getStoredCloseBehavior } from "@/lib/closeSettings";
import { Loader } from "@/components/Loader";
import { ToastProvider, useToast } from "@/components/ui/animated-toast-stack";
import { cn } from "@/lib/utils";
import {
  deleteProfile,
  deleteMacro,
  getMacroSteps,
  listMacros,
  listProfiles,
  profileSession,
  saveMacro,
  setProfilePinned,
  setProfileBgMonitoring,
  fetchServerMetrics,
  setCachedMetrics,
  updateMacro,
  appHideToTray,
  appExit,
} from "./sessions";
import type { MacroSummary, ProfileSummary, SaveMacroParams } from "./sessions";
import type { Pane, PaneLayout, ServerHubSubView, SidebarViewMode, Tab } from "./types";

let nextId = 1;
const genId = (prefix: string) => `${prefix}-${nextId++}`;

function newPane(): Pane {
  return { id: genId("pane"), title: "New Tab", content: { kind: "connect" } };
}

function newTab(): Tab {
  return { id: genId("tab"), layout: { kind: "single", pane: newPane() } };
}

function tabTitle(tab: Tab): string {
  return tab.layout.kind === "single" ? tab.layout.pane.title : tab.layout.panes.map((p) => p.title).join(" | ");
}

const TAB_KIND_ICON = {
  connect: PlusIcon,
  local: TerminalIcon,
  ssh: Server,
  "macro-run": Zap,
  "macro-editor": Pencil,
} as const;

function tabIcon(tab: Tab) {
  const primaryPane = tab.layout.kind === "single" ? tab.layout.pane : tab.layout.panes[0];
  if ("macroId" in primaryPane.content && primaryPane.content.macroId != null) {
    return <Zap className="h-3.5 w-3.5 text-amber-400" />;
  }
  const Icon = TAB_KIND_ICON[primaryPane.content.kind];
  return <Icon className="h-3.5 w-3.5" />;
}

function updatePaneInLayout(layout: PaneLayout, paneId: string, updater: (p: Pane) => Pane): PaneLayout {
  if (layout.kind === "single") {
    return layout.pane.id === paneId ? { ...layout, pane: updater(layout.pane) } : layout;
  }
  return { ...layout, panes: layout.panes.map((p) => (p.id === paneId ? updater(p) : p)) as [Pane, Pane] };
}

function AppContent() {
  const { toast } = useToast();
  const [activeNav, setActiveNav] = useState<SidebarViewMode>("dashboard");
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeId, setActiveId] = useState<string>("dashboard");
  const [orientation, setOrientation] = useState<"horizontal" | "vertical">("horizontal");
  const [profiles, setProfiles] = useState<ProfileSummary[]>([]);
  const [macros, setMacros] = useState<MacroSummary[]>([]);
  const [ready, setReady] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);

  // Auto-check for updates on launch if enabled
  useEffect(() => {
    if (getAutoCheckUpdates()) {
      checkAppUpdates()
        .then((info) => {
          if (info.updateAvailable) {
            setUpdateInfo(info);
            toast({
              title: "Update Available",
              description: `Termizen v${info.latestVersion} is available. Click About in sidebar to view release.`,
              status: "info",
            });
          }
        })
        .catch((err) => console.warn("Auto update check failed:", err));
    }
  }, []);

  // Server Modal
  const [showServerModal, setShowServerModal] = useState(false);
  const [editingProfile, setEditingProfile] = useState<ProfileSummary | null>(null);

  const refreshProfiles = () => listProfiles().then(setProfiles);
  const refreshMacros = () => listMacros().then(setMacros);

  // Responsive window & sidebar state
  const [windowWidth, setWindowWidth] = useState(() => (typeof window !== "undefined" ? window.innerWidth : 1200));
  const isMobile = windowWidth < 768;

  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("termizen_sidebar_open");
      if (saved !== null) return saved === "true";
      return window.innerWidth >= 1024;
    }
    return true;
  });

  const toggleSidebar = () => {
    setSidebarOpen((prev) => {
      const next = !prev;
      localStorage.setItem("termizen_sidebar_open", String(next));
      return next;
    });
  };

  // Keyboard shortcut Ctrl+B / Cmd+B to toggle sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Listen to window resize
  useEffect(() => {
    let timeoutId: number;
    const handleResize = () => {
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        setWindowWidth(window.innerWidth);
      }, 50);
    };
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      window.clearTimeout(timeoutId);
    };
  }, []);

  const [showClosePrompt, setShowClosePrompt] = useState(false);

  useEffect(() => {
    applyTheme(getStoredTheme(), getStoredAccent());
    Promise.all([refreshProfiles(), refreshMacros()]).then(() => setReady(true));
  }, []);

  // Intercept window close requests
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    (async () => {
      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        const appWindow = getCurrentWindow();
        unlisten = await appWindow.onCloseRequested(async (event) => {
          const behavior = getStoredCloseBehavior();
          if (behavior === "background") {
            event.preventDefault();
            await appHideToTray();
          } else if (behavior === "quit") {
            await appExit();
          } else {
            // "ask"
            event.preventDefault();
            setShowClosePrompt(true);
          }
        });
      } catch (err) {
        console.warn("Could not attach onCloseRequested listener:", err);
      }
    })();

    return () => {
      unlisten?.();
    };
  }, []);

  const handleKeepInBackground = async () => {
    try {
      await appHideToTray();
    } catch {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().hide();
    }
  };

  const handleCloseCompletely = async () => {
    try {
      await appExit();
    } catch {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().destroy();
    }
  };

  const handleDeleteProfile = async (id: number) => {
    const profile = profiles.find((p) => p.id === id);
    await deleteProfile(id);
    await refreshProfiles();
    toast({
      title: "Server Removed",
      description: profile ? `Removed ${profile.name} from saved profiles` : undefined,
      status: "neutral",
    });
  };

  const handleSaveMacro = async (params: SaveMacroParams, macroId?: number) => {
    if (macroId != null) {
      await updateMacro(macroId, params);
      toast({
        title: "Macro Updated",
        description: `Successfully updated ${params.name}`,
        status: "success",
      });
    } else {
      await saveMacro(params);
      toast({
        title: "Macro Created",
        description: `Saved new macro ${params.name}`,
        status: "success",
      });
    }
    await refreshMacros();
  };

  const handleDeleteMacro = async (id: number) => {
    const macro = macros.find((m) => m.id === id);
    await deleteMacro(id);
    await refreshMacros();
    toast({
      title: "Macro Deleted",
      description: macro ? `Removed ${macro.name}` : undefined,
      status: "neutral",
    });
  };

  const handleTogglePinProfile = async (id: number, pinned: boolean) => {
    const profile = profiles.find((p) => p.id === id);
    await setProfilePinned(id, pinned);
    await refreshProfiles();
    toast({
      title: pinned ? "Server Pinned" : "Server Unpinned",
      description: profile ? `${profile.name} ${pinned ? "pinned" : "unpinned"}` : undefined,
      status: "info",
    });
  };

  const handleToggleBgMonitoring = async (id: number, enabled: boolean) => {
    if (enabled) {
      const activeCount = profiles.filter((p) => p.id !== id && p.bgMonitoring).length;
      if (activeCount >= 5) {
        toast({
          title: "Monitoring Limit Reached",
          description: "A maximum of 5 servers can have 24/7 background monitoring enabled simultaneously to protect system and network resources.",
          status: "error",
        });
        return;
      }
    }
    const profile = profiles.find((p) => p.id === id);
    await setProfileBgMonitoring(id, enabled);
    await refreshProfiles();
    toast({
      title: enabled ? "24/7 Monitoring Active" : "Smart Monitoring Active",
      description: profile
        ? `${profile.name}: ${enabled ? "Continuous 24/7 background monitoring enabled" : "Smart on-demand monitoring enabled"}`
        : undefined,
      status: enabled ? "success" : "neutral",
    });
  };

  // Option 2 (24/7 Background Monitoring) Coordinator:
  // For profiles with bgMonitoring === true (capped at 5), poll metrics continuously
  // even when working on another tab or screen.
  useEffect(() => {
    const bgMonitored = profiles.filter((p) => p.kind === "ssh" && p.bgMonitoring);
    if (bgMonitored.length === 0) return;

    let active = true;
    let inFlight = false;
    const failedCooldown = new Map<number, number>();

    const pollBg = async () => {
      const isDashboardVisible = activeId === "dashboard" && activeNav === "dashboard";
      if (!isDashboardVisible && active && !inFlight) {
        inFlight = true;
        try {
          for (const p of bgMonitored.slice(0, 5)) {
            if (!active) break;
            const lastFail = failedCooldown.get(p.id) || 0;
            if (Date.now() - lastFail < 60000) continue; // Cooldown 60s on failure

            try {
              const data = await fetchServerMetrics(p.id);
              if (active) {
                setCachedMetrics(p.id, data);
                failedCooldown.delete(p.id);
              }
            } catch {
              failedCooldown.set(p.id, Date.now());
            }
          }
        } finally {
          inFlight = false;
        }
      }
    };

    const interval = setInterval(pollBg, 6000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [profiles, activeId, activeNav]);

  const handleOpenProfile = (profile: ProfileSummary, initialSubView?: ServerHubSubView) => {
    // 1. Check if the currently active tab is an empty 'connect' launcher tab
    const activeTab = tabs.find((t) => t.id === activeId);
    if (activeTab && activeTab.layout.kind === "single" && activeTab.layout.pane.content.kind === "connect") {
      updatePane(activeTab.id, activeTab.layout.pane.id, (p) => ({
        ...p,
        title: profile.name,
        content: {
          kind: "ssh",
          session: profileSession(profile),
          profileId: profile.id,
          initialSubView: initialSubView || "terminal",
          profileName: profile.name,
          host: profile.host,
        },
      }));
      setActiveNav("servers");
      return;
    }

    // 2. Check if this profile is already open in an existing single tab
    const existingTab = tabs.find(
      (t) =>
        t.layout.kind === "single" &&
        t.layout.pane.content.kind === "ssh" &&
        t.layout.pane.content.profileId === profile.id
    );
    if (existingTab) {
      setActiveId(existingTab.id);
      setActiveNav("servers");
      return;
    }

    // 3. Otherwise, create a new tab and focus it
    const tab: Tab = {
      id: genId("tab"),
      layout: {
        kind: "single",
        pane: {
          id: genId("pane"),
          title: profile.name,
          content: {
            kind: "ssh",
            session: profileSession(profile),
            profileId: profile.id,
            initialSubView: initialSubView || "terminal",
            profileName: profile.name,
            host: profile.host,
          },
        },
      },
    };
    setTabs((prev) => [...prev, tab]);
    setActiveId(tab.id);
    setActiveNav("servers");
  };

  const handleNewMacroTab = () => {
    const tab: Tab = { id: genId("tab"), layout: { kind: "single", pane: { id: genId("pane"), title: "New Macro", content: { kind: "macro-editor" } } } };
    setTabs((prev) => [...prev, tab]);
    setActiveId(tab.id);
    setActiveNav("macros");
  };

  const handleEditMacroTab = (macroId: number) => {
    const macro = macros.find((m) => m.id === macroId);
    const tab: Tab = { id: genId("tab"), layout: { kind: "single", pane: { id: genId("pane"), title: macro ? `Edit: ${macro.name}` : "Edit Macro", content: { kind: "macro-editor", macroId } } } };
    setTabs((prev) => [...prev, tab]);
    setActiveId(tab.id);
    setActiveNav("macros");
  };

  const handleRunMacro = async (
    macroIdOrProfileId: number,
    macroIdOrOptions?: number | { profileId?: number; shell?: string }
  ) => {
    let macroId: number;
    let targetProfileId: number | undefined;
    let shellOverride: string | undefined;

    if (typeof macroIdOrOptions === "number") {
      targetProfileId = macroIdOrProfileId;
      macroId = macroIdOrOptions;
    } else {
      macroId = macroIdOrProfileId;
      targetProfileId = macroIdOrOptions?.profileId;
      shellOverride = macroIdOrOptions?.shell;
    }

    const macro = macros.find((m) => m.id === macroId);
    if (!macro) return;

    const steps = await getMacroSteps(macroId);
    const resolvedProfileId = targetProfileId ?? macro.profileId;
    const targetProfile = resolvedProfileId ? profiles.find((p) => p.id === resolvedProfileId) : undefined;

    if (targetProfile) {
      // Check if the currently active tab is an empty 'connect' launcher tab
      const activeTab = tabs.find((t) => t.id === activeId);
      if (activeTab && activeTab.layout.kind === "single" && activeTab.layout.pane.content.kind === "connect") {
        updatePane(activeTab.id, activeTab.layout.pane.id, (p) => ({
          ...p,
          title: `${targetProfile.name}: ${macro.name}`,
          content: {
            kind: "ssh",
            session: profileSession(targetProfile),
            profileId: targetProfile.id,
            initialSubView: "terminal",
            profileName: targetProfile.name,
            host: targetProfile.host,
            initialCommands: steps,
            macroId: macro.id,
            macroName: macro.name,
          },
        }));
        setActiveNav("servers");
        return;
      }

      const tab: Tab = {
        id: genId("tab"),
        layout: {
          kind: "single",
          pane: {
            id: genId("pane"),
            title: `${targetProfile.name}: ${macro.name}`,
            content: {
              kind: "ssh",
              session: profileSession(targetProfile),
              profileId: targetProfile.id,
              initialSubView: "terminal",
              profileName: targetProfile.name,
              host: targetProfile.host,
              initialCommands: steps,
              macroId: macro.id,
              macroName: macro.name,
            },
          },
        },
      };
      setTabs((prev) => [...prev, tab]);
      setActiveId(tab.id);
      setActiveNav("servers");
    } else {
      const shell = shellOverride || macro.shell || "powershell";
      // Check if currently active tab is an empty 'connect' launcher tab
      const activeTab = tabs.find((t) => t.id === activeId);
      if (activeTab && activeTab.layout.kind === "single" && activeTab.layout.pane.content.kind === "connect") {
        updatePane(activeTab.id, activeTab.layout.pane.id, (p) => ({
          ...p,
          title: macro.name,
          content: {
            kind: "local",
            shell,
            initialCommands: steps,
            macroId: macro.id,
            macroName: macro.name,
          },
        }));
        return;
      }

      const tab: Tab = {
        id: genId("tab"),
        layout: {
          kind: "single",
          pane: {
            id: genId("pane"),
            title: macro.name,
            content: {
              kind: "local",
              shell,
              initialCommands: steps,
              macroId: macro.id,
              macroName: macro.name,
            },
          },
        },
      };
      setTabs((prev) => [...prev, tab]);
      setActiveId(tab.id);
    }
  };

  const updateTab = (tabId: string, updater: (tab: Tab) => Tab) => {
    setTabs((prev) => prev.map((t) => (t.id === tabId ? updater(t) : t)));
  };

  const updatePane = (tabId: string, paneId: string, updater: (p: Pane) => Pane) => {
    updateTab(tabId, (t) => ({ ...t, layout: updatePaneInLayout(t.layout, paneId, updater) }));
  };

  const splitPane = (tabId: string, direction: "row" | "column") => {
    updateTab(tabId, (t) => (t.layout.kind === "single" ? { ...t, layout: { kind: "split", direction, panes: [t.layout.pane, newPane()] } } : t));
  };

  const closePane = (tabId: string, paneId: string) => {
    updateTab(tabId, (t) => {
      if (t.layout.kind !== "split") return t;
      const remaining = t.layout.panes.find((p) => p.id !== paneId);
      return remaining ? { ...t, layout: { kind: "single", pane: remaining } } : t;
    });
  };

  const handleNewTab = () => {
    const tab = newTab();
    setTabs((prev) => [...prev, tab]);
    setActiveId(tab.id);
  };

  const handleClose = (tabId: string) => {
    const target = tabs.find((t) => t.id === tabId);
    if (target?.isLocked) return;
    const idx = tabs.findIndex((t) => t.id === tabId);
    if (idx === -1) return;
    const next = tabs.filter((t) => t.id !== tabId);
    setTabs(next);
    if (activeId === tabId) {
      const fallback = next[idx] ?? next[idx - 1];
      setActiveId(fallback ? fallback.id : "dashboard");
      if (!fallback) {
        setActiveNav("dashboard");
      }
    }
  };

  const handleToggleLockTab = (tabId: string) => {
    setTabs((prev) =>
      prev.map((t) => (t.id === tabId ? { ...t, isLocked: !t.isLocked } : t))
    );
  };

  const handleCloseOtherTabs = (tabId: string) => {
    setTabs((prev) => prev.filter((t) => t.id === tabId || t.isLocked));
    if (tabId !== "dashboard") {
      setActiveId(tabId);
    }
  };

  const handleCloseTabsToRight = (tabId: string) => {
    if (tabId === "dashboard") {
      setTabs((prev) => prev.filter((t) => t.isLocked));
      setActiveId("dashboard");
      return;
    }
    const targetIndex = tabs.findIndex((t) => t.id === tabId);
    if (targetIndex === -1) return;
    setTabs((prev) =>
      prev.filter((t, idx) => idx <= targetIndex || t.isLocked)
    );
    const activeIndex = tabs.findIndex((t) => t.id === activeId);
    const activeTab = tabs.find((t) => t.id === activeId);
    if (activeIndex > targetIndex && !activeTab?.isLocked) {
      setActiveId(tabId);
    }
  };

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader />
      </div>
    );
  }

  const allTabs = [
    {
      id: "dashboard",
      title: "Dashboard",
      icon: <LayoutDashboard className="h-3.5 w-3.5 text-primary" />,
      canClose: false,
      isLocked: false,
    },
    ...tabs.map((t) => ({
      id: t.id,
      title: tabTitle(t),
      icon: tabIcon(t),
      canClose: !t.isLocked,
      isLocked: !!t.isLocked,
    })),
  ];

  const sidebarElement = (
    <Sidebar
      activeNav={activeNav}
      onSelectNav={(nav) => {
        setActiveNav(nav);
        if (nav === "dashboard" || nav === "settings" || nav === "keys" || nav === "about") {
          setActiveId("dashboard");
        }
        if (isMobile) {
          setSidebarOpen(false);
        }
      }}
      profiles={profiles}
      macros={macros}
      hasUpdate={Boolean(updateInfo?.updateAvailable)}
      onOpenProfile={(profile, subView) => {
        handleOpenProfile(profile, subView);
        if (isMobile) {
          setSidebarOpen(false);
        }
      }}
      onEditProfile={(profile) => {
        setEditingProfile(profile);
        setShowServerModal(true);
      }}
      onDeleteProfile={handleDeleteProfile}
      onRunMacro={handleRunMacro}
      onNewMacro={handleNewMacroTab}
      onEditMacro={handleEditMacroTab}
      onDeleteMacro={handleDeleteMacro}
      onTogglePin={handleTogglePinProfile}
      onToggleBgMonitoring={handleToggleBgMonitoring}
      onAddServer={() => {
        setEditingProfile(null);
        setShowServerModal(true);
      }}
      onNewTab={handleNewTab}
      onOpenKeyVault={() => {
        setActiveNav("keys");
        if (isMobile) {
          setSidebarOpen(false);
        }
      }}
      onRefresh={() => {
        refreshProfiles();
        refreshMacros();
      }}
    />
  );

  return (
    <div className="flex h-screen w-screen gap-2 p-2 bg-transparent text-foreground overflow-hidden select-none relative">
      {/* Desktop Animated Sidebar (>= 768px): Pushes and resizes workspace */}
      {!isMobile && (
        <AnimatePresence initial={false}>
          {sidebarOpen && (
            <motion.div
              key="desktop-sidebar"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 256, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 350, damping: 30 }}
              style={{ overflow: sidebarOpen ? "visible" : "hidden" }}
              className="flex flex-shrink-0 flex-col gap-2 relative z-30"
            >
              <div className="w-64 h-full flex flex-col">
                {sidebarElement}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* Mobile / Small Screen Overlay Drawer (< 768px) */}
      {isMobile && (
        <AnimatePresence>
          {sidebarOpen && (
            <>
              <motion.div
                key="mobile-sidebar-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                onClick={() => setSidebarOpen(false)}
                className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs"
              />
              <motion.div
                key="mobile-sidebar-drawer"
                initial={{ x: -300 }}
                animate={{ x: 0 }}
                exit={{ x: -300 }}
                transition={{ type: "spring", stiffness: 350, damping: 30 }}
                className="fixed inset-y-2 left-2 z-50 w-72 max-w-[calc(100vw-1rem)] flex flex-col shadow-2xl"
              >
                {sidebarElement}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      )}

      {/* Main Workspace Area */}
      <div className={cn("flex min-w-0 flex-1 gap-2", orientation === "horizontal" ? "flex-col" : "flex-row")}>
        <TabBar
          tabs={allTabs}
          activeId={activeId}
          orientation={orientation}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={toggleSidebar}
          onSelect={(id) => {
            setActiveId(id);
            if (id === "dashboard") {
              setActiveNav("dashboard");
            }
          }}
          onClose={(id) => {
            if (id !== "dashboard") {
              handleClose(id);
            }
          }}
          onNew={handleNewTab}
          onToggleOrientation={() => setOrientation((o) => (o === "horizontal" ? "vertical" : "horizontal"))}
          onToggleLock={handleToggleLockTab}
          onCloseOthers={handleCloseOtherTabs}
          onCloseToRight={handleCloseTabsToRight}
        />

        <div className="relative min-w-0 min-h-0 flex-1">
          {/* Dashboard View */}
          <div className={cn("h-full w-full", activeId === "dashboard" && activeNav !== "keys" && activeNav !== "settings" && activeNav !== "about" ? "block" : "hidden")}>
            <ServerDashboard
              profiles={profiles}
              macros={macros}
              onOpenProfile={handleOpenProfile}
              onEditProfile={(profile) => {
                setEditingProfile(profile);
                setShowServerModal(true);
              }}
              onDeleteProfile={handleDeleteProfile}
              onAddServer={() => {
                setEditingProfile(null);
                setShowServerModal(true);
              }}
              onTogglePin={handleTogglePinProfile}
              onToggleBgMonitoring={handleToggleBgMonitoring}
              onRunMacro={handleRunMacro}
              onOpenKeyVault={() => setActiveNav("keys")}
            />
          </div>

          {/* Key Vault View */}
          <div className={cn("h-full w-full", activeNav === "keys" ? "block" : "hidden")}>
            <KeyVaultView onKeyAdded={refreshProfiles} />
          </div>

          {/* Settings View */}
          <div className={cn("h-full w-full", activeNav === "settings" ? "block" : "hidden")}>
            <SettingsView />
          </div>

          {/* About View */}
          <div className={cn("h-full w-full", activeNav === "about" ? "block" : "hidden")}>
            <AboutView
              initialUpdateInfo={updateInfo}
              onUpdateStatusChange={(info) => setUpdateInfo(info)}
            />
          </div>

          {/* Open Server Tabs */}
          {tabs.map((tab) => {
            const isTabVisible = tab.id === activeId && activeNav !== "keys" && activeNav !== "settings" && activeNav !== "about";
            return (
              <div
                key={tab.id}
                className={cn("h-full gap-2", isTabVisible ? "flex" : "hidden", tab.layout.kind === "split" ? (tab.layout.direction === "row" ? "flex-row" : "flex-col") : "flex-row")}
              >
                {tab.layout.kind === "single" ? (
                  <div className="min-w-0 min-h-0 flex-1">
                    <PaneView
                      pane={tab.layout.pane}
                      canSplit
                      canClose={false}
                      isVisible={isTabVisible}
                      onUpdate={(updater) => updatePane(tab.id, tab.layout.kind === "single" ? tab.layout.pane.id : "", updater)}
                      onSplit={(direction) => splitPane(tab.id, direction)}
                      onClose={() => {}}
                      macros={macros}
                      profiles={profiles}
                      onSaveMacro={handleSaveMacro}
                      onCloseTab={() => handleClose(tab.id)}
                      onOpenProfile={handleOpenProfile}
                      onEditProfile={(profile) => {
                        setEditingProfile(profile);
                        setShowServerModal(true);
                      }}
                      onAddNewServer={() => {
                        setEditingProfile(null);
                        setShowServerModal(true);
                      }}
                    />
                  </div>
                ) : (
                  tab.layout.panes.map((pane) => (
                    <div key={pane.id} className="min-w-0 min-h-0 flex-1">
                      <PaneView
                        pane={pane}
                        canSplit={false}
                        canClose
                        isVisible={isTabVisible}
                        onUpdate={(updater) => updatePane(tab.id, pane.id, updater)}
                        onSplit={() => {}}
                        onClose={() => closePane(tab.id, pane.id)}
                        macros={macros}
                        profiles={profiles}
                        onSaveMacro={handleSaveMacro}
                        onCloseTab={() => handleClose(tab.id)}
                        onOpenProfile={handleOpenProfile}
                        onEditProfile={(profile) => {
                          setEditingProfile(profile);
                          setShowServerModal(true);
                        }}
                        onAddNewServer={() => {
                          setEditingProfile(null);
                          setShowServerModal(true);
                        }}
                      />
                    </div>
                  ))
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Add / Edit Server Modal */}
      <ServerFormModal
        isOpen={showServerModal}
        onClose={() => setShowServerModal(false)}
        editingProfile={editingProfile}
        profiles={profiles}
        onServerSaved={async (profileId, params) => {
          await refreshProfiles();
          toast({
            title: editingProfile ? "Server Updated" : "Server Added",
            description: `Saved connection to ${params.name}`,
            status: "success",
          });
          handleOpenProfile({
            id: profileId,
            name: params.name,
            host: params.host,
            port: params.port,
            username: params.username,
            authMethod: params.authMethod,
            folder: params.folder,
            kind: "ssh",
            pinned: false,
          });
        }}
      />

      {/* Close Confirmation Prompt Modal */}
      <ClosePromptModal
        isOpen={showClosePrompt}
        onClose={() => setShowClosePrompt(false)}
        onKeepInBackground={handleKeepInBackground}
        onCloseCompletely={handleCloseCompletely}
      />
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}
