import { forwardRef, useMemo } from "react";
import Terminal, { TerminalHandle, TerminalStatus } from "./Terminal";
import ServerLauncher from "./components/servers/ServerLauncher";
import MacroRunView from "./MacroRunView";
import MacroEditorView from "./MacroEditorView";
import ServerMonitor from "./components/monitor/ServerMonitor";
import ServiceLogViewer from "./components/logs/ServiceLogViewer";
import WebTrafficDashboard from "./components/traffic/WebTrafficDashboard";
import { localSession } from "./sessions";
import type { MacroSummary, ProfileSummary, SaveMacroParams, SshConnectParams } from "./sessions";
import type { ServerHubSubView, TabContentState } from "./types";

const TabContent = forwardRef<
  TerminalHandle,
  {
    content: TabContentState;
    subView?: ServerHubSubView;
    onNavigateSubView?: (subView: ServerHubSubView) => void;
    onConnect: (params: SshConnectParams) => void;
    onLocal: (shell?: string) => void;
    onExit: () => void;
    onStatusChange?: (status: TerminalStatus) => void;
    profiles: ProfileSummary[];
    macros: MacroSummary[];
    onSaveMacro: (params: SaveMacroParams, macroId?: number) => void;
    onCloseTab: () => void;
    onOpenProfile: (profile: ProfileSummary) => void;
    onEditProfile?: (profile: ProfileSummary) => void;
    onAddNewServer: () => void;
    isVisible?: boolean;
  }
>(
  (
    {
      content,
      subView = "terminal",
      onNavigateSubView,
      isVisible = true,
      onConnect,
      onLocal,
      onExit,
      onStatusChange,
      profiles,
      macros,
      onSaveMacro,
      onCloseTab,
      onOpenProfile,
      onEditProfile,
      onAddNewServer,
    },
    ref
  ) => {
    if (content.kind === "connect") {
      return (
        <ServerLauncher
          profiles={profiles}
          onOpenProfile={onOpenProfile}
          onAddNewServer={onAddNewServer}
          onConnect={onConnect}
          onLocal={onLocal}
        />
      );
    }

    if (content.kind === "macro-run") {
      return <MacroRunView runId={content.runId} macroName={content.macroName} />;
    }

    if (content.kind === "macro-editor") {
      return (
        <MacroEditorView
          profiles={profiles}
          macros={macros}
          macroId={content.macroId}
          onSave={(params) => onSaveMacro(params, content.macroId)}
          onDone={onCloseTab}
          onAddNewServer={onAddNewServer}
        />
      );
    }

    const session = useMemo(
      () => (content.kind === "local" ? localSession(content.shell) : content.session),
      [content.kind, content.kind === "local" ? content.shell : content.session]
    );
    const profile = content.profileId ? profiles.find((p) => p.id === content.profileId) : undefined;
    const initialCommands =
      content.kind === "local" || content.kind === "ssh" ? content.initialCommands : undefined;

    return (
      <div className="relative h-full w-full min-h-0 min-w-0">
        <div className={`h-full w-full ${subView === "terminal" ? "block" : "hidden"}`}>
          <Terminal
            ref={ref}
            session={session}
            onExit={onExit}
            onStatusChange={onStatusChange}
            initialCommands={initialCommands}
            serverInfo={{
              profileId: profile?.id ?? (content.kind === "ssh" ? content.profileId : undefined),
              name: profile?.name ?? (content.kind === "ssh" ? content.profileName : undefined),
              host: profile?.host ?? (content.kind === "ssh" ? content.host : undefined),
              port: profile?.port ?? 22,
              username: profile?.username,
              authMethod: profile?.authMethod,
            }}
            onEditServer={profile && onEditProfile ? () => onEditProfile(profile) : undefined}
            onCloseTab={onCloseTab}
          />
        </div>

        {content.kind === "ssh" && content.profileId != null && !content.macroId && (
          <>
            <div className={`h-full w-full ${subView === "monitor" ? "block" : "hidden"}`}>
              <ServerMonitor
                profileId={content.profileId}
                serverName={profile?.name || content.profileName}
                host={profile?.host || content.host}
                onNavigateSubView={onNavigateSubView}
              />
            </div>

            <div className={`h-full w-full ${subView === "traffic" ? "block" : "hidden"}`}>
              <WebTrafficDashboard
                profileId={content.profileId}
                serverName={profile?.name || content.profileName}
                host={profile?.host || content.host}
                isVisible={isVisible && subView === "traffic"}
              />
            </div>

            <div className={`h-full w-full ${subView === "logs" ? "block" : "hidden"}`}>
              <ServiceLogViewer
                profileId={content.profileId}
                serverName={profile?.name || content.profileName}
                isVisible={isVisible && subView === "logs"}
              />
            </div>
          </>
        )}
      </div>
    );
  }
);

export default TabContent;


