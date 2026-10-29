import { getProfilePassword, type ProfileSummary } from "@/sessions";

/**
 * Strips ANSI terminal escape sequences (colors, cursor movements, etc.)
 */
export function cleanTerminalOutput(raw: string): string {
  // Regex removes standard ANSI escape codes, bracket sequences, OSC titles
  return raw
    .replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, "")
    .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, "")
    .replace(/\r/g, "")
    .trim();
}

/**
 * Checks if raw terminal output ends with an interactive password prompt.
 */
export function isPasswordPrompt(text: string): boolean {
  const clean = cleanTerminalOutput(text);
  if (!clean) return false;

  const patterns = [
    /[a-zA-Z0-9_.@\-]+'s password:\s*$/i,
    /(?:enter\s+)?password(?:\s+for\s+[^:]+)?:\s*$/i,
    /(?:enter\s+)?passphrase(?:\s+for\s+(?:key\s+)?['"][^'"]+['"])?:\s*$/i,
    /\[sudo\]\s+password\s+for\s+[^:]+:\s*$/i,
    /(?:admin|root|user)\s+password:\s*$/i,
    /password:\s*$/i,
  ];

  return patterns.some((p) => p.test(clean));
}

/**
 * Checks if raw terminal output is asking for SSH host key fingerprint confirmation:
 * e.g., "Are you sure you want to continue connecting (yes/no/[fingerprint])?"
 */
export function isHostKeyConfirmationPrompt(text: string): boolean {
  const clean = cleanTerminalOutput(text);
  return /are you sure you want to continue connecting \((?:yes\/no|yes\/no\/\[fingerprint\])\)\?\s*$/i.test(
    clean
  );
}

/**
 * Parses hostname or IP address from an SSH / SCP / CLI command:
 * Examples:
 *   "ssh -L 27018:127.0.0.1:27017 root@147.93.20.139" -> "147.93.20.139"
 *   "ssh -p 2200 admin@myserver.com" -> "myserver.com"
 *   "ssh 192.168.1.50" -> "192.168.1.50"
 */
export function extractHostFromCommand(command?: string): string | null {
  if (!command) return null;

  // 1. Check for user@host pattern anywhere in command
  const userAtHost = command.match(/\b[a-zA-Z0-9_\.\-]+@([a-zA-Z0-9\.\-]+)\b/);
  if (userAtHost && userAtHost[1]) {
    return userAtHost[1];
  }

  // 2. Check for IPv4 address
  const ipMatch = command.match(/\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/);
  if (ipMatch && ipMatch[1]) {
    // Avoid matching 127.0.0.1 or 0.0.0.0 from tunnel flags like 27018:127.0.0.1:27017
    const candidate = ipMatch[1];
    if (candidate !== "127.0.0.1" && candidate !== "0.0.0.0") {
      return candidate;
    }
  }

  // 3. Fallback: Parse target host following ssh command
  const sshCmdMatch = command.match(/\b(?:ssh|scp|sftp)(?:\.exe)?\s+(?:-[a-zA-Z0-9:]+\s+)*([a-zA-Z0-9\.\-_]+)/i);
  if (sshCmdMatch && sshCmdMatch[1]) {
    const val = sshCmdMatch[1];
    if (!val.startsWith("-") && !val.includes(":")) {
      return val;
    }
  }

  return null;
}

export interface ResolveSecretOptions {
  activeCommand?: string;
  explicitProfileId?: number;
  customSecret?: string;
  profiles?: ProfileSummary[];
}

/**
 * Resolves password/secret from:
 * 1. Dedicated custom secret if configured
 * 2. Explicit profile ID
 * 3. Auto-detected target host from command matching saved profiles in Key Vault
 */
export async function resolveAutoResponderSecret({
  activeCommand,
  explicitProfileId,
  customSecret,
  profiles,
}: ResolveSecretOptions): Promise<{ secret: string; hint: string } | null> {
  // 1. Custom secret
  if (customSecret && customSecret.trim().length > 0) {
    return { secret: customSecret, hint: "Custom Macro Secret" };
  }

  // 2. Explicit profile
  if (explicitProfileId != null) {
    const prof = profiles?.find((p) => p.id === explicitProfileId);
    const pwd = await getProfilePassword(explicitProfileId);
    if (pwd && pwd.length > 0) {
      return { secret: pwd, hint: prof?.name || `Profile #${explicitProfileId}` };
    }
  }

  // 3. Auto-match by host / IP from command
  const host = extractHostFromCommand(activeCommand);
  if (host && profiles && profiles.length > 0) {
    const targetClean = host.toLowerCase().trim();
    const matched = profiles.find(
      (p) =>
        p.host.toLowerCase().trim() === targetClean ||
        p.name.toLowerCase().trim() === targetClean
    );

    if (matched) {
      const pwd = await getProfilePassword(matched.id);
      if (pwd && pwd.length > 0) {
        return { secret: pwd, hint: matched.name };
      }
    }
  }

  return null;
}

