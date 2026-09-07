import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Folder,
  Key,
  Lock,
  Plus,
  Server,
  Terminal as TerminalIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ProfileSummary, SshConnectParams } from "@/sessions";

export default function ServerLauncher({
  profiles,
  onOpenProfile,
  onAddNewServer,
  onConnect,
  onLocal,
}: {
  profiles: ProfileSummary[];
  onOpenProfile: (profile: ProfileSummary) => void;
  onAddNewServer: () => void;
  onConnect: (params: SshConnectParams) => void;
  onLocal: (shell?: string) => void;
}) {
  const [showQuickForm, setShowQuickForm] = useState(false);
  const [host, setHost] = useState("");
  const [port, setPort] = useState(22);
  const [username, setUsername] = useState("root");
  const [authMethod, setAuthMethod] = useState<"password" | "key">("password");
  const [password, setPassword] = useState("");
  const [keyPath, setKeyPath] = useState("");
  const [passphrase, setPassphrase] = useState("");

  const handleQuickConnect = (e: React.FormEvent) => {
    e.preventDefault();
    if (!host.trim() || !username.trim()) return;
    onConnect({
      host: host.trim(),
      port: Number(port) || 22,
      username: username.trim(),
      authMethod,
      password: authMethod === "password" ? password : undefined,
      keyPath: authMethod === "key" ? keyPath : undefined,
      passphrase: authMethod === "key" ? passphrase : undefined,
    });
  };

  const sshProfiles = profiles.filter((p) => p.kind === "ssh");

  return (
    <div className="flex h-full w-full flex-col items-center justify-start overflow-y-auto p-6 md:p-8">
      <div className="w-full max-w-3xl space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">Launch a Connection</h2>
          <p className="text-xs text-muted-foreground">
            Select a saved VPS server to auto-connect terminal & live metrics, or open a local shell.
          </p>
        </div>

        {/* Saved Servers Grid */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Saved Servers ({sshProfiles.length})
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={onAddNewServer}
              className="h-7 gap-1.5 text-xs border-dashed border-border hover:border-primary/50 text-foreground"
            >
              <Plus className="h-3.5 w-3.5 text-primary" />
              Add Server
            </Button>
          </div>

          {sshProfiles.length === 0 ? (
            <Card
              onClick={onAddNewServer}
              className="flex flex-col items-center justify-center p-8 border-dashed border-border/80 bg-card/40 hover:bg-card/70 hover:border-primary/50 transition-all cursor-pointer rounded-xl group text-center"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 group-hover:scale-105 transition-transform mb-2.5">
                <Plus className="h-5 w-5" />
              </div>
              <p className="text-sm font-medium text-foreground">No servers added yet</p>
              <p className="text-xs text-muted-foreground mt-0.5 max-w-sm">
                Click here to add your VPS host with SSH credentials to enable auto-monitoring and live logs.
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {sshProfiles.map((p) => (
                <Card
                  key={p.id}
                  onClick={() => onOpenProfile(p)}
                  className="group relative flex flex-col justify-between p-3.5 border-border bg-card/60 hover:bg-card hover:border-primary/40 hover:shadow-md transition-all cursor-pointer rounded-xl"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
                          <Server className="h-3.5 w-3.5" />
                        </div>
                        <span className="font-semibold text-xs text-foreground truncate group-hover:text-primary transition-colors">
                          {p.name}
                        </span>
                      </div>
                      {p.folder && (
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground bg-secondary/40 px-1.5 py-0.5 rounded border border-border/40">
                          <Folder className="h-2.5 w-2.5" />
                          {p.folder}
                        </span>
                      )}
                    </div>

                    <div className="space-y-0.5">
                      <div className="text-[11px] text-muted-foreground font-mono truncate">
                        {p.username}@{p.host}:{p.port || 22}
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        {p.authMethod === "key" ? (
                          <>
                            <Key className="h-2.5 w-2.5 text-amber-400" />
                            <span>SSH Key Auth</span>
                          </>
                        ) : (
                          <>
                            <Lock className="h-2.5 w-2.5 text-blue-400" />
                            <span>Password Auth</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-border/40 flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground group-hover:text-foreground transition-colors">
                      Connect Server Hub
                    </span>
                    <div className="flex h-5 w-5 items-center justify-center rounded-md bg-secondary text-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                      <ChevronRight className="h-3 w-3" />
                    </div>
                  </div>
                </Card>
              ))}

              {/* Add New Server Card in Grid */}
              <Card
                onClick={onAddNewServer}
                className="flex flex-col items-center justify-center p-3.5 border-dashed border-border/80 bg-card/30 hover:bg-card/60 hover:border-primary/50 transition-all cursor-pointer rounded-xl group min-h-[110px]"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20 group-hover:scale-110 transition-transform mb-1.5">
                  <Plus className="h-4 w-4" />
                </div>
                <span className="text-xs font-medium text-foreground">Add New Server</span>
                <span className="text-[10px] text-muted-foreground">SSH Credentials</span>
              </Card>
            </div>
          )}
        </div>

        {/* Local Shell Actions */}
        <div className="space-y-2.5">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Local Terminals
          </span>
          <div className="flex flex-wrap gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onLocal("powershell")}
              className="h-8 gap-2 text-xs bg-card/50 border-border hover:bg-card hover:border-border"
            >
              <TerminalIcon className="h-3.5 w-3.5 text-blue-400" />
              PowerShell
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onLocal("cmd")}
              className="h-8 gap-2 text-xs bg-card/50 border-border hover:bg-card hover:border-border"
            >
              <TerminalIcon className="h-3.5 w-3.5 text-zinc-400" />
              Command Prompt (CMD)
            </Button>
          </div>
        </div>

        {/* Collapsible One-Time Temporary SSH Connect */}
        <div className="pt-2 border-t border-border/40">
          <button
            type="button"
            onClick={() => setShowQuickForm((prev) => !prev)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors font-medium"
          >
            {showQuickForm ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            One-time Temporary SSH Session
          </button>

          {showQuickForm && (
            <Card className="mt-3 p-4 border-border bg-card/50 space-y-3 rounded-xl max-w-md">
              <form onSubmit={handleQuickConnect} className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="text-[11px] text-muted-foreground">Host / IP</label>
                    <Input
                      placeholder="147.93.20.139"
                      value={host}
                      onChange={(e) => setHost(e.target.value)}
                      className="h-7 text-xs mt-0.5"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-muted-foreground">Port</label>
                    <Input
                      type="number"
                      placeholder="22"
                      value={port}
                      onChange={(e) => setPort(Number(e.target.value))}
                      className="h-7 text-xs mt-0.5"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-muted-foreground">Username</label>
                    <Input
                      placeholder="root"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="h-7 text-xs mt-0.5"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-muted-foreground">Auth Method</label>
                    <Select value={authMethod} onValueChange={(v) => setAuthMethod(v as "password" | "key")}>
                      <SelectTrigger className="h-7 text-xs mt-0.5">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="password">Password</SelectItem>
                        <SelectItem value="key">Private Key</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {authMethod === "password" ? (
                  <div>
                    <label className="text-[11px] text-muted-foreground">Password</label>
                    <PasswordInput
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="mt-0.5 text-xs h-7"
                      required
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div>
                      <label className="text-[11px] text-muted-foreground">Key Path</label>
                      <Input
                        placeholder="C:\Users\user\.ssh\id_rsa"
                        value={keyPath}
                        onChange={(e) => setKeyPath(e.target.value)}
                        className="h-7 text-xs mt-0.5"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-muted-foreground">Key Passphrase (optional)</label>
                      <PasswordInput
                        placeholder="••••••••"
                        value={passphrase}
                        onChange={(e) => setPassphrase(e.target.value)}
                        className="mt-0.5 text-xs h-7"
                      />
                    </div>
                  </div>
                )}

                <Button type="submit" size="sm" className="w-full h-7 text-xs">
                  Connect Once
                </Button>
              </form>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
