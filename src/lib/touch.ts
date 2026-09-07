export const TOUCH_GESTURE_CONTENT_CLASS = "touch-manipulation";

/**
 * Temporarily disables text selection on an element during touch/pointer interactions,
 * returning a cleanup function to restore previous userSelect state.
 */
export function holdSelection(element: HTMLElement | null): () => void {
  if (!element) return () => {};
  const prevUserSelect = element.style.userSelect;
  element.style.userSelect = "none";
  return () => {
    element.style.userSelect = prevUserSelect;
  };
}
