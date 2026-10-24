import { useEffect, useState } from "react";
import { Key, Layers, LayoutDashboard, Pencil, Plus as PlusIcon, Server, Terminal as TerminalIcon, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import TabBar from "./TabBar";
import PaneView from "./PaneView";
import Sidebar from "./Sidebar";
import ServerDashboard from "./components/dashboard/ServerDashboard";
import KeyVaultView from "./components/keys/KeyVaultView";
import SettingsView, { applyTheme, getStoredAccent, getStoredTheme } from "./components/settings/SettingsView";
import AboutView from "./components/about/AboutView";
import { UpdatePromptModal } from "./components/about/UpdatePromptModal";
import { checkAppUpdates, type UpdateInfo } from "./lib/updater";
import ServerFormModal from "./components/servers/ServerFormModal";
import { MacroModal } from "./components/macros/MacroModal";
import { ClosePromptModal } from "@/components/ui/ClosePromptModal";
import { getStoredCloseBehavior } from "@/lib/closeSettings";
import { Loader } from "@/components/Loader";
import { ToastProvider, useToast } from "@/components/ui/animated-toast-stack";
import { cn } from "@/lib/utils";
import WorkspacesView from "./components/workspaces/WorkspacesView";
import MacrosView from "./components/macros/MacrosView";
import WorkspaceModal from "./components/workspaces/WorkspaceModal";
import MacroSidesheet from "./components/macros/MacroSidesheet";
import MacroGroupModal from "./components/macros/MacroGroupModal";
import { ErrorBoundary } from "./components/ErrorBoundary";
import type { TerminalHandle } from "./Terminal";
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
  listMacroGroups,
  saveMacroGroup,
  updateMacroGroup,
  deleteMacroGroup,
  listWorkspaces,
  saveWorkspace,
  updateWorkspace,
  deleteWorkspace,
} from "./sessions";
import type { MacroSummary, ProfileSummary, SaveMacroParams } from "./sessions";
import type { MacroGroupSummary, Pane, PaneLayout, PaneNode, ServerHubSubView, SidebarViewMode, Tab, TabContentState, WorkspaceSummary, WorkspaceTerminalDef } from "./types";
import { PaneTreeView } from "./components/panes/PaneTreeView";
import type { DropZone } from "./components/panes/PaneDropOverlay";
import {
  buildGridTree,
  collectPanes,
  countPanes,
  findPane,
  genSplitId,
  removePaneFromTree,
  resizeSplitInTree,
  splitPaneInTree,
  swapPanesInTree,
  updatePaneInTree,
} from "./utils/paneTree";

let nextId = 1;
const genId = (prefix: string) => `${prefix}-${nextId++}`;

function newPane(): Pane {
  return { id: genId("pane"), title: "New Tab", content: { kind: "connect" } };
}

function newTab(): Tab {
  return { id: genId("tab"), layout: { kind: "single", pane: newPane() } };
}

function tabTitle(tab: Tab): string {
  if (tab.layout.kind === "single") return tab.layout.pane.title;
  if (tab.layout.kind === "split") return tab.layout.panes.map((p) => p.title).join(" | ");
  const panes = collectPanes(tab.layout.root);
  return panes.map((p) => p.title).join(" | ");
}

const TAB_KIND_ICON = {
  connect: PlusIcon,
  local: TerminalIcon,
  ssh: Server,
  "macro-run": Zap,
  "macro-editor": Pencil,
} as const;

