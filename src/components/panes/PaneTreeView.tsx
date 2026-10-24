import React, { useRef, useState, useCallback, useMemo, useEffect } from "react";
import { Pane, PaneNode } from "@/types";
import { collectPanes, countPanes, collectLayout } from "@/utils/paneTree";
import { SplitDivider } from "./SplitDivider";
import { PaneDropOverlay, DropZone } from "./PaneDropOverlay";
import PaneView from "@/PaneView";
import { TerminalHandle } from "@/Terminal";
import { MacroSummary, ProfileSummary, SaveMacroParams } from "@/sessions";
import { ExternalLink, GripVertical, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PaneTreeViewProps {
  root: PaneNode;
  tabId: string;
  activePaneId?: string;
  maximizedPaneId?: string;
  isVisible: boolean;
  onFocusPane: (paneId: string) => void;
  onUpdatePane: (paneId: string, updater: (p: Pane) => Pane) => void;
  onSplitPane: (paneId: string, direction: "row" | "column") => void;
  onClosePane: (paneId: string) => void;
  onResizeSplit: (splitId: string, sizes: [number, number]) => void;
  onDropZone: (sourcePaneId: string, targetPaneId: string, zone: DropZone) => void;
  onToggleMaximize: (paneId: string) => void;
  onExtractToNewTab?: (paneId: string) => void;
  macros: MacroSummary[];
  profiles: ProfileSummary[];
  onSaveMacro: (params: SaveMacroParams, macroId?: number) => void;
  onCloseTab: () => void;
  onOpenProfile?: (profile: ProfileSummary) => void;
  onEditProfile?: (profile: ProfileSummary) => void;
  onAddNewServer?: () => void;
  onOpenMacroSidesheet?: (profileId?: number, terminalRef?: React.RefObject<TerminalHandle | null>) => void;
}

interface DragState {
  sourcePaneId: string;
  sourceTitle: string;
  currentX: number;
  currentY: number;
}

interface HoverTarget {
  targetId: string;
  targetTitle: string;
  zone: DropZone;
}

export const PaneTreeView: React.FC<PaneTreeViewProps> = ({
  root,
  activePaneId,
  maximizedPaneId,
  isVisible,
  onFocusPane,
  onUpdatePane,
  onSplitPane,
  onClosePane,
  onResizeSplit,
  onDropZone,
  onToggleMaximize,
  onExtractToNewTab,
  macros,
  profiles,
  onSaveMacro,
  onCloseTab,
  onOpenProfile,
  onEditProfile,
  onAddNewServer,
  onOpenMacroSidesheet,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const totalPanes = useMemo(() => countPanes(root), [root]);
  const allPanes = useMemo(() => collectPanes(root), [root]);
  const { panes: boundsMap, dividers } = useMemo(() => collectLayout(root), [root]);

  const [dragState, setDragState] = useState<DragState | null>(null);
  const [hoverTarget, setHoverTarget] = useState<HoverTarget | null>(null);

  const hoverTargetRef = useRef<HoverTarget | null>(null);
  hoverTargetRef.current = hoverTarget;

  const dragStateRef = useRef<DragState | null>(null);
  dragStateRef.current = dragState;

  // Handle pointer down on a pane grip handle to start pointer-based dragging
  const handleGripPointerDown = useCallback(
    (sourcePaneId: string, sourceTitle: string) => (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const newDrag: DragState = {
        sourcePaneId,
        sourceTitle,
        currentX: e.clientX,
        currentY: e.clientY,
      };
      setDragState(newDrag);
      setHoverTarget(null);

      const handlePointerMove = (moveEv: PointerEvent) => {
        setDragState((prev) =>
          prev
            ? {
                ...prev,
                currentX: moveEv.clientX,
                currentY: moveEv.clientY,
              }
            : null
        );

        // Check if cursor is over the TabBar or near the top
        const elements = document.elementsFromPoint(moveEv.clientX, moveEv.clientY);
        let isOverTabBar = false;
        for (const el of elements) {
          if ((el as HTMLElement).closest("[data-tabbar-drop-zone='true']")) {
            isOverTabBar = true;
            break;
          }
        }

        const containerEl = containerRef.current;
        const containerRect = containerEl?.getBoundingClientRect();
        if (isOverTabBar || (containerRect && moveEv.clientY < containerRect.top + 28)) {
          setHoverTarget({ targetId: "new_tab", targetTitle: "New Dedicated Tab", zone: "center" });
          return;
        }

        let foundPaneEl: HTMLElement | null = null;
        for (const el of elements) {
          const paneEl = (el as HTMLElement).closest("[data-pane-id]") as HTMLElement | null;
          if (paneEl) {
            foundPaneEl = paneEl;
            break;
          }
        }

        if (foundPaneEl) {
          const targetId = foundPaneEl.getAttribute("data-pane-id");
          const targetTitle = foundPaneEl.getAttribute("data-pane-title") || "Terminal";

          if (targetId && targetId !== sourcePaneId) {
            const rect = foundPaneEl.getBoundingClientRect();
            const xRatio = (moveEv.clientX - rect.left) / rect.width;
            const yRatio = (moveEv.clientY - rect.top) / rect.height;

            let zone: DropZone = "center";
            if (xRatio < 0.22) zone = "left";
            else if (xRatio > 0.78) zone = "right";
            else if (yRatio < 0.22) zone = "top";
            else if (yRatio > 0.78) zone = "bottom";

            setHoverTarget({ targetId, targetTitle, zone });
            return;
          }
        }

        setHoverTarget(null);
      };

      const handlePointerUp = () => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);

        const currentDrag = dragStateRef.current;
        const currentTarget = hoverTargetRef.current;

        if (currentDrag && currentTarget) {
          if (currentTarget.targetId === "new_tab") {
            onExtractToNewTab?.(currentDrag.sourcePaneId);
          } else if (currentDrag.sourcePaneId !== currentTarget.targetId) {
            onDropZone(currentDrag.sourcePaneId, currentTarget.targetId, currentTarget.zone);
          }
        }

        setDragState(null);
        setHoverTarget(null);
      };

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
    },
    [onDropZone, onExtractToNewTab]
  );

  // Clean up window listeners on unmount
  useEffect(() => {
    return () => {
      setDragState(null);
      setHoverTarget(null);
    };
  }, []);

  const GAP = 2; // px border spacing between panes

  return (
    <div ref={containerRef} className="relative h-full w-full min-h-0 min-w-0 overflow-hidden">
      {/* Floating Ghost Badge while dragging a pane */}
      {dragState && (
        <div
          style={{
            transform: `translate3d(${dragState.currentX + 14}px, ${dragState.currentY + 14}px, 0)`,
          }}
          className={cn(
            "fixed top-0 left-0 z-50 pointer-events-none flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs shadow-2xl backdrop-blur-md select-none transition-none",
            hoverTarget?.targetId === "new_tab"
              ? "bg-emerald-950/95 border border-emerald-500/80 text-emerald-200"
              : "bg-zinc-950/95 border border-primary/60 text-foreground"
          )}
        >
          {hoverTarget?.targetId === "new_tab" ? (
            <>
              <ExternalLink className="h-3.5 w-3.5 text-emerald-400" />
              <span className="font-semibold text-[11px]">Drop to Open in New Tab</span>
            </>
          ) : (
            <>
              <GripVertical className="h-3.5 w-3.5 text-primary" />
              <span className="font-semibold text-[11px]">Moving: {dragState.sourceTitle}</span>
            </>
          )}
        </div>
      )}

      {/* Top Banner Indicator when hovering TabBar or top drop zone */}
      {hoverTarget?.targetId === "new_tab" && (
        <div className="absolute top-2 left-2 right-2 h-10 z-50 rounded-xl bg-emerald-500/20 border-2 border-dashed border-emerald-400/80 flex items-center justify-center gap-2 text-emerald-300 text-xs font-bold backdrop-blur-md animate-pulse pointer-events-none shadow-xl">
          <ExternalLink className="h-4 w-4 text-emerald-400" />
          <span>Release here to open terminal in a new dedicated tab</span>
        </div>
      )}

      {/* Floating Zoom indicator if a pane is maximized */}
      {maximizedPaneId && (
        <div className="absolute top-2 right-14 z-40 pointer-events-none">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-zinc-950/80 border border-primary/40 text-[10px] text-primary shadow-lg backdrop-blur-md">
            <Minimize2 className="h-2.5 w-2.5" />
            <span>Zoomed (Alt+Z to restore)</span>
          </div>
        </div>
      )}

      {/*
        STABLE FLAT PANE LIST:
        Every PaneView is keyed by its unique pane.id at this stable, unchanging root depth.
        When any pane is closed, added, or resized, surviving PaneView instances NEVER unmount.
        Their PTY sessions, SSH connections, processes (uvicorn, Next.js, etc.) remain running uninterrupted!
      */}
      {allPanes.map((pane) => {
        const bounds = boundsMap.get(pane.id) || { left: 0, top: 0, width: 100, height: 100 };
        const isFocused = activePaneId ? pane.id === activePaneId : false;
        const isTarget = hoverTarget?.targetId === pane.id;
        const isMaximized = maximizedPaneId === pane.id;
        const hasZoomActive = Boolean(maximizedPaneId);

        const style: React.CSSProperties = isMaximized
          ? {
              position: "absolute",
              left: 0,
              top: 0,
              width: "100%",
              height: "100%",
              zIndex: 30,
            }
          : hasZoomActive
          ? { display: "none" }
          : {
              position: "absolute",
              left: `calc(${bounds.left}% + ${GAP}px)`,
              top: `calc(${bounds.top}% + ${GAP}px)`,
              width: `calc(${bounds.width}% - ${GAP * 2}px)`,
              height: `calc(${bounds.height}% - ${GAP * 2}px)`,
              zIndex: 1,
            };

        return (
          <div
            key={pane.id}
            data-pane-id={pane.id}
            data-pane-title={pane.title}
            style={style}
            className="min-h-0 min-w-0"
          >
            {isTarget && hoverTarget && (
              <PaneDropOverlay zone={hoverTarget.zone} targetTitle={pane.title} />
            )}
            <PaneView
              key={pane.id}
              pane={pane}
              canSplit={totalPanes < 6}
              canClose={totalPanes > 1}
              canMaximize={totalPanes > 1}
              isMaximized={isMaximized}
              onToggleMaximize={() => onToggleMaximize(pane.id)}
              onExtractToNewTab={totalPanes > 1 ? () => onExtractToNewTab?.(pane.id) : undefined}
              isVisible={isVisible}
              isFocused={isFocused}
              onFocus={() => onFocusPane(pane.id)}
              onGripPointerDown={
                totalPanes > 1
                  ? handleGripPointerDown(pane.id, pane.title)
                  : undefined
              }
              onUpdate={(updater) => onUpdatePane(pane.id, updater)}
              onSplit={(dir) => onSplitPane(pane.id, dir)}
              onClose={() => onClosePane(pane.id)}
              macros={macros}
              profiles={profiles}
              onSaveMacro={onSaveMacro}
              onCloseTab={onCloseTab}
              onOpenProfile={onOpenProfile}
              onEditProfile={onEditProfile}
              onAddNewServer={onAddNewServer}
              onOpenMacroSidesheet={onOpenMacroSidesheet}
            />
          </div>
        );
      })}

      {/*
        ABSOLUTE SPLIT DIVIDERS:
        Rendered on top of panes with interactive dragging to dynamically resize splits.
      */}
      {!maximizedPaneId &&
        dividers.map((d) => {
          const isRow = d.direction === "row";
          const dividerStyle: React.CSSProperties = isRow
            ? {
                position: "absolute",
                left: `calc(${d.linePos}% - 5px)`,
                top: `${d.splitBox.top}%`,
                width: "10px",
                height: `${d.splitBox.height}%`,
                zIndex: 20,
              }
            : {
                position: "absolute",
                left: `${d.splitBox.left}%`,
                top: `calc(${d.linePos}% - 5px)`,
                width: `${d.splitBox.width}%`,
                height: "10px",
                zIndex: 20,
              };

          return (
            <SplitDivider
              key={d.id}
              direction={d.direction}
              splitId={d.id}
              sizes={d.sizes}
              containerRef={containerRef}
              splitBox={d.splitBox}
              style={dividerStyle}
              onResize={onResizeSplit}
            />
          );
        })}
    </div>
  );
};
