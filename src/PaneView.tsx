import { useRef, useState } from "react";
import {
  Activity,
  Columns2,
  ExternalLink,
  FileText,
  Globe,
  GripVertical,
  Maximize2,
  Minimize2,
  Rows2,
  Terminal as TerminalIcon,
  X,
  Zap,
} from "lucide-react";
import TabContent from "./TabContent";
import { TerminalHandle, TerminalStatus } from "./Terminal";
import { sshSession } from "./sessions";
import type { MacroSummary, ProfileSummary, SaveMacroParams, SshConnectParams } from "./sessions";
import type { Pane, ServerHubSubView } from "./types";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { DirectionAwareTabs } from "@/components/ui/direction-aware-tabs";
import { cn } from "@/lib/utils";

export default function PaneView({
  pane,
  canSplit,
  canClose,
  onUpdate,
  onSplit,
  onClose,
  macros,
  profiles,
  onSaveMacro,
  onCloseTab,
  onOpenProfile,
  onEditProfile,
  onAddNewServer,
  onOpenMacroSidesheet,
  isVisible = true,
  isFocused = false,
  onFocus,
  onGripPointerDown,
  canMaximize = false,
  isMaximized = false,
  onToggleMaximize,
  onExtractToNewTab,
}: {
  pane: Pane;
  canSplit: boolean;
  canClose: boolean;
  onUpdate: (updater: (pane: Pane) => Pane) => void;
  onSplit: (direction: "row" | "column") => void;
  onClose: () => void;
  macros: MacroSummary[];
  profiles: ProfileSummary[];
  onSaveMacro: (params: SaveMacroParams, macroId?: number) => void;
  onCloseTab: () => void;
  onOpenProfile?: (profile: ProfileSummary) => void;
  onEditProfile?: (profile: ProfileSummary) => void;
  onAddNewServer?: () => void;
  onOpenMacroSidesheet?: (profileId?: number, terminalRef?: React.RefObject<TerminalHandle | null>) => void;
  isVisible?: boolean;
  isFocused?: boolean;
  onFocus?: () => void;
  onGripPointerDown?: (e: React.PointerEvent) => void;
  canMaximize?: boolean;
  isMaximized?: boolean;
  onToggleMaximize?: () => void;
  onExtractToNewTab?: () => void;
}) {
  const terminalRef = useRef<TerminalHandle>(null);
  const [, setStatus] = useState<TerminalStatus>("connecting");
  const initialSubView = pane.content.kind === "ssh" && pane.content.initialSubView ? pane.content.initialSubView : "terminal";
  const [subView, setSubView] = useState<ServerHubSubView>(initialSubView);

  const hasSession = pane.content.kind === "ssh" || pane.content.kind === "local";
  const currentProfileId = pane.content.kind === "ssh" || pane.content.kind === "local" ? pane.content.profileId : undefined;
  const isMacro = "macroId" in pane.content && pane.content.macroId != null;
  const isSshProfile = pane.content.kind === "ssh" && pane.content.profileId != null && !isMacro;

  return (
    <div
      onClick={onFocus}
      className={cn(
        "flex h-full min-w-0 min-h-0 flex-col overflow-hidden rounded-xl border bg-card transition-all duration-150",
        isFocused
          ? "border-primary/50 ring-1 ring-primary/40 shadow-sm"
          : "border-white/[0.04]"
      )}
    >
      <div className="flex items-center gap-1.5 border-b border-white/[0.03] bg-muted/40 px-2 py-1 select-none">
        {onGripPointerDown && (
          <Tooltip content="Drag to dock or swap pane" side="bottom">
            <div
              onPointerDown={onGripPointerDown}
              className="cursor-grab active:cursor-grabbing p-0.5 -ml-0.5 text-zinc-500 hover:text-zinc-200 transition-colors select-none"
            >
              <GripVertical className="h-3.5 w-3.5" />
            </div>
          </Tooltip>
        )}

        <div className="flex items-center gap-1 mr-1 min-w-0">
          {isMacro && <Zap className="h-3 w-3 text-amber-400 flex-shrink-0" />}
          <span className="truncate text-xs font-medium text-muted-foreground">{pane.title}</span>
        </div>

        {/* Server Hub Subview Switcher */}
        {isSshProfile && (
          <DirectionAwareTabs
            tabs={[
              {
                id: "terminal",
                label: (
                  <>
                    <TerminalIcon className="h-3 w-3" />
                    <span>Terminal</span>
                  </>
                ),
              },
              {
                id: "monitor",
                label: (
                  <>
                    <Activity className="h-3 w-3" />
                    <span>Status Charts</span>
                  </>
                ),
              },
              {
                id: "traffic",
                label: (
                  <>
                    <Globe className="h-3 w-3 text-cyan-400" />
                    <span className={subView === "traffic" ? "text-cyan-400 font-semibold" : ""}>Web Traffic</span>
                  </>
                ),
              },
              {
                id: "logs",
                label: (
                  <>
                    <FileText className="h-3 w-3 text-emerald-400" />
                    <span className={subView === "logs" ? "text-emerald-400 font-semibold" : ""}>Live Logs</span>
                  </>
                ),
              },
            ]}
            activeTabId={subView}
            onChange={(id) => setSubView(id as ServerHubSubView)}
            showContent={false}
            layoutId={`header-subview-tabs-${pane.id}`}
            containerClassName="w-auto"
            className="h-6.5 py-0.5 px-1 bg-background/80 border border-white/[0.04] rounded-lg"
            tabClassName="h-5.5 px-2 text-[11px] rounded-md gap-1"
            rounded="rounded-lg"
            roundedInner="rounded-md"
            bubbleClassName="bg-white/[0.12] border-white/20 rounded-md"
          />
        )}

        <div className="flex-1" />

        {hasSession && subView === "terminal" && onOpenMacroSidesheet && (
          <Tooltip content="Open Macro Cockpit" side="bottom">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenMacroSidesheet(currentProfileId, terminalRef)}
              className="flex items-center gap-1.5 h-6 px-2 text-[11px] font-medium rounded-lg bg-zinc-900/80 hover:bg-zinc-800/90 text-foreground border border-white/[0.06] shadow-xs hover:border-amber-400/30 transition-colors cursor-pointer"
            >
              <Zap className="h-3 w-3 text-amber-400" />
              <span>Macros</span>
            </Button>
          </Tooltip>
        )}
        {canSplit && (
          <>
            <Tooltip content="Split right (horizontal split)" side="bottom">
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onSplit("row")}>
                <Columns2 className="h-3.5 w-3.5" />
              </Button>
            </Tooltip>
            <Tooltip content="Split down (vertical split)" side="bottom">
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onSplit("column")}>
                <Rows2 className="h-3.5 w-3.5" />
              </Button>
            </Tooltip>
          </>
        )}
        {canMaximize && onToggleMaximize && (
          <Tooltip content={isMaximized ? "Restore grid (Alt+Z)" : "Maximize pane (Alt+Z)"} side="bottom">
            <Button
              variant="ghost"
              size="icon"
              className={cn("h-6 w-6", isMaximized && "text-primary hover:text-primary")}
              onClick={onToggleMaximize}
            >
              {isMaximized ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </Button>
          </Tooltip>
        )}
        {canClose && onExtractToNewTab && (
          <Tooltip content="Pop out to new tab" side="bottom">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              onClick={onExtractToNewTab}
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          </Tooltip>
        )}
        {canClose && (
          <Tooltip content="Close pane" side="bottom">
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </Tooltip>
        )}
      </div>
      <div className="min-h-0 flex-1">
        <TabContent
          ref={terminalRef}
          content={pane.content}
          subView={subView}
          onNavigateSubView={(view) => setSubView(view)}
          isVisible={isVisible}
          profiles={profiles}
          macros={macros}
          onSaveMacro={onSaveMacro}
          onCloseTab={onCloseTab}
          onOpenProfile={(prof) => onOpenProfile?.(prof)}
          onEditProfile={(prof) => onEditProfile?.(prof)}
          onAddNewServer={() => onAddNewServer?.()}
          onClearInitialCommands={() =>
            onUpdate((p) => ({ ...p, content: { ...p.content, initialCommands: undefined } }))
          }
          onConnect={(params: SshConnectParams) => {
            const session = sshSession(params);
            onUpdate((p) => ({
              ...p,
              title: `${params.username}@${params.host}`,
              content: {
                kind: "ssh",
                session,
                host: params.host,
                profileName: `${params.username}@${params.host}`,
              },
            }));
          }}
          onLocal={(shell) => onUpdate((p) => ({ ...p, title: shell === "cmd" ? "Command Prompt" : "PowerShell", content: { kind: "local", shell } }))}
          onExit={() => onUpdate((p) => ({ ...p, title: "New Tab", content: { kind: "connect" } }))}
          onStatusChange={setStatus}
        />
      </div>
    </div>
  );
}
