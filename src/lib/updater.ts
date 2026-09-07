import { openUrl } from "@tauri-apps/plugin-opener";

export const APP_VERSION = "0.1.0";
export const GITHUB_REPO = "shuaib-07/termizen";
export const RELEASES_API_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
export const RELEASES_PAGE_URL = `https://github.com/${GITHUB_REPO}/releases`;

const AUTO_CHECK_STORAGE_KEY = "termizen_auto_check_updates";

export interface UpdateInfo {
  updateAvailable: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseName?: string;
  releaseNotes?: string;
  releaseUrl: string;
  publishedAt?: string;
  assetUrl?: string;
  error?: string;
}

/**
 * Reads user preference for automatic update checks on launch. Defaults to true.
 */
export function getAutoCheckUpdates(): boolean {
  if (typeof window === "undefined") return true;
  const stored = localStorage.getItem(AUTO_CHECK_STORAGE_KEY);
  if (stored === null) return true;
  return stored === "true";
}

/**
 * Persists user preference for automatic update checks.
 */
export function setAutoCheckUpdates(enabled: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(AUTO_CHECK_STORAGE_KEY, String(enabled));
  window.dispatchEvent(new CustomEvent("termizen-auto-check-changed", { detail: enabled }));
}

/**
 * Cleans a version string by stripping 'v' prefixes and trimming whitespace.
 */
function cleanVersion(ver: string): string {
  return ver.trim().replace(/^v/i, "");
}

/**
 * Compares two semantic version strings (e.g. "0.2.0" vs "0.1.0").
 * Returns 1 if v1 > v2, -1 if v1 < v2, 0 if equal.
 */
export function compareSemver(v1: string, v2: string): number {
  const parts1 = cleanVersion(v1).split(".").map((n) => parseInt(n, 10) || 0);
  const parts2 = cleanVersion(v2).split(".").map((n) => parseInt(n, 10) || 0);

  const maxLen = Math.max(parts1.length, parts2.length);
  for (let i = 0; i < maxLen; i++) {
    const p1 = parts1[i] ?? 0;
    const p2 = parts2[i] ?? 0;
    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }
  return 0;
}

/**
 * Safely opens an external URL using Tauri plugin-opener with a browser fallback.
 */
export async function openExternalUrl(url: string): Promise<void> {
  try {
    await openUrl(url);
  } catch (err) {
    console.warn("Failed to open via tauri plugin-opener, falling back to window.open", err);
    if (typeof window !== "undefined") {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }
}

/**
 * Checks GitHub releases API for a newer version of Termizen.
 */
export async function checkAppUpdates(): Promise<UpdateInfo> {
  try {
    const res = await fetch(RELEASES_API_URL, {
      headers: {
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (res.status === 404) {
      // Repository exists but no releases published yet
      return {
        updateAvailable: false,
        currentVersion: APP_VERSION,
        latestVersion: APP_VERSION,
        releaseUrl: RELEASES_PAGE_URL,
      };
    }

    if (!res.ok) {
      throw new Error(`GitHub API returned status ${res.status}`);
    }

    const data = await res.json();
    const tagName: string = data.tag_name || "";
    const cleanTag = cleanVersion(tagName);
    const hasUpdate = compareSemver(cleanTag, APP_VERSION) > 0;

    // Look for Windows installer asset (.exe or .msi)
    let assetUrl = data.html_url || RELEASES_PAGE_URL;
    if (Array.isArray(data.assets) && data.assets.length > 0) {
      const winAsset = data.assets.find((a: any) =>
        a.name?.endsWith(".exe") || a.name?.endsWith(".msi")
      );
      if (winAsset?.browser_download_url) {
        assetUrl = winAsset.browser_download_url;
      }
    }

    return {
      updateAvailable: hasUpdate,
      currentVersion: APP_VERSION,
      latestVersion: cleanTag || APP_VERSION,
      releaseName: data.name || tagName,
      releaseNotes: data.body || "",
      releaseUrl: data.html_url || RELEASES_PAGE_URL,
      publishedAt: data.published_at,
      assetUrl,
    };
  } catch (err: any) {
    console.warn("Termizen update check failed:", err);
    return {
      updateAvailable: false,
      currentVersion: APP_VERSION,
      latestVersion: APP_VERSION,
      releaseUrl: RELEASES_PAGE_URL,
      error: err?.message || "Failed to reach GitHub release servers",
    };
  }
}
