export type AppCloseBehavior = "ask" | "background" | "quit";

const STORAGE_KEY = "termizen_close_behavior";

/**
 * Retrieves the stored close behavior preference.
 * - "ask": Show confirmation prompt dialog (Default)
 * - "background": Silently minimize to system tray and keep background tasks alive
 * - "quit": Close completely
 */
export function getStoredCloseBehavior(): AppCloseBehavior {
  if (typeof window === "undefined") return "ask";
  const val = localStorage.getItem(STORAGE_KEY);
  if (val === "background" || val === "quit") {
    return val;
  }
  return "ask";
}

/**
 * Stores the user's close behavior preference.
 */
export function setStoredCloseBehavior(behavior: AppCloseBehavior): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, behavior);
  window.dispatchEvent(
    new CustomEvent("termizen-close-behavior-changed", { detail: behavior })
  );
}

/**
 * Resets the close behavior preference back to "ask".
 */
export function resetStoredCloseBehavior(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(
    new CustomEvent("termizen-close-behavior-changed", { detail: "ask" })
  );
}
