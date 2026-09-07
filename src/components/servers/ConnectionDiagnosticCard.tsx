import React, { useState } from "react";
import {
  AlertTriangle,
  Check,
  Copy,
  Key,
  Pencil,
  RefreshCw,
  Server,
  Shield,
  Terminal as TerminalIcon,
  WifiOff,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnimatedBadge } from "@/components/AnimatedBadge";

export interface ServerInfoMeta {
  profileId?: number;
  name?: string;
  host?: string;
  port?: number;
  username?: string;
  authMethod?: string;
}

interface ConnectionDiagnosticCardProps {
  error: string;
  serverInfo?: ServerInfoMeta;
  isRetrying?: boolean;
  onRetry: () => void;
  onEditServer?: () => void;
  onViewTerminal?: () => void;
  onCloseTab?: () => void;
}

interface DiagnosisResult {
  categoryTitle: string;
  categoryDesc: string;
  badgeLabel: string;
  badgeStatus: "danger" | "warning";
  items: {
    icon: React.ReactNode;
    title: string;
    description: string;
    command?: string;
  }[];
}

function analyzeSshError(error: string, host?: string, port = 22, username = "root"): DiagnosisResult {
  const errLower = error.toLowerCase();

  // 1. Forcibly Closed / Connection Reset (OS Error 10054)
  if (
    errLower.includes("10054") ||
    errLower.includes("forcibly closed") ||
    errLower.includes("connection reset")
  ) {
    return {
      categoryTitle: "Connection Forcibly Closed by Remote Host",
      categoryDesc: `The connection to ${host || "the host"} on port ${port} was abruptly terminated or reset by the remote server or an intermediate firewall (OS Error 10054).`,
      badgeLabel: "Connection Reset (OS Error 10054)",
      badgeStatus: "danger",
      items: [
        {
          icon: <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />,
          title: "Firewall / fail2ban Dropped Connection",
          description: "The remote server's firewall, iptables, or fail2ban may be actively resetting connections from your IP, or a cloud NAT gateway closed the session.",
        },
        {
          icon: <Server className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />,
          title: "SSH Daemon Terminated or Overloaded",
          description: "The remote SSH service (sshd) may have been killed, restarted, or reached its MaxStartups connection limit.",
          command: "sudo systemctl status ssh && sudo journalctl -u ssh -n 25 --no-pager",
        },
        {
          icon: <Shield className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />,
          title: "Incompatible Crypto / Handshake Termination",
          description: "The remote server dropped the socket during SSH protocol or key exchange negotiation. Verify /etc/ssh/sshd_config permissions.",
        },
      ],
    };
  }

  // 2. Timeout / Unreachable
  if (
    errLower.includes("timeout") ||
    errLower.includes("timed out") ||
    errLower.includes("10060") ||
    errLower.includes("10051") ||
    errLower.includes("unreachable") ||
    errLower.includes("no route")
  ) {
    return {
      categoryTitle: "Network Timeout / Server Unreachable",
      categoryDesc: `Termizen could not reach ${host || "the host"} on port ${port}. The connection attempt timed out with no response from the remote machine.`,
      badgeLabel: "Port 22 Unreachable (OS Error 10060)",
      badgeStatus: "danger",
      items: [
        {
          icon: <Shield className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />,
          title: "Cloud Firewall / Security Group Blocking Inbound Port",
          description: `Most VPS providers (AWS EC2 Security Groups, DigitalOcean Cloud Firewall, Hetzner, GCP) block port ${port} by default. Make sure an inbound rule exists allowing TCP port ${port} from your IP address or 0.0.0.0/0.`,
        },
        {
          icon: <Server className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />,
          title: "VPS Power State",
          description: "Check your cloud hosting dashboard to ensure this instance is currently in the 'Running' state, not suspended, shutting down, or rebooting.",
        },
        {
          icon: <WifiOff className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />,
          title: "IP Address Verification",
          description: `Confirm that '${host || "the IP"}' is the active public IPv4 address. If your VPS has dynamic IP allocation, it may have changed upon reboot.`,
        },
        {
          icon: <TerminalIcon className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />,
          title: "Local Network / Outbound Port Block",
          description: "Some corporate networks, university Wi-Fi, or VPN services block outbound port 22. Try disconnecting from your VPN or testing on a mobile hotspot.",
        },
      ],
    };
  }

  // 2. Connection Refused
  if (
    errLower.includes("refused") ||
    errLower.includes("10061") ||
    errLower.includes("reset by peer") ||
    errLower.includes("connection reset")
  ) {
    return {
      categoryTitle: "Connection Actively Refused",
      categoryDesc: `The host ${host || "server"} is online, but it actively rejected the connection on port ${port}.`,
      badgeLabel: "Port Closed (OS Error 10061)",
      badgeStatus: "warning",
      items: [
        {
          icon: <Server className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />,
          title: "SSH Service (sshd) Is Not Running",
          description: "The SSH daemon may have crashed or stopped. Log in via your cloud provider's web VNC console and restart SSH:",
          command: "sudo systemctl status ssh && sudo systemctl restart ssh",
        },
        {
          icon: <Shield className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />,
          title: "Custom Non-Standard SSH Port",
          description: `The server may be configured to listen on a non-standard port (e.g., 2222, 22000) instead of default port ${port}. Check /etc/ssh/sshd_config and update the port in Termizen.`,
        },
        {
          icon: <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />,
          title: "Fail2ban or IP Blacklist",
          description: "Your public IP may have been temporarily banned by fail2ban after several failed authentication attempts. Wait 10 minutes or check iptables rules via web console.",
        },
      ],
    };
  }

  // 3. Authentication Failed
  if (
    errLower.includes("authentication failed") ||
    errLower.includes("auth failed") ||
    errLower.includes("permission denied") ||
    errLower.includes("password required") ||
    errLower.includes("key data or key path required")
  ) {
    return {
      categoryTitle: "SSH Authentication Rejected",
      categoryDesc: `Connected to ${host || "host"} successfully, but the server rejected the credentials for user '${username}'.`,
      badgeLabel: "Authentication Failed",
      badgeStatus: "danger",
      items: [
        {
          icon: <Key className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />,
          title: "Password or Private Key Incorrect",
          description: "Click 'Edit Server Settings' below to re-enter your password or re-select the SSH private key.",
        },
        {
          icon: <Shield className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />,
          title: "Root Login Prohibited by Default",
          description: `Many modern Linux distros (AWS Ubuntu AMI, Debian, CentOS) disable direct root SSH access. If '${username}' is root, try connecting as 'ubuntu' or 'debian', or enable root login in sshd_config.`,
          command: "sudo nano /etc/ssh/sshd_config  # PermitRootLogin yes",
        },
        {
          icon: <TerminalIcon className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />,
          title: "Authorized Keys Permissions",
          description: "If using SSH Key authentication, ensure your public key is added to ~/.ssh/authorized_keys with strict permissions:",
          command: "chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys",
        },
      ],
    };
  }

  // 4. Default / Generic Error
  return {
    categoryTitle: "SSH Connection Failed",
    categoryDesc: `Termizen encountered an error while initiating the SSH session to ${host || "the server"}.`,
    badgeLabel: "Connection Error",
    badgeStatus: "danger",
    items: [
      {
        icon: <TerminalIcon className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />,
        title: "Check Remote System Auth Logs",
        description: "Access the server through your cloud provider's web terminal / serial console and check recent SSH daemon logs:",
        command: "sudo journalctl -u ssh -n 40 --no-pager",
      },
      {
        icon: <Pencil className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />,
        title: "Review Server Configuration",
        description: "Click 'Edit Server Settings' to verify the hostname, username, port number, and saved credentials.",
      },
    ],
  };
}

