import { useId } from "react";
import { motion, MotionConfig } from "framer-motion";
import {
  Plus,
  X,
  PanelLeft,
  PanelTop,
  PanelLeftClose,
  PanelLeftOpen,
  Lock,
  Unlock,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { NativeNestedList } from "@/components/NativeNestedList";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuLabel,
} from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";

export interface TabItem {
  id: string;
  title: string;
  icon?: React.ReactNode;
  canClose?: boolean;
  isLocked?: boolean;
}

export default function TabBar({
  tabs,
  activeId,
  orientation,
  sidebarOpen,
  onToggleSidebar,
  onSelect,
  onClose,
  onNew,
  onToggleOrientation,
  onToggleLock,
  onCloseOthers,
  onCloseToRight,
}: {
  tabs: TabItem[];
  activeId: string;
  orientation: "horizontal" | "vertical";
  sidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onNew: () => void;
  onToggleOrientation: () => void;
  onToggleLock?: (id: string) => void;
  onCloseOthers?: (id: string) => void;
  onCloseToRight?: (id: string) => void;
}) {
  const pillLayoutId = useId();

  const renderContextMenu = (tab: TabItem) => {
    const isDashboard = tab.id === "dashboard";
    const tabIndex = tabs.findIndex((t) => t.id === tab.id);

    const otherClosableCount = tabs.filter(
      (t) => t.id !== tab.id && t.id !== "dashboard" && !t.isLocked
    ).length;

    const toRightClosableCount = isDashboard
      ? tabs.filter((t) => t.id !== "dashboard" && !t.isLocked).length
      : tabs.slice(tabIndex + 1).filter((t) => !t.isLocked).length;

    return (
      <ContextMenuContent ariaLabel={`Actions for ${tab.title}`} className="min-w-48">
        <ContextMenuLabel className="font-semibold text-xs text-foreground/70 px-2 py-1.5 truncate max-w-[220px]">
          {tab.title}
        </ContextMenuLabel>
        <ContextMenuSeparator />

        {!isDashboard && (
          <>
            <ContextMenuItem
              onSelect={() => onToggleLock?.(tab.id)}
              className="gap-2 cursor-pointer"
            >
              {tab.isLocked ? (
                <>
                  <Unlock className="h-4 w-4 text-amber-400" />
                  <span>Unlock Tab</span>
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4 text-muted-foreground" />
                  <span>Lock Tab</span>
                </>
              )}
            </ContextMenuItem>
            <ContextMenuSeparator />
          </>
        )}

        {!isDashboard && (
          <ContextMenuItem
            onSelect={() => onClose(tab.id)}
            disabled={tab.isLocked || tab.canClose === false}
            tone="destructive"
            className="gap-2 cursor-pointer justify-between"
          >
            <div className="flex items-center gap-2">
              <X className="h-4 w-4" />
              <span>Close Tab</span>
            </div>
            {tab.isLocked && (
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                Locked
              </span>
            )}
          </ContextMenuItem>
        )}

        <ContextMenuItem
          onSelect={() => onCloseOthers?.(tab.id)}
          disabled={otherClosableCount === 0}
          className="gap-2 cursor-pointer"
        >
          <span>Close Other Tabs</span>
        </ContextMenuItem>

        <ContextMenuItem
          onSelect={() => onCloseToRight?.(tab.id)}
          disabled={toRightClosableCount === 0}
          className="gap-2 cursor-pointer"
        >
          <span>Close Tabs to the Right</span>
        </ContextMenuItem>
      </ContextMenuContent>
    );
  };

  if (orientation === "vertical") {
    return (
      <div className="flex w-56 flex-shrink-0 flex-col gap-2 rounded-xl border border-border bg-card/60 p-2">
        <div className="flex items-center justify-between px-1">
          {onToggleSidebar && (
            <Tooltip content={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"} hotkey="Ctrl+B" side="right">
              <Button variant="ghost" size="icon" onClick={onToggleSidebar} className="h-7 w-7 text-muted-foreground hover:text-foreground">
                {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
              </Button>
            </Tooltip>
          )}
          <Tooltip content="New tab" hotkey="Ctrl+T" side="right">
            <Button variant="ghost" size="icon" onClick={onNew} className="h-7 w-7">
              <Plus className="h-4 w-4" />
            </Button>
          </Tooltip>
          <Tooltip content="Switch to horizontal tabs" side="right">
            <Button variant="ghost" size="icon" onClick={onToggleOrientation} className="h-7 w-7">
              <PanelTop className="h-4 w-4" />
            </Button>
          </Tooltip>
        </div>
        <NativeNestedList
          items={tabs.map((t) => ({
            id: t.id,
            label: t.title,
            icon: t.icon,
            actions:
              t.id === "dashboard" ? null : t.isLocked ? (
                <Tooltip content="Locked tab (click or right-click to unlock)" side="right">
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleLock?.(t.id);
                    }}
                    aria-label="Locked tab"
                    className="inline-flex rounded p-0.5 text-amber-400/90 hover:text-amber-300 cursor-pointer"
                  >
                    <Lock className="h-3.5 w-3.5" />
                  </span>
                </Tooltip>
              ) : t.canClose !== false ? (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    onClose(t.id);
                  }}
                  aria-label="Close tab"
                  className="inline-flex rounded p-0.5 opacity-50 hover:opacity-100 hover:bg-accent cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </span>
              ) : null,
            contextMenu: renderContextMenu(t),
          }))}
          activeId={activeId}
          onItemClick={(item) => onSelect(item.id)}
          showExpandIcon={false}
          size="md"
        />
      </div>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex items-center gap-1 rounded-xl border border-white/[0.04] bg-card/60 p-1.5">
        {onToggleSidebar && (
          <Tooltip content={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"} hotkey="Ctrl+B" side="bottom">
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleSidebar}
              className={cn(
                "h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground transition-colors",
                !sidebarOpen && "text-primary bg-primary/10 hover:bg-primary/20"
              )}
            >
              {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
            </Button>
          </Tooltip>
        )}
        <Tabs value={activeId} onValueChange={onSelect} className="min-w-0 flex-1">
          <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-xl bg-transparent p-0">
            {tabs.map((tab) => {
              const isActive = tab.id === activeId;
              const allowClose = tab.canClose !== false && tab.id !== "dashboard" && !tab.isLocked;
              return (
                <ContextMenu key={tab.id}>
                  <ContextMenuTrigger>
                    <TabsTrigger
                      value={tab.id}
                      className="relative z-10 flex-shrink-0 gap-2 rounded-lg px-3 py-1.5 data-[state=active]:bg-transparent data-[state=active]:shadow-none cursor-pointer"
                    >
                      {isActive && (
                        <motion.div
                          layoutId={pillLayoutId}
                          className="absolute inset-0 z-[-1] rounded-lg border border-border bg-background shadow-sm"
                          transition={{ type: "spring", duration: 0.4, bounce: 0.15 }}
                        />
                      )}
                      {tab.icon}
                      <span className="max-w-[140px] truncate">{tab.title}</span>
                      {tab.isLocked ? (
                        <Tooltip content="Locked tab (click or right-click to unlock)" side="bottom">
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleLock?.(tab.id);
                            }}
                            aria-label="Locked tab"
                            className="inline-flex items-center rounded p-0.5 text-amber-400/90 hover:text-amber-300 cursor-pointer"
                          >
                            <Lock className="h-3 w-3" />
                          </span>
                        </Tooltip>
                      ) : (
                        allowClose && (
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              onClose(tab.id);
                            }}
                            aria-label="Close tab"
                            className="inline-flex rounded p-0.5 opacity-50 hover:opacity-100 hover:bg-accent cursor-pointer"
                          >
                            <X className="h-3 w-3" />
                          </span>
                        )
                      )}
                    </TabsTrigger>
                  </ContextMenuTrigger>
                  {renderContextMenu(tab)}
                </ContextMenu>
              );
            })}
          </TabsList>
        </Tabs>
        <Tooltip content="New tab" hotkey="Ctrl+T" side="bottom">
          <Button variant="ghost" size="icon" onClick={onNew} className="h-7 w-7">
            <Plus className="h-4 w-4" />
          </Button>
        </Tooltip>
        <Tooltip content="Switch to vertical tabs" side="bottom">
          <Button variant="ghost" size="icon" onClick={onToggleOrientation} className="h-7 w-7">
            <PanelLeft className="h-4 w-4" />
          </Button>
        </Tooltip>
      </div>
    </MotionConfig>
  );
}