function tabIcon(tab: Tab) {
  let primaryPane: Pane;
  if (tab.layout.kind === "single") {
    primaryPane = tab.layout.pane;
  } else if (tab.layout.kind === "split") {
    primaryPane = tab.layout.panes[0];
  } else {
    primaryPane =
      collectPanes(tab.layout.root)[0] || {
        id: "",
        title: "",
        content: { kind: "connect" },
      };
  }
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
  if (layout.kind === "split") {
    return { ...layout, panes: layout.panes.map((p) => (p.id === paneId ? updater(p) : p)) as [Pane, Pane] };
  }
  return {
    ...layout,
    root: updatePaneInTree(layout.root, paneId, updater),
  };
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
  const [showUpdatePrompt, setShowUpdatePrompt] = useState(false);

  // Check for updates every time the app is opened and prompt the user if an update is available
  useEffect(() => {
    checkAppUpdates()
      .then((info) => {
        if (info.updateAvailable) {
          setUpdateInfo(info);
          setShowUpdatePrompt(true);
        }
      })
      .catch((err) => console.warn("Update check on launch failed:", err));
  }, []);

  // Server Modal
  const [showServerModal, setShowServerModal] = useState(false);
  const [editingProfile, setEditingProfile] = useState<ProfileSummary | null>(null);

  // Macro Modal
  const [showMacroModal, setShowMacroModal] = useState(false);
  const [editingMacroId, setEditingMacroId] = useState<number | null>(null);
  const [macroModalDefaultFolder, setMacroModalDefaultFolder] = useState<string | undefined>(undefined);

  // Workspace Modal
  const [showWorkspaceModal, setShowWorkspaceModal] = useState(false);
  const [editingWorkspace, setEditingWorkspace] = useState<WorkspaceSummary | null>(null);

  // Macro Group Modal
  const [showMacroGroupModal, setShowMacroGroupModal] = useState(false);
  const [editingMacroGroup, setEditingMacroGroup] = useState<MacroGroupSummary | null>(null);

  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [macroGroups, setMacroGroups] = useState<MacroGroupSummary[]>([]);

  // Macro Sidesheet state
  const [macroSidesheetOpen, setMacroSidesheetOpen] = useState(false);
  const [macroSidesheetProfileId, setMacroSidesheetProfileId] = useState<number | undefined>(undefined);
  const [macroSidesheetBoundTerminal, setMacroSidesheetBoundTerminal] = useState<React.RefObject<TerminalHandle | null> | null>(null);
  const [macroSidesheetRunningState, setMacroSidesheetRunningState] = useState<{
    isRunning: boolean;
    label?: string;
    onCancel?: () => void;
  }>({ isRunning: false });

  const refreshProfiles = () => listProfiles().then(setProfiles);
  const refreshMacros = () => listMacros().then(setMacros);
  const refreshWorkspaces = () => listWorkspaces().then(setWorkspaces);
  const refreshMacroGroups = () => listMacroGroups().then(setMacroGroups);

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
    Promise.all([refreshProfiles(), refreshMacros(), refreshWorkspaces(), refreshMacroGroups()]).then(() => setReady(true));
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

  const handleOpenProfile = (
    profile: ProfileSummary,
    initialSubView?: ServerHubSubView,
    forceNewTab: boolean = false
  ) => {
    // 1. Check if the currently active tab is an empty 'connect' launcher tab
    const activeTab = tabs.find((t) => t.id === activeId);
    if (!forceNewTab && activeTab && activeTab.layout.kind === "single" && activeTab.layout.pane.content.kind === "connect") {
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

    // 2. Count existing open tabs for this profile to format numbered tab title
    const existingCount = tabs.filter(
      (t) =>
        t.layout.kind === "single" &&
        t.layout.pane.content.kind === "ssh" &&
        t.layout.pane.content.profileId === profile.id
    ).length;

    // If not forcing a new tab, focus the existing tab if any
    if (!forceNewTab) {
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
    }

    const tabTitle = existingCount > 0 ? `${profile.name} (${existingCount + 1})` : profile.name;

    // 3. Otherwise, create a new tab and focus it
    const tab: Tab = {
      id: genId("tab"),
      layout: {
        kind: "single",
        pane: {
          id: genId("pane"),
          title: tabTitle,
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

  const handleOpenNewTabForProfile = (profile: ProfileSummary) => {
    handleOpenProfile(profile, "terminal", true);
  };

  const handleOpenMacroSidesheet = (profileId?: number, terminalRef?: React.RefObject<TerminalHandle | null>) => {
    setMacroSidesheetProfileId(profileId);
    setMacroSidesheetBoundTerminal(terminalRef || null);
    setMacroSidesheetOpen(true);
  };

  const getActiveLocalShell = (tab?: Tab): string | null => {
    if (tab && tab.layout.kind === "single" && tab.layout.pane.content.kind === "local") {
      return tab.layout.pane.content.shell || "powershell";
    }
    return null;
  };

  const handleRunSingleMacro = async (macro: MacroSummary, target?: string) => {
    const steps = await getMacroSteps(macro.id);
    if (steps.length === 0) return;

    const activeTab = tabs.find((t) => t.id === activeId);
    const activeLocalShell = getActiveLocalShell(activeTab);
    const isActiveTabLocal = activeLocalShell !== null;

    // 0. Explicit New Tab request or Macro configured for New Tab:
    if (target === "new_tab" || (!target && macro.shell === "new_tab")) {
      setMacroSidesheetOpen(false);
      await handleRunMacro(macro.id);
      return;
    }

    // 1. Explicit local shell target from sidesheet:
    if (target && target.startsWith("local:")) {
      const shell = target.replace("local:", "");
      const isMatchingLocalActive = activeLocalShell === shell;

      if (isMatchingLocalActive && macroSidesheetBoundTerminal?.current) {
        setMacroSidesheetRunningState({
          isRunning: true,
          label: `Running "${macro.name}" (Local ${shell})...`,
          onCancel: () => macroSidesheetBoundTerminal.current?.abortMacro(),
        });
        try {
          await macroSidesheetBoundTerminal.current.runMacro(steps, macro.haltOnError);
        } finally {
          setMacroSidesheetRunningState({ isRunning: false });
        }
        return;
      }

      setMacroSidesheetOpen(false);
      await handleRunMacro(macro.id, { shell });
      return;
    }

    // 2. Explicit SSH server target from sidesheet:
    if (target && target.startsWith("ssh:")) {
      const profId = Number(target.replace("ssh:", ""));
      const isTargetingBoundServer = macroSidesheetProfileId && profId === macroSidesheetProfileId;

      if (isTargetingBoundServer && macroSidesheetBoundTerminal?.current) {
        setMacroSidesheetRunningState({
          isRunning: true,
          label: `Running "${macro.name}"...`,
          onCancel: () => macroSidesheetBoundTerminal.current?.abortMacro(),
        });
        try {
          await macroSidesheetBoundTerminal.current.runMacro(steps, macro.haltOnError);
        } finally {
          setMacroSidesheetRunningState({ isRunning: false });
        }
        return;
      }

      setMacroSidesheetOpen(false);
      await handleRunMacro(macro.id, { profileId: profId });
      return;
    }

    // 3. Target is "" (Active Terminal Session):
    // If macro is configured for a specific server:
    if (macro.profileId != null) {
      const isTargetingBoundServer =
        macroSidesheetProfileId && macro.profileId === macroSidesheetProfileId;
      if (isTargetingBoundServer && macroSidesheetBoundTerminal?.current) {
        setMacroSidesheetRunningState({
          isRunning: true,
          label: `Running "${macro.name}"...`,
          onCancel: () => macroSidesheetBoundTerminal.current?.abortMacro(),
        });
        try {
          await macroSidesheetBoundTerminal.current.runMacro(steps, macro.haltOnError);
        } finally {
          setMacroSidesheetRunningState({ isRunning: false });
        }
        return;
      }
      setMacroSidesheetOpen(false);
      await handleRunMacro(macro.id, { profileId: macro.profileId });
      return;
    }

    // If macro is configured for Local Machine:
    const isLocalMacro =
      macro.shell === "powershell" || macro.shell === "cmd" || macro.shell === "wsl";
    if (isLocalMacro) {
      // If currently active tab is already a local terminal and bound, run in it!
      if (isActiveTabLocal && macroSidesheetBoundTerminal?.current) {
        setMacroSidesheetRunningState({
          isRunning: true,
          label: `Running "${macro.name}" (Local)...`,
          onCancel: () => macroSidesheetBoundTerminal.current?.abortMacro(),
        });
        try {
          await macroSidesheetBoundTerminal.current.runMacro(steps, macro.haltOnError);
        } finally {
          setMacroSidesheetRunningState({ isRunning: false });
        }
        return;
      }

      // If active tab is SSH or not a local tab, DO NOT run inside SSH server! Open local terminal!
      setMacroSidesheetOpen(false);
      await handleRunMacro(macro.id, { shell: macro.shell });
      return;
    }

    // Generic macro (Active Tab):
    if (macroSidesheetBoundTerminal?.current) {
      setMacroSidesheetRunningState({
        isRunning: true,
        label: `Running "${macro.name}"...`,
        onCancel: () => macroSidesheetBoundTerminal.current?.abortMacro(),
      });
      try {
        await macroSidesheetBoundTerminal.current.runMacro(steps, macro.haltOnError);
      } finally {
        setMacroSidesheetRunningState({ isRunning: false });
      }
    } else {
      setMacroSidesheetOpen(false);
      await handleRunMacro(macro.id);
    }
  };

  const handleRunGroupMacro = async (group: MacroGroupSummary, target?: string) => {
    if (group.macroIds.length === 0) return;
    const childMacros = group.macroIds
      .map((id) => macros.find((m) => m.id === id))
      .filter((m): m is MacroSummary => m != null);

    const activeTab = tabs.find((t) => t.id === activeId);
    const isActiveTabLocal = getActiveLocalShell(activeTab) !== null;

    const isExplicitLocal = target && target.startsWith("local:");
    const isExplicitSsh = target && target.startsWith("ssh:");

    const canRunInBound =
      target !== "new_tab" &&
      macroSidesheetBoundTerminal?.current &&
      (!target ||
        (isExplicitLocal && isActiveTabLocal) ||
        (isExplicitSsh &&
          macroSidesheetProfileId &&
          Number(target.replace("ssh:", "")) === macroSidesheetProfileId));

    if (canRunInBound && macroSidesheetBoundTerminal?.current) {
      let cancelled = false;
      for (let i = 0; i < childMacros.length; i++) {
        if (cancelled) break;
        const m = childMacros[i];
        const steps = await getMacroSteps(m.id);
        setMacroSidesheetRunningState({
          isRunning: true,
          label: `[${group.name}] Macro ${i + 1}/${childMacros.length}: ${m.name}`,
          onCancel: () => {
            cancelled = true;
            macroSidesheetBoundTerminal.current?.abortMacro();
          },
        });
        const success = await macroSidesheetBoundTerminal.current.runMacro(steps, group.haltOnError);
        if (!success && group.haltOnError) break;
      }
      setMacroSidesheetRunningState({ isRunning: false });
    } else {
      const allSteps: string[] = [];
      for (const m of childMacros) {
        const s = await getMacroSteps(m.id);
        allSteps.push(...s);
      }
      setMacroSidesheetOpen(false);

      if (isExplicitLocal) {
        const shell = target.replace("local:", "");
        const tab: Tab = {
          id: genId("tab"),
          layout: {
            kind: "single",
            pane: {
              id: genId("pane"),
              title: `Local (${shell}): ${group.name}`,
              content: {
                kind: "local",
                shell,
                initialCommands: allSteps,
              },
            },
          },
        };
        setTabs((prev) => [...prev, tab]);
        setActiveId(tab.id);
        setActiveNav("servers");
        return;
      }

      const targetProfId = isExplicitSsh
        ? Number(target.replace("ssh:", ""))
        : undefined;
      const prof = targetProfId ? profiles.find((p) => p.id === targetProfId) : undefined;
      const tab: Tab = {
        id: genId("tab"),
        layout: {
          kind: "single",
          pane: {
            id: genId("pane"),
            title: prof ? `${prof.name}: ${group.name}` : group.name,
            content: prof
              ? {
                  kind: "ssh",
                  session: profileSession(prof),
                  profileId: prof.id,
                  initialSubView: "terminal",
                  profileName: prof.name,
                  host: prof.host,
                  initialCommands: allSteps,
                }
              : {
                  kind: "local",
                  initialCommands: allSteps,
                },
          },
        },
      };
      setTabs((prev) => [...prev, tab]);
      setActiveId(tab.id);
      setActiveNav("servers");
    }
  };

  const handleRunCustomQueue = async (queueMacroIds: number[], target?: string) => {
    const queueMacros = queueMacroIds
      .map((id) => macros.find((m) => m.id === id))
      .filter((m): m is MacroSummary => m != null);
    if (queueMacros.length === 0) return;

    const activeTab = tabs.find((t) => t.id === activeId);
    const isActiveTabLocal = getActiveLocalShell(activeTab) !== null;

    const isExplicitLocal = target && target.startsWith("local:");
    const isExplicitSsh = target && target.startsWith("ssh:");

    const canRunInBound =
      target !== "new_tab" &&
      macroSidesheetBoundTerminal?.current &&
      (!target ||
        (isExplicitLocal && isActiveTabLocal) ||
        (isExplicitSsh &&
          macroSidesheetProfileId &&
          Number(target.replace("ssh:", "")) === macroSidesheetProfileId));

    if (canRunInBound && macroSidesheetBoundTerminal?.current) {
      let cancelled = false;
      for (let i = 0; i < queueMacros.length; i++) {
        if (cancelled) break;
        const m = queueMacros[i];
        const steps = await getMacroSteps(m.id);
        setMacroSidesheetRunningState({
          isRunning: true,
          label: `Queue ${i + 1}/${queueMacros.length}: ${m.name}`,
          onCancel: () => {
            cancelled = true;
            macroSidesheetBoundTerminal.current?.abortMacro();
          },
        });
        const success = await macroSidesheetBoundTerminal.current.runMacro(steps, m.haltOnError);
        if (!success && m.haltOnError) break;
      }
      setMacroSidesheetRunningState({ isRunning: false });
    } else {
      const allSteps: string[] = [];
      for (const m of queueMacros) {
        const s = await getMacroSteps(m.id);
        allSteps.push(...s);
      }
      setMacroSidesheetOpen(false);

      if (isExplicitLocal) {
        const shell = target.replace("local:", "");
        const tab: Tab = {
          id: genId("tab"),
          layout: {
            kind: "single",
            pane: {
              id: genId("pane"),
              title: `Local (${shell}): Custom Queue`,
              content: {
                kind: "local",
                shell,
                initialCommands: allSteps,
              },
            },
          },
        };
        setTabs((prev) => [...prev, tab]);
        setActiveId(tab.id);
        setActiveNav("servers");
        return;
      }

      const targetProfId = isExplicitSsh
        ? Number(target.replace("ssh:", ""))
        : undefined;
      const prof = targetProfId ? profiles.find((p) => p.id === targetProfId) : undefined;
      const tab: Tab = {
        id: genId("tab"),
        layout: {
          kind: "single",
          pane: {
            id: genId("pane"),
            title: prof ? `${prof.name}: Custom Queue` : "Custom Queue",
            content: prof
              ? {
                  kind: "ssh",
                  session: profileSession(prof),
                  profileId: prof.id,
                  initialSubView: "terminal",
                  profileName: prof.name,
                  host: prof.host,
                  initialCommands: allSteps,
                }
              : {
                  kind: "local",
                  initialCommands: allSteps,
                },
          },
        },
      };
      setTabs((prev) => [...prev, tab]);
      setActiveId(tab.id);
      setActiveNav("servers");
    }
  };

  const handleSaveGroup = async (name: string, folder?: string, macroIds?: number[]) => {
    if (!name.trim() || !macroIds || macroIds.length === 0) return;
    await saveMacroGroup({
      name: name.trim(),
      folder: folder?.trim() || undefined,
      haltOnError: true,
      macroIds,
    });
    await refreshMacroGroups();
    toast({
      title: "Group Macro Saved",
      description: `Saved "${name}" with ${macroIds.length} macros.`,
      status: "success",
    });
  };

  const handleDeleteGroup = async (id: number) => {
    await deleteMacroGroup(id);
    await refreshMacroGroups();
    toast({
      title: "Group Deleted",
      description: "Group macro removed.",
      status: "info",
    });
  };

  const handleSaveMacroGroupModal = async (params: {
    id?: number;
    name: string;
    folder?: string;
    haltOnError: boolean;
    macroIds: number[];
  }) => {
    if (params.id) {
      await updateMacroGroup({
        id: params.id,
        name: params.name,
        folder: params.folder,
        haltOnError: params.haltOnError,
        macroIds: params.macroIds,
      });
      toast({
        title: "Group Updated",
        description: `Updated group "${params.name}".`,
        status: "success",
      });
    } else {
      await saveMacroGroup({
        name: params.name,
        folder: params.folder,
        haltOnError: params.haltOnError,
        macroIds: params.macroIds,
      });
      toast({
        title: "Group Created",
        description: `Created group "${params.name}".`,
        status: "success",
      });
    }
    await refreshMacroGroups();
  };

  const handleSaveWorkspace = async (params: {
    id?: number;
    name: string;
    folder?: string;
    layoutMode: "tabs" | "split";
    terminals: WorkspaceTerminalDef[];
  }) => {
    if (params.id) {
      await updateWorkspace({
        id: params.id,
        name: params.name,
        folder: params.folder,
        layoutMode: params.layoutMode,
        terminals: params.terminals,
      });
      toast({
        title: "Workspace Updated",
        description: `Updated workspace "${params.name}".`,
        status: "success",
      });
    } else {
      await saveWorkspace({
        name: params.name,
        folder: params.folder,
        layoutMode: params.layoutMode,
        terminals: params.terminals,
      });
      toast({
        title: "Workspace Created",
        description: `Created workspace "${params.name}".`,
        status: "success",
      });
    }
    await refreshWorkspaces();
  };

  const handleDeleteWorkspace = async (id: number) => {
    await deleteWorkspace(id);
    await refreshWorkspaces();
    toast({
      title: "Workspace Deleted",
      description: "Workspace removed.",
      status: "info",
    });
  };

  const handleNewWorkspace = () => {
    setEditingWorkspace(null);
    setShowWorkspaceModal(true);
  };

  const handleEditWorkspace = (ws: WorkspaceSummary) => {
    setEditingWorkspace(ws);
    setShowWorkspaceModal(true);
  };

  const handleLaunchWorkspace = (ws: WorkspaceSummary) => {
    if (ws.terminals.length === 0) return;

    const parseStartupCommands = (cmd?: string): string[] | undefined => {
      if (!cmd) return undefined;
      const lines = cmd.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
      return lines.length > 0 ? lines : undefined;
    };

    if (ws.layoutMode === "split" && ws.terminals.length >= 2) {
      const gridTerminals = ws.terminals.slice(0, 6);
      const overflowTerminals = ws.terminals.slice(6);

      const gridPanes: Pane[] = gridTerminals.map((t) => {
        const prof = t.targetKind === "ssh" && t.profileId ? profiles.find((p) => p.id === t.profileId) : undefined;
        const content: TabContentState = prof
          ? {
              kind: "ssh",
              session: profileSession(prof),
              profileId: prof.id,
              initialSubView: "terminal",
              profileName: prof.name,
              host: prof.host,
              initialCommands: parseStartupCommands(t.startupCommand),
            }
          : {
              kind: "local",
              shell: t.shell,
              cwd: t.cwd,
              initialCommands: parseStartupCommands(t.startupCommand),
            };
        return {
          id: genId("pane"),
          title: t.title || (prof ? prof.name : "Terminal"),
          content,
        };
      });

      const rootNode = buildGridTree(gridPanes, ws.gridPreset || "auto");
      const tab: Tab = {
        id: genId("tab"),
        layout: {
          kind: "tree",
          root: rootNode,
        },
        activePaneId: gridPanes[0]?.id,
      };

      const overflowTabs: Tab[] = overflowTerminals.map((t) => {
        const prof = t.targetKind === "ssh" && t.profileId ? profiles.find((p) => p.id === t.profileId) : undefined;
        return {
          id: genId("tab"),
          layout: {
            kind: "single",
            pane: {
              id: genId("pane"),
              title: t.title || (prof ? prof.name : "Terminal"),
              content: prof
                ? {
                    kind: "ssh",
                    session: profileSession(prof),
                    profileId: prof.id,
                    initialSubView: "terminal",
                    profileName: prof.name,
                    host: prof.host,
                    initialCommands: parseStartupCommands(t.startupCommand),
                  }
                : {
                    kind: "local",
                    shell: t.shell,
                    cwd: t.cwd,
                    initialCommands: parseStartupCommands(t.startupCommand),
                  },
            },
          },
        };
      });

      setTabs((prev) => [...prev, tab, ...overflowTabs]);
      setActiveId(tab.id);
      setActiveNav("servers");
      toast({
        title: "Workspace Launched",
        description: `Launched ${ws.name} with ${gridPanes.length} terminals in grid layout${
          overflowTabs.length > 0 ? ` (+${overflowTabs.length} overflow tabs)` : ""
        }.`,
        status: "success",
      });
    } else {
      const newTabs: Tab[] = ws.terminals.map((t) => {
        const prof = t.targetKind === "ssh" && t.profileId ? profiles.find((p) => p.id === t.profileId) : undefined;
        return {
          id: genId("tab"),
          layout: {
            kind: "single",
            pane: {
              id: genId("pane"),
              title: t.title,
              content: prof
                ? {
                    kind: "ssh",
                    session: profileSession(prof),
                    profileId: prof.id,
                    initialSubView: "terminal",
                    profileName: prof.name,
                    host: prof.host,
                    initialCommands: parseStartupCommands(t.startupCommand),
                  }
                : {
                    kind: "local",
                    shell: t.shell,
                    cwd: t.cwd,
                    initialCommands: parseStartupCommands(t.startupCommand),
                  },
            },
          },
        };
      });

      setTabs((prev) => [...prev, ...newTabs]);
      if (newTabs.length > 0) {
        setActiveId(newTabs[0].id);
      }
      setActiveNav("servers");
      toast({
        title: "Workspace Launched",
        description: `Launched ${ws.name} (${ws.terminals.length} tabs).`,
        status: "success",
      });
    }
  };

  const handleNewMacroTab = (defaultFolder?: string) => {
    setEditingMacroId(null);
    setMacroModalDefaultFolder(defaultFolder);
    setShowMacroModal(true);
  };

  const handleEditMacroTab = (macroId: number) => {
    setEditingMacroId(macroId);
    setShowMacroModal(true);
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
      const shell =
        shellOverride ||
        (macro.shell && macro.shell !== "active" && macro.shell !== "new_tab" ? macro.shell : undefined) ||
        "powershell";
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

  const splitPane = (tabId: string, direction: "row" | "column", targetPaneId?: string) => {
    updateTab(tabId, (t) => {
      const np = newPane();
      if (t.layout.kind === "single") {
        const root: PaneNode = {
          kind: "split",
          id: genSplitId(),
          direction,
          sizes: [50, 50],
          children: [
            { kind: "leaf", pane: t.layout.pane },
            { kind: "leaf", pane: np },
          ],
        };
        return { ...t, layout: { kind: "tree", root }, activePaneId: np.id };
      }
      if (t.layout.kind === "split") {
        const root: PaneNode = {
          kind: "split",
          id: genSplitId(),
          direction: t.layout.direction,
          sizes: [50, 50],
          children: [
            { kind: "leaf", pane: t.layout.panes[0] },
            { kind: "leaf", pane: t.layout.panes[1] },
          ],
        };
        const updatedRoot = splitPaneInTree(
          root,
          targetPaneId || t.activePaneId || t.layout.panes[0].id,
          np,
          direction
        );
        return { ...t, layout: { kind: "tree", root: updatedRoot }, activePaneId: np.id };
      }
      if (t.layout.kind === "tree") {
        if (countPanes(t.layout.root) >= 6) {
          toast({
            title: "Maximum Panes Reached",
            description: "A single tab supports up to 6 terminal panes.",
          });
          return t;
        }
        const targetId = targetPaneId || t.activePaneId || collectPanes(t.layout.root)[0]?.id;
        const updatedRoot = splitPaneInTree(t.layout.root, targetId, np, direction);
        return { ...t, layout: { kind: "tree", root: updatedRoot }, activePaneId: np.id };
      }
      return t;
    });
  };

  const closePane = (tabId: string, paneId: string) => {
    updateTab(tabId, (t) => {
      if (t.layout.kind === "single") {
        return t;
      }
      if (t.layout.kind === "split") {
        const remaining = t.layout.panes.find((p) => p.id !== paneId);
        return remaining ? { ...t, layout: { kind: "single", pane: remaining } } : t;
      }
      if (t.layout.kind === "tree") {
        const nextRoot = removePaneFromTree(t.layout.root, paneId);
        if (!nextRoot) {
          handleClose(tabId);
          return t;
        }
        const remainingPanes = collectPanes(nextRoot);
        const nextActiveId =
          t.activePaneId === paneId ? remainingPanes[0]?.id : t.activePaneId;
        const nextMaximizedId =
          t.maximizedPaneId === paneId ? undefined : t.maximizedPaneId;
        return {
          ...t,
          layout: { kind: "tree", root: nextRoot },
          activePaneId: nextActiveId,
          maximizedPaneId: nextMaximizedId,
        };
      }
      return t;
    });
  };

  const resizeSplit = (tabId: string, splitId: string, sizes: [number, number]) => {
    updateTab(tabId, (t) => {
      if (t.layout.kind !== "tree") return t;
      return {
        ...t,
        layout: {
          kind: "tree",
          root: resizeSplitInTree(t.layout.root, splitId, sizes),
        },
      };
    });
  };

  const handleDropZone = (
    tabId: string,
    sourcePaneId: string,
    targetPaneId: string,
    zone: DropZone
  ) => {
    updateTab(tabId, (t) => {
      if (t.layout.kind !== "tree") return t;
      if (zone === "center") {
        return {
          ...t,
          layout: {
            kind: "tree",
            root: swapPanesInTree(t.layout.root, sourcePaneId, targetPaneId),
          },
        };
      }
      const sourcePane = findPane(t.layout.root, sourcePaneId);
      if (!sourcePane) return t;

      const rootWithoutSource = removePaneFromTree(t.layout.root, sourcePaneId);
      if (!rootWithoutSource) return t;

      const direction: "row" | "column" =
        zone === "left" || zone === "right" ? "row" : "column";
      const position: "before" | "after" =
        zone === "left" || zone === "top" ? "before" : "after";

      const newRoot = splitPaneInTree(
        rootWithoutSource,
        targetPaneId,
        sourcePane,
        direction,
        position
      );
      return {
        ...t,
        layout: { kind: "tree", root: newRoot },
        activePaneId: sourcePaneId,
      };
    });
  };

  const toggleMaximizePane = (tabId: string, paneId?: string) => {
    updateTab(tabId, (t) => {
      const targetId = paneId || t.activePaneId;
      if (!targetId) return t;
      return {
        ...t,
        maximizedPaneId: t.maximizedPaneId === targetId ? undefined : targetId,
      };
    });
  };

  const handleExtractPaneToNewTab = (tabId: string, paneId: string) => {
    const targetTab = tabs.find((t) => t.id === tabId);
    if (!targetTab) return;

    let extractedPane: Pane | null = null;
    let newTabRoot: PaneNode | null = null;

    if (targetTab.layout.kind === "tree") {
      extractedPane = findPane(targetTab.layout.root, paneId);
      if (!extractedPane) return;
      newTabRoot = removePaneFromTree(targetTab.layout.root, paneId);
    } else if (targetTab.layout.kind === "split") {
      extractedPane = targetTab.layout.panes.find((p) => p.id === paneId) || null;
      if (!extractedPane) return;
    }

    if (!extractedPane) return;

    const newTabId = genId("tab");
    const newTab: Tab = {
      id: newTabId,
      layout: {
        kind: "single",
        pane: extractedPane,
      },
    };

    setTabs((prev) => {
      const updated: Tab[] = prev.map((t) => {
        if (t.id === tabId) {
          if (t.layout.kind === "tree" && newTabRoot) {
            const remainingCount = countPanes(newTabRoot);
            if (remainingCount === 1) {
              const onlyPane = collectPanes(newTabRoot)[0];
              return {
                ...t,
                layout: { kind: "single" as const, pane: onlyPane },
                activePaneId: onlyPane.id,
              };
            }
            return {
              ...t,
              layout: { kind: "tree" as const, root: newTabRoot },
              activePaneId: t.activePaneId === paneId ? collectPanes(newTabRoot)[0]?.id : t.activePaneId,
            };
          } else if (t.layout.kind === "split") {
            const remainingPanes = t.layout.panes.filter((p) => p.id !== paneId);
            if (remainingPanes.length <= 1) {
              return {
                ...t,
                layout: { kind: "single" as const, pane: remainingPanes[0] },
                activePaneId: remainingPanes[0]?.id,
              };
            }
            return {
              ...t,
              layout: {
                kind: "split" as const,
                direction: t.layout.direction,
                panes: [remainingPanes[0], remainingPanes[1]] as [Pane, Pane],
              },
            };
          }
        }
        return t;
      });

      return [...updated, newTab];
    });

    setActiveId(newTabId);
    toast({
      title: "Extracted to New Tab",
      description: `Opened ${extractedPane.title} in a dedicated tab.`,
      status: "success",
    });
  };

  // Keyboard navigation and zoom toggle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTab = tabs.find((t) => t.id === activeId);
      if (!activeTab || activeTab.layout.kind !== "tree") return;

      // Alt + Z: Toggle zoom
      if (e.altKey && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        toggleMaximizePane(activeTab.id, activeTab.activePaneId);
        return;
      }

      // Alt + Arrows: Navigate focus
      if (e.altKey && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
        e.preventDefault();
        const panes = collectPanes(activeTab.layout.root);
        if (panes.length <= 1) return;
        const currentIdx = panes.findIndex((p) => p.id === activeTab.activePaneId);
        let nextIdx = currentIdx;
        if (e.key === "ArrowRight" || e.key === "ArrowDown") {
          nextIdx = (currentIdx + 1) % panes.length;
        } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
          nextIdx = (currentIdx - 1 + panes.length) % panes.length;
        }
        if (panes[nextIdx]) {
          updateTab(activeTab.id, (t) => ({ ...t, activePaneId: panes[nextIdx].id }));
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [tabs, activeId]);

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
      title:
        activeNav === "servers"
          ? "Servers"
          : activeNav === "workspaces"
          ? "Workspaces"
          : activeNav === "keys"
          ? "Key Vault"
          : "Dashboard",
      icon:
        activeNav === "servers" ? (
          <Server className="h-3.5 w-3.5 text-primary" />
        ) : activeNav === "workspaces" ? (
          <Layers className="h-3.5 w-3.5 text-primary" />
        ) : activeNav === "keys" ? (
          <Key className="h-3.5 w-3.5 text-amber-400" />
        ) : (
          <LayoutDashboard className="h-3.5 w-3.5 text-primary" />
        ),
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
        if (
          nav === "dashboard" ||
          nav === "servers" ||
          nav === "settings" ||
          nav === "keys" ||
          nav === "about" ||
          nav === "workspaces" ||
          nav === "macros"
        ) {
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
      macroGroups={macroGroups}
      onRunGroupMacro={handleRunGroupMacro}
      onEditGroup={(group) => {
        setEditingMacroGroup(group);
        setShowMacroGroupModal(true);
      }}
      onDeleteGroup={handleDeleteGroup}
      onNewGroupMacro={() => {
        setEditingMacroGroup(null);
        setShowMacroGroupModal(true);
      }}
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
        refreshWorkspaces();
        refreshMacroGroups();
      }}
      workspaceCount={workspaces.length}
      onOpenNewTab={handleOpenNewTabForProfile}
      onOpenMacroSidesheet={handleOpenMacroSidesheet}
      onNewWorkspace={handleNewWorkspace}
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
          <div className={cn("h-full w-full", activeId === "dashboard" && activeNav === "dashboard" ? "block" : "hidden")}>
            <ServerDashboard
              viewMode="dashboard"
              profiles={profiles}
              macros={macros}
              workspaces={workspaces}
              onLaunchWorkspace={handleLaunchWorkspace}
              onNewWorkspace={handleNewWorkspace}
              onEditWorkspace={handleEditWorkspace}
              onOpenWorkspacesTab={() => {
                setActiveNav("workspaces");
                setActiveId("dashboard");
              }}
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
            />
          </div>

          {/* Servers View */}
          <div className={cn("h-full w-full", activeId === "dashboard" && activeNav === "servers" ? "block" : "hidden")}>
            <ServerDashboard
              viewMode="servers"
              profiles={profiles}
              macros={macros}
              workspaces={[]}
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

          {/* Workspaces View */}
          <div className={cn("h-full w-full", activeNav === "workspaces" ? "block" : "hidden")}>
            <WorkspacesView
              workspaces={workspaces}
              profiles={profiles}
              onLaunchWorkspace={handleLaunchWorkspace}
              onSaveWorkspace={handleSaveWorkspace}
              onDeleteWorkspace={handleDeleteWorkspace}
              onNewWorkspace={handleNewWorkspace}
              onEditWorkspace={handleEditWorkspace}
            />
          </div>

          {/* Macros View */}
          <div className={cn("h-full w-full", activeNav === "macros" ? "block" : "hidden")}>
            <MacrosView
              macros={macros}
              macroGroups={macroGroups}
              profiles={profiles}
              onRunMacro={handleRunMacro}
              onNewMacro={() => {
                setEditingMacroId(null);
                setMacroModalDefaultFolder(undefined);
                setShowMacroModal(true);
              }}
              onEditMacro={(id) => {
                setEditingMacroId(id);
                setShowMacroModal(true);
              }}
              onDeleteMacro={handleDeleteMacro}
              onRunGroup={handleRunGroupMacro}
              onNewGroup={() => {
                setEditingMacroGroup(null);
                setShowMacroGroupModal(true);
              }}
              onEditGroup={(group) => {
                setEditingMacroGroup(group);
                setShowMacroGroupModal(true);
              }}
              onDeleteGroup={handleDeleteGroup}
            />
          </div>

          {/* Open Server Tabs */}
          {tabs.map((tab) => {
            const isTabVisible = tab.id === activeId && activeId !== "dashboard";
            return (
              <ErrorBoundary key={tab.id} fallbackTitle={`Tab Error (${tab.id})`}>
                <div
                  className={cn("h-full gap-2", isTabVisible ? "flex" : "hidden", tab.layout.kind === "split" ? (tab.layout.direction === "row" ? "flex-row" : "flex-col") : "flex-row")}
                >
                {tab.layout.kind === "tree" ? (
                  <PaneTreeView
                    root={tab.layout.root}
                    tabId={tab.id}
                    activePaneId={tab.activePaneId}
                    maximizedPaneId={tab.maximizedPaneId}
                    isVisible={isTabVisible}
                    onFocusPane={(paneId) => {
                      updateTab(tab.id, (t) => ({ ...t, activePaneId: paneId }));
                    }}
                    onUpdatePane={(paneId, updater) => updatePane(tab.id, paneId, updater)}
                    onSplitPane={(paneId, direction) => splitPane(tab.id, direction, paneId)}
                    onClosePane={(paneId) => closePane(tab.id, paneId)}
                    onResizeSplit={(splitId, sizes) => resizeSplit(tab.id, splitId, sizes)}
                    onDropZone={(sourceId, targetId, zone) =>
                      handleDropZone(tab.id, sourceId, targetId, zone)
                    }
                    onToggleMaximize={(paneId) => toggleMaximizePane(tab.id, paneId)}
                    onExtractToNewTab={(paneId) => handleExtractPaneToNewTab(tab.id, paneId)}
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
                    onOpenMacroSidesheet={handleOpenMacroSidesheet}
                  />
                ) : tab.layout.kind === "single" ? (() => {
                  const singlePane = tab.layout.pane;
                  return (
                    <div className="min-w-0 min-h-0 flex-1">
                      <PaneView
                        pane={singlePane}
                        canSplit
                        canClose={false}
                        isVisible={isTabVisible}
                        onUpdate={(updater) => updatePane(tab.id, singlePane.id, updater)}
                        onSplit={(direction) => splitPane(tab.id, direction, singlePane.id)}
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
                        onOpenMacroSidesheet={handleOpenMacroSidesheet}
                      />
                    </div>
                  );
                })() : (
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
                        onOpenMacroSidesheet={handleOpenMacroSidesheet}
                      />
                    </div>
                  ))
                )}
                </div>
              </ErrorBoundary>
            );
          })}
        </div>
      </div>

      {/* Macro Sidesheet Drawer */}
      <MacroSidesheet
        isOpen={macroSidesheetOpen}
        onClose={() => setMacroSidesheetOpen(false)}
        macros={macros}
        macroGroups={macroGroups}
        profiles={profiles}
        activeProfileId={macroSidesheetProfileId}
        isBoundToTerminal={Boolean(macroSidesheetBoundTerminal)}
        onRunSingleMacro={handleRunSingleMacro}
        onRunGroupMacro={handleRunGroupMacro}
        onRunCustomQueue={handleRunCustomQueue}
        onEditMacro={handleEditMacroTab}
        onDeleteMacro={handleDeleteMacro}
        onSaveGroup={handleSaveGroup}
        onEditGroup={(group) => {
          setEditingMacroGroup(group);
          setShowMacroGroupModal(true);
        }}
        onDeleteGroup={handleDeleteGroup}
        onNewMacro={handleNewMacroTab}
        onNewGroupMacro={() => {
          setEditingMacroGroup(null);
          setShowMacroGroupModal(true);
        }}
        runningState={macroSidesheetRunningState}
      />

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

      {/* Add / Edit Macro Modal */}
      <MacroModal
        isOpen={showMacroModal}
        onClose={() => setShowMacroModal(false)}
        editingMacroId={editingMacroId}
        defaultFolder={macroModalDefaultFolder}
        profiles={profiles}
        macros={macros}
        onSaveMacro={handleSaveMacro}
      />

      {/* Add / Edit Macro Group Modal */}
      <MacroGroupModal
        isOpen={showMacroGroupModal}
        onClose={() => setShowMacroGroupModal(false)}
        onSave={async (params) => {
          await handleSaveMacroGroupModal(params);
          setShowMacroGroupModal(false);
        }}
        editingGroup={editingMacroGroup}
        macros={macros}
        profiles={profiles}
        macroGroups={macroGroups}
      />

      {/* Add / Edit Workspace Modal */}
      <WorkspaceModal
        isOpen={showWorkspaceModal}
        onClose={() => setShowWorkspaceModal(false)}
        onSave={async (params) => {
          await handleSaveWorkspace(params);
          setShowWorkspaceModal(false);
        }}
        editingWorkspace={editingWorkspace}
        profiles={profiles}
        macros={macros}
      />

      {/* Close Confirmation Prompt Modal */}
      <ClosePromptModal
        isOpen={showClosePrompt}
        onClose={() => setShowClosePrompt(false)}
        onKeepInBackground={handleKeepInBackground}
        onCloseCompletely={handleCloseCompletely}
      />

      {/* Update Available Prompt Modal */}
      <UpdatePromptModal
        isOpen={showUpdatePrompt}
        onClose={() => setShowUpdatePrompt(false)}
        updateInfo={updateInfo}
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