export function ConnectionDiagnosticCard({
  error,
  serverInfo,
  isRetrying = false,
  onRetry,
  onEditServer,
  onViewTerminal,
  onCloseTab,
}: ConnectionDiagnosticCardProps) {
  const [copiedError, setCopiedError] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  const serverName = serverInfo?.name || serverInfo?.host || "Remote Server";
  const host = serverInfo?.host || "Unknown host";
  const port = serverInfo?.port || 22;
  const username = serverInfo?.username || "root";

  const diagnosis = analyzeSshError(error, host, port, username);

  const handleCopyError = async () => {
    try {
      await navigator.clipboard.writeText(error);
      setCopiedError(true);
      setTimeout(() => setCopiedError(false), 2000);
    } catch (err) {
      console.error("Failed to copy error", err);
    }
  };

  const handleCopyCommand = async (cmd: string) => {
    try {
      await navigator.clipboard.writeText(cmd);
      setCopiedCmd(cmd);
      setTimeout(() => setCopiedCmd(null), 2000);
    } catch (err) {
      console.error("Failed to copy command", err);
    }
  };

  return (
    <div className="flex h-full w-full items-center justify-center p-4 overflow-y-auto select-text">
      <div className="relative w-full max-w-2xl rounded-2xl border border-red-500/20 bg-card/95 backdrop-blur-2xl p-6 shadow-2xl shadow-red-950/20 animate-in fade-in zoom-in-95 duration-200">
        {/* Top Header */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-border/40">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 shadow-inner">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-foreground">
                  Unable to Connect to {serverName}
                </h2>
                <AnimatedBadge status={diagnosis.badgeStatus} size="sm">
                  {diagnosis.badgeLabel}
                </AnimatedBadge>
              </div>
              <p className="text-xs text-muted-foreground font-mono mt-0.5">
                Target: {username}@{host}:{port}
              </p>
            </div>
          </div>

          {onCloseTab && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground -mr-1 -mt-1"
              onClick={onCloseTab}
              title="Close tab"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Raw Error Callout Box */}
        <div className="mt-4 rounded-xl bg-black/40 border border-red-500/20 p-3 relative group">
          <div className="flex items-center justify-between text-[11px] font-semibold text-red-400/90 mb-1.5 uppercase tracking-wider">
            <span>SSH / OS Socket Error</span>
            <button
              type="button"
              onClick={handleCopyError}
              className="flex items-center gap-1 text-[11px] font-mono text-muted-foreground hover:text-foreground bg-white/[0.05] hover:bg-white/[0.1] px-2 py-0.5 rounded cursor-pointer transition-colors"
              title="Copy raw error string"
            >
              {copiedError ? (
                <>
                  <Check className="h-3 w-3 text-emerald-400" />
                  <span className="text-emerald-400 font-semibold">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" />
                  <span>Copy Error</span>
                </>
              )}
            </button>
          </div>
          <pre className="text-xs font-mono text-red-300/90 whitespace-pre-wrap break-all select-text font-normal leading-relaxed">
            {error}
          </pre>
        </div>

        {/* Diagnosis & Recommendations */}
        <div className="mt-4">
          <div className="mb-2">
            <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <span>Diagnosis: {diagnosis.categoryTitle}</span>
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {diagnosis.categoryDesc}
            </p>
          </div>

          <div className="space-y-2 mt-3">
            {diagnosis.items.map((item, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2.5 p-2.5 rounded-xl bg-muted/20 border border-border/40 hover:bg-muted/30 transition-colors"
              >
                {item.icon}
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-semibold text-foreground">
                    {item.title}
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    {item.description}
                  </p>
                  {item.command && (
                    <div className="mt-1.5 flex items-center justify-between rounded-lg bg-black/50 border border-white/[0.06] px-2 py-1 font-mono text-[11px] text-zinc-300">
                      <span className="truncate select-text">{item.command}</span>
                      <button
                        type="button"
                        onClick={() => handleCopyCommand(item.command!)}
                        className="ml-2 shrink-0 text-muted-foreground hover:text-foreground cursor-pointer p-0.5"
                        title="Copy command"
                      >
                        {copiedCmd === item.command ? (
                          <Check className="h-3 w-3 text-emerald-400" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons Footer */}
        <div className="mt-5 pt-4 border-t border-border/40 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="default"
              className="h-8 text-xs px-3 font-semibold gap-1.5 shadow-md bg-primary hover:bg-primary/90"
              onClick={onRetry}
              disabled={isRetrying}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRetrying ? "animate-spin" : ""}`} />
              <span>{isRetrying ? "Retrying Connection..." : "Retry Connection"}</span>
            </Button>

            {onEditServer && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs px-3 gap-1.5 bg-card/80 border-border/60 hover:bg-muted/50"
                onClick={onEditServer}
              >
                <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                <span>Edit Server Settings</span>
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {onViewTerminal && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-xs px-2.5 text-muted-foreground hover:text-foreground"
                onClick={onViewTerminal}
                title="Minimize this diagnostic card to inspect the raw console output"
              >
                <TerminalIcon className="h-3.5 w-3.5 mr-1" />
                <span>View Raw Terminal</span>
              </Button>
            )}

            {onCloseTab && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-xs px-2.5 text-muted-foreground hover:text-destructive"
                onClick={onCloseTab}
              >
                <span>Close Tab</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ConnectionErrorBanner({
  error,
  serverName,
  isRetrying,
  onShowDiagnostics,
  onRetry,
  onCloseTab,
}: {
  error: string;
  serverName?: string;
  isRetrying?: boolean;
  onShowDiagnostics: () => void;
  onRetry: () => void;
  onCloseTab?: () => void;
}) {
  return (
    <div className="absolute top-2 left-2 right-2 z-40 flex items-center justify-between gap-2 rounded-xl bg-red-950/85 backdrop-blur-xl border border-red-500/30 px-3 py-1.5 shadow-xl text-xs font-sans text-red-200">
      <div className="flex items-center gap-2 min-w-0">
        <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 animate-pulse" />
        <span className="font-semibold text-white truncate">
          Connection failed{serverName ? ` to ${serverName}` : ""}:
        </span>
        <span className="truncate font-mono text-[11px] text-red-300 max-w-[320px]">
          {error}
        </span>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <Button
          size="sm"
          variant="secondary"
          className="h-6 text-[11px] px-2 bg-red-500/20 hover:bg-red-500/30 text-white border border-red-500/30"
          onClick={onShowDiagnostics}
        >
          Diagnose
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-6 text-[11px] px-2 bg-black/40 hover:bg-black/60 text-white border-white/20"
          onClick={onRetry}
          disabled={isRetrying}
        >
          <RefreshCw className={`h-3 w-3 mr-1 ${isRetrying ? "animate-spin" : ""}`} />
          Retry
        </Button>
        {onCloseTab && (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0 text-red-400 hover:text-white hover:bg-red-500/20"
            onClick={onCloseTab}
            title="Close tab"
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}
