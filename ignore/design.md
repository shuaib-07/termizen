# Design System: Termizen

Reference spec for how the app looks and the components it's built from. Companion to `plan.md` (architecture/features) — this covers visual language only.

---

## 1. Core Rule: Rounded-Corner Box Theme

Every container, card, panel, tab, button, input, and dropdown uses rounded corners. Nothing in the UI has a hard 90° corner except the outer OS window frame itself.

* **Radius scale** (CSS var `--radius: 0.75rem`, defined in `src/index.css`, consumed via Tailwind's `rounded-sm/md/lg/xl` which derive from it):
  * `rounded-md` (`--radius-md`, ~10px) — buttons, inputs, selects, small chips.
  * `rounded-lg` (`--radius-lg`, 12px) — tab triggers, list rows, the active-pill indicator.
  * `rounded-xl` (`--radius-xl`, ~16px) — top-level containers: pane cards, sidebar panels, macro-run view, tab content wrappers.
* Panels sit with a visible **gap** between them (not edge-to-edge) so the Mica backdrop (§3) shows through the gaps — this is what makes the rounded-box theme actually read as "floating cards over Mica" instead of "one solid rounded rectangle."
* Borders are hairline and low-contrast (`--border: oklch(1 0 0 / 0.09)`, i.e. ~9% white) — corners are defined by radius + subtle border + shadow, not heavy outlines.

## 2. Color Theme

**Dark-only.** No light mode, no toggle — matches `plan.md`'s original "dark-mode native, high contrast" spec and avoids doubling every token. Revisit only if a real user request for light mode shows up.

Tokens live in `src/index.css` as CSS custom properties (`oklch()`), consumed through Tailwind v4's `@theme inline` block as `bg-background`, `text-foreground`, `bg-card`, `bg-muted`, `bg-accent`, `bg-primary`, `bg-destructive`, `border-border`, `ring-ring`, etc. — standard shadcn/ui token names, so any shadcn component drops in without remapping.

| Token | Value | Used for |
|---|---|---|
| `--background` | `oklch(0.17 0.01 260 / 0.55)` | Page root — translucent so Mica shows through |
| `--card` | `oklch(0.21 0.012 260 / 0.7)` | Pane cards, sidebar panels |
| `--popover` | `oklch(0.19 0.012 260 / 0.95)` | Dropdowns/menus — near-opaque, needs to stay legible over anything behind it |
| `--primary` | `oklch(0.62 0.19 260)` | Accent — buttons, active states, focus rings. **Blue**, chosen as a sensible default; swap this one value to re-theme the whole app |
| `--muted` / `--accent` | translucent near-neutral | Secondary surfaces, hover states |
| `--destructive` | `oklch(0.58 0.22 27)` | Delete/stop actions |
| `--border` | `oklch(1 0 0 / 0.09)` | Hairline borders everywhere |

All surface colors (`background`, `card`, `muted`, `accent`, `secondary`) carry alpha — this is deliberate, not a mistake: full opacity would defeat the Mica effect. `popover` is the one near-opaque exception since floating menus need to stay readable regardless of what's behind them.

## 3. Mica Background

Real Windows 11 DWM Mica, not a CSS approximation — CSS has no way to composite the actual desktop backdrop; this has to come from the OS.

**How it's wired (already implemented):**
* `src-tauri/tauri.conf.json` → window config has `"transparent": true`.
* `src-tauri/src/lib.rs` → `.setup()` calls `window_vibrancy::apply_mica(&window, Some(true))` (dark variant) on the main window.
* `src/index.css` → `html, body, #root { background: transparent; }` — if this paints anything opaque, Mica is invisible behind it. Every visible surface must come from a `--background`/`--card`/etc. token with alpha, never a plain opaque color on the root.

**Constraint this creates:** Windows 10 and non-Windows platforms don't have Mica. `apply_mica` no-ops (returns `Err`, swallowed) on unsupported systems rather than crashing — app still works, just renders as a plain (transparent-then-black) window without the backdrop effect. Not handled with a fallback acrylic/blur yet; noted as a gap, not a blocker, since this app is Windows-11-first per `plan.md`.

## 3b. No Glow Effects

**Strict rule: No glow effects anywhere in the app.**
* No neon aura shadows or colored box-shadow glows (e.g. `box-shadow: 0 0 20px rgba(...)`).
* No pseudo-lighting radial gradient blur orbs behind the windows or panels.
* Visual hierarchy is strictly created by: rounded-corner cards, low-contrast hairline borders (`--border: oklch(1 0 0 / 0.09)`), subtle dark elevation shadows (`shadow-sm`, `shadow-md`), and the clean OS-composited Mica backdrop showing between panel gaps.

## 3c. Modals Mica Theme

Every modal dialog in the app follows the Windows 11 dark Mica theme:
* **Backdrop overlay**: `bg-black/50 backdrop-blur-sm` — dims the window without crushing the desktop Mica wallpaper behind it.
* **Modal container card**: `bg-card/85 backdrop-blur-xl border border-border/90 shadow-2xl rounded-2xl` — translucent with backdrop filter so the OS Mica effect and subtle desktop shapes softly show through the modal surface.
* **Header & footer rules**: Subdued hairline divider `border-border/40`.
* **Dismiss interaction**: ESC key listener, backdrop click-to-dismiss, and top-right close icon button.

## 4. UI Primitives & Motion Stack

Added on top of the existing Tauri + React + TS stack:

* **Tailwind CSS v4** via `@tailwindcss/vite` — theme tokens in `src/index.css`'s `@theme inline` block.
* **Transitions.dev Motion Scale**:
  * **Modal Open/Close** (`src/components/ui/modal.tsx`, `.t-modal.is-open / .is-closing`): 250ms open, 150ms close with `scale(0.96) -> scale(1)` and `cubic-bezier(0.22, 1, 0.36, 1)`.
  * **Success Check** (`src/components/ui/success-check.tsx`, `.t-success-check`): 500ms multi-property appear (fade + 80deg rotate + blur + Y-bob + SVG path-draw).
  * **Shimmer Text** (`src/components/ui/shimmer.tsx`, `.t-shimmer`): 2000ms text shimmer gradient for loading/pending states.
  * **Dropdown Menu** (`src/components/ui/select.tsx`, `.t-dropdown`): 250ms open / 150ms close.

### Transitions.dev Reference Implementations

#### 1. Modal Open / Close Transition (`src/components/ui/modal.tsx`)
```css
:root {
  --modal-open-dur: 250ms;
  --modal-close-dur: 150ms;
  --modal-scale: 0.96;
  --modal-scale-close: 0.96;
  --modal-ease: cubic-bezier(0.22, 1, 0.36, 1);
}

.t-modal {
  transform-origin: center;
  will-change: transform, opacity;
}
.t-modal.is-open {
  animation: t-modal-in var(--modal-open-dur) var(--modal-ease) forwards;
}
.t-modal.is-closing {
  animation: t-modal-out var(--modal-close-dur) var(--modal-ease) forwards;
  pointer-events: none;
}

@keyframes t-modal-in {
  from {
    transform: scale(var(--modal-scale));
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

@keyframes t-modal-out {
  from {
    transform: scale(1);
    opacity: 1;
  }
  to {
    transform: scale(var(--modal-scale-close));
    opacity: 0;
  }
}

.t-modal-backdrop {
  will-change: opacity, backdrop-filter;
}
.t-modal-backdrop.is-open {
  animation: t-backdrop-in var(--modal-open-dur) var(--modal-ease) forwards;
}
.t-modal-backdrop.is-closing {
  animation: t-backdrop-out var(--modal-close-dur) var(--modal-ease) forwards;
  pointer-events: none;
}
```

#### 2. Success Check Appear Transition (`src/components/ui/success-check.tsx`)
```css
:root {
  --check-opacity-dur: 500ms;
  --check-rotate-dur: 500ms;
  --check-rotate-from: 80deg;
  --check-bob-dur: 500ms;
  --check-y-amount: 40px;
  --check-blur-dur: 500ms;
  --check-blur-from: 10px;
  --check-path-dur: 500ms;
  --check-path-delay: 80ms;
  --check-ease-out: cubic-bezier(0.22, 1, 0.36, 1);
  --check-ease-opacity: cubic-bezier(0.22, 1, 0.36, 1);
  --check-ease-rotate: cubic-bezier(0.22, 1, 0.36, 1);
  --check-ease-bob: cubic-bezier(0.34, 1.35, 0.64, 1);
  --check-ease-path: cubic-bezier(0.22, 1, 0.36, 1);
}

.t-success-check {
  display: inline-block;
  transform-origin: center;
  opacity: 0;
  will-change: transform, opacity, filter;
}
.t-success-check svg { display: block; overflow: visible; }
.t-success-check svg path {
  stroke-dasharray: 20;
  stroke-dashoffset: 20;
}
.t-success-check[data-state="in"] {
  animation:
    t-check-fade   var(--check-opacity-dur) var(--check-ease-opacity) forwards,
    t-check-rotate var(--check-rotate-dur)  var(--check-ease-rotate)  forwards,
    t-check-blur   var(--check-blur-dur)    var(--check-ease-out)     forwards,
    t-check-bob    var(--check-bob-dur)     var(--check-ease-bob)     forwards;
}
.t-success-check[data-state="in"] svg path {
  animation: t-check-draw var(--check-path-dur) var(--check-ease-path) var(--check-path-delay, 0ms) forwards;
}
```

#### 3. Shimmer Text Loading State (`src/components/ui/shimmer.tsx`)
```css
:root {
  --shimmer-dur: 2000ms;
  --shimmer-base: #6e6e6e;
  --shimmer-highlight: #ededed;
  --shimmer-band: 400%;
  --shimmer-ease: linear;
}

.t-shimmer {
  position: relative;
  display: inline-block;
  color: var(--shimmer-base);
}
.t-shimmer::before {
  content: attr(data-text);
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image: linear-gradient(
    90deg,
    transparent          0%,
    transparent         40%,
    var(--shimmer-highlight) 50%,
    transparent         60%,
    transparent        100%
  );
  background-size: var(--shimmer-band) 100%;
  background-repeat: no-repeat;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  -webkit-text-fill-color: transparent;
  animation: t-shimmer var(--shimmer-dur) var(--shimmer-ease) infinite;
}
@keyframes t-shimmer {
  0%   { background-position: 100% 0; }
  100% { background-position: 0% 0; }
}
```
* **shadcn/ui-style primitives** in `src/components/ui/`: `button.tsx`, `input.tsx`, `select.tsx`, `card.tsx`, `tabs.tsx`, `modal.tsx`, `shimmer.tsx`, `success-check.tsx`.
* **Radix UI** (`@radix-ui/react-tabs`, `@radix-ui/react-slot`, `@radix-ui/react-select`).
* **framer-motion** — sliding active pills, spring expand/collapse.
* **lucide-react** — icons.
* **`cn()` helper** (`src/lib/utils.ts`).
* **lucide-react** — icons (currently just `ChevronRight` for list expand carets).
* **`ldrs`** — the app's loader (`Trefoil`), wrapped once in `src/components/Loader.tsx`. See §5's `Loader.tsx` entry.
* **`@/` path alias** → `src/` (configured in `vite.config.ts` + `tsconfig.json`), matching shadcn convention (`@/components/...`, `@/lib/utils`).
* **`cn()` helper** (`src/lib/utils.ts`, `clsx` + `tailwind-merge`) — every styled component's `className` prop should merge through `cn()`, not string-concatenate.

## 5. Custom Components

Two composite components in `src/components/` (not `ui/` — they're app-specific patterns, not generic primitives):

### `NativeTabs.tsx`
Generic animated pill-tab group: `items: {id,label,content}[]` in, a `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent` group out, with a `layoutId`-based framer-motion pill that slides between the active trigger. **Not** what drives the app's main horizontal tab bar — that has per-tab close buttons, a dynamic tab set, and a "+" trigger that this items-array API doesn't model. `TabBar.tsx` uses the same underlying primitives directly instead. Keep `NativeTabs` around for simpler fixed tab groups (e.g. a future Settings dialog).

One correctness fix versus the version it was adapted from: `TabsContent` now has `forceMount` + `data-[state=inactive]:hidden`. Without `forceMount`, Radix unmounts inactive tab panels from the DOM entirely — for any panel holding live state (a form draft, a connection, anything) that's a bug, not a style choice.

### `NativeNestedList.tsx`
Recursive collapsible tree list (folder → children, spring-animated expand/collapse, active-item dot indicator). Drives:
* The **vertical tab bar** (when horizontal/vertical is toggled) — flat list, no children, one entry per open tab.
* The **profile sidebar** — real `Folder → Profile` nesting via `children`, upgrading the flat folder-tag grouping the pre-restyle sidebar used.

One addition versus the version it was adapted from: an optional `actions?: React.ReactNode` field on `ListItem`, rendered right-aligned inside the row with its own click-stop so it doesn't trigger the row's `onItemClick`. This is what makes it usable for closable tabs and deletable profiles without forking the component — the pasted version had no trailing-action slot.

### `NativeDelete.tsx`
Two-step confirm-to-delete button: click once shows a "Confirm" state (icon/text swap) plus a Cancel button, click again actually deletes. Used for **profile delete** and **macro delete** only — the two actions that destroy persisted data (a SQLite row, gone for good). Deliberately *not* used for tab/pane close, which just ends a view (SSH session ends, nothing persisted is lost, always reopenable) — a confirm step there would be friction on a very frequent, fully-reversible action.

Adapted from a pasted version built on `@base-ui/react`'s `Button` with a `nativeButton` prop. Checked against the real package (`@base-ui/react` is real, current, actively published — not to be confused with the deprecated `@base-ui-components/react`): its `Button` type has no `nativeButton` prop, and it already renders a plain `<button>` by default, so the prop wouldn't have compiled and the library would've added nothing this app's own `Button` (`@/components/ui/button`) doesn't already do. Swapped to our own `Button` — same animation, same props (`onConfirm`, `onDelete`, `buttonText`, `confirmText`, `size`, `showIcon`, `disabled`), zero new dependency.

Follow-up tuning: idle state is icon-only (a bare red trash-can outline, no background/pill), morphing into a compact "Confirm" pill + small X cancel on click — not a full-size labeled button at rest, since this sits inline in list rows.

### `AnimatedBadge.tsx`
Status pill (`neutral`/`info`/`success`/`warning`/`danger`/`loading`) with an animated icon+label roll on status change (spring-driven blur/slide, matching the rest of the app's motion language) and an optional pulse ring for `loading`. Backed by `src/lib/ease.ts`'s shared easing/spring tokens (`EASE_OUT`, `SPRING_*`) — pull from there for any new motion work instead of inlining transition values, so animations stay consistent app-wide.

Wired in so far:
* **Pane header connection status** (`PaneView.tsx`) — `Terminal.tsx` gained an `onStatusChange?: (status: "connecting"|"connected"|"error") => void` callback, fired once synchronously when a session starts spawning and again on success/failure. Renders as a `loading`/`success`/`danger` badge next to the pane title. This is the literal "terminal status" use case.
* **Macro run status** (`MacroRunView.tsx`) — the overall run badge (`loading` while steps are executing, `success`/`danger` once `macro-exit` fires) replaces what used to be a plain colored text string. Each step in the left-hand step list also got its own small badge (`loading` while running, exit code as the label once done) in place of the old `▶`/`✓`/`✗` unicode glyphs.

Adapted: the pasted version imported from `motion/react` (the newer unified `motion` package). Checked — `framer-motion` (already the app's only motion dependency) re-exports everything this component needs (`Variants`, `HTMLMotionProps`, `useReducedMotion`, etc., verified via the installed package's actual type exports, which flow through from its `motion-dom` dependency) — same team, same API. Swapped the import to `framer-motion` rather than installing a second, near-identical animation library for one component.

**Other places this would fit well** (not wired up yet — flagged as suggestions, not built without being asked):
* **`ProfileSidebar.tsx`** — a small `neutral` badge per profile showing `ssh`/`local`, or the auth method (`password`/`key`). Currently that information exists only in data, not shown anywhere in the tree.
* **`MacrosPanel.tsx`** — swap the plain `(exec)`/`(pty)` text suffix next to each macro name for a tiny `neutral`/`info` badge chip. Cosmetic, low effort.
* **Profile reachability** — a `success`/`danger`/`neutral` badge per profile showing last-known reachability, once/if a keepalive or ping check exists (plan.md's deferred keepalive/auto-reconnect feature). Not buildable yet since there's no underlying health-check mechanism.
* **Vault lock state** — if the optional Master PIN / idle-lock feature from plan.md §4 ever ships, a small `info`/`warning` badge in the nav rail showing locked/unlocked would be a natural fit.

### `AnimatedCombobox.tsx` (`src/components/ui/combobox.tsx`)
Fully reusable, spring-animated dropdown combobox built with Framer Motion, Windows 11 Fluent 2 Mica glassmorphism (`backdrop-blur-2xl`, `bg-zinc-950/95`, hairline `border-white/[0.08]`), and full keyboard/mouse navigation.

#### Features:
* **Spring-Physics Dropdown Animation**: Uses `SPRING_PANEL` (`stiffness: 420, damping: 30, mass: 0.8`) with `initial={{ opacity: 0, y: -6, scale: 0.98 }}` and `animate={{ opacity: 1, y: 0, scale: 1 }}` with `transformOrigin: "top center"`.
* **Instant Type-Ahead Search**: Filters options in real-time by label or secondary description.
* **Inline Entity Creation (`allowCreate`)**: When typing a query with no exact match, dynamically presents `+ <createPrefix> "<query>"` to create and persist entities on the fly (used for creating folders in Server and Macro forms).
* **Dedicated Secondary Action (`onCreateNew`)**: Supports an optional bottom action trigger, such as `+ Create a new server...`, to launch secondary creation modals directly from the picker.
* **Visual Identifiers**: Supports folder color dots (`item.color`), entity icons (`item.icon`), subtitle descriptions (`item.description`), and selection checkmarks (`Check`).
* **Clear Selection (`clearLabel`, `clearValue`)**: Provides optional one-click clearing (e.g. "No Folder (Root)").
* **Keyboard Accessibility**: Auto-focuses search input on open, closes on ESC or outside click, and supports Enter key selection/creation.

#### Interface:
```tsx
export interface ComboboxItem {
  value: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  color?: string;
}

export interface AnimatedComboboxProps {
  value?: string;
  onChange: (value: string) => void;
  items: ComboboxItem[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  allowCreate?: boolean;
  createPrefix?: string;
  onCreateNew?: () => void;
  createNewText?: string;
  clearLabel?: string;
  clearValue?: string;
  className?: string;
  disabled?: boolean;
  icon?: React.ReactNode;
}
```

### Universal Dropdown Spring Motion Standard (`.t-dropdown`)
Every dropdown across the application adheres to a unified spring motion standard that matches `AnimatedCombobox`:
* **Motion Tokens**:
  * Open duration: `200ms` with spring ease `cubic-bezier(0.16, 1, 0.3, 1)`.
  * Close duration: `140ms` with ease `cubic-bezier(0.4, 0, 1, 1)`.
  * Scale and translation delta: `scale(0.98)` and `translateY(-6px)` popping into `scale(1)` and `translateY(0)`.
* **Integrated Dropdowns**:
  1. **`AnimatedCombobox`** (`src/components/ui/combobox.tsx`): Spring-physics panel.
  2. **Radix `Select`** (`src/components/ui/select.tsx`): `SelectContent` adopts `.t-dropdown` and Mica glass styling (`bg-zinc-950/95`, `backdrop-blur-2xl`, `rounded-xl`).
  3. **Radix `DropdownMenu`** (`src/components/ui/dropdown-menu.tsx`): `DropdownMenuContent` uses `.t-dropdown`.
  4. **`ColorPicker`** (`src/components/ui/color-picker.tsx`): Popover uses `SPRING_PANEL` matching the combobox.
  5. **`ContextMenu`** (`src/components/ui/context-menu.tsx`): Morphing context menu drawer.
* **Accessibility**: Respects `prefers-reduced-motion: reduce` by disabling transforms and transitions instantly.

### `Loader.tsx`
Single wrapper around `ldrs`' `Trefoil` React component (`ldrs/react`) — the app's one loading spinner, so color/sizing stay consistent instead of being re-specified at each call site. The library's own default (`color="black"`) is invisible on this dark theme, pinned to `var(--primary)` here instead.

Deliberately **not** used for `AnimatedBadge`'s `loading` status icon (pane connecting, macro run/step status) — that's a different visual language (a spinning `lucide-react` icon inside a status pill) and stays as-is. `Loader` is for standalone/blocking wait states instead:
* **Full-window startup splash** (`App.tsx`) — shown until the initial `listProfiles`/`listMacros` fetch resolves, replacing the app's root render entirely rather than showing a half-initialized UI.
* **Macro-run button pending state** (`PaneView.tsx`'s `MacroRunner`) — this button previously had no visual feedback at all while a PTY macro was running (just quietly disabled); now shows `Loader` in place of the play icon.

### `FeedbackAction.tsx` (`src/components/ui/feedback-action.tsx`)
Spring-animated refresh / restart / resync button and inline feedback pill. Features:
* **Staggered Letter Animation** (`AnimatedText`): Individual characters morph with staggered spring delays (`delayStep: 0.014s`, `stiffness: 240, damping: 16`), sliding up/down on text change.
* **PopLayout State Morphing**: Smoothly shifts between `idle`, `loading`, `error`, and `success` with popLayout exit/enter transitions.
* **Action Trigger**: Dedicated round pop-in retry/restart button with spring pop (`stiffness: 260, damping: 20`) that triggers async refetch/resync workflows.
* **Mica & Dark Theme Native**: Uses translucent pills (`bg-card/70 border-border/60 rounded-full`) with status-tinted borders and icons (`lucide-react`).

```tsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, MotionConfig } from 'framer-motion';
import { AlertCircle, Loader2, RotateCw } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface FeedbackActionProps {
  status?: 'error' | 'loading' | 'idle' | 'success';
  errorMessage?: string;
  loadingMessage?: string;
  successMessage?: string;
  idleMessage?: string;
  size?: 'sm' | 'md' | 'lg';
  onRetry?: () => void | Promise<void>;
  className?: string;
  autoTimeout?: boolean;
}
```

### `Tooltip.tsx` (`src/components/ui/tooltip.tsx`)
Spring-animated and clip-path sliding tooltip primitives:
1. **`Tooltip` (Standalone Component)**:
   - Spring-driven scale, opacity, and blur animations (`stiffness: 350, damping: 25`).
   - Supports directional placement (`top`, `bottom`, `left`, `right`) and hotkey chips (`hotkey="Ctrl+T"`).
   - Applied to TabBar actions, Log console buttons, Server Dashboard action buttons, and Pane split/close controls.
2. **`TooltipVerticalNavbar` (Sliding Clip-Path Tooltip Bar)**:
   - Uses geometric calculation (`clipPath: inset(cTop% 0 cBottom% 0 round 8px)` and `translateY: iconCenter - labelCenter`).
   - Glides a single unified tooltip pill smoothly across vertical icons with a spring transition without unmounting/remounting flicker.

### `DigitSwap.tsx` & `PasswordInput.tsx` (`src/components/ui/digit-swap.tsx`, `password-input.tsx`)
Staggered rolling glyph animation for password hide/unhide and numeric value transitions:
* **Per-Glyph Staggered Slide**: Individual characters morph via `translateY(45% -> 0% -> -45%)` with staggered delays (`stagger: 0.006s`, `duration: 0.18s`, `ease: EASE_OUT`).
* **Fixed-Slot Character Cells**: Fixed-width slots (`1ch`) prevent layout jitter or horizontal popping during character swaps.
* **`PasswordInput` Component**: Drop-in replacement for password inputs featuring:
  - Interactive reveal eye toggle button (`Eye` / `EyeOff`) with Tooltip.
  - Smoothly morphs between masked bullet glyphs (`••••••••`) and plaintext characters on reveal toggle.
  - Automatically wired into Server Form Modal, Key Vault, Quick Connect, and SSH connection panels.

```tsx
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { EASE_OUT } from "@/lib/ease";
import { cn } from "@/lib/utils";

export type DigitSwapDirection = "up" | "down";

export interface DigitSwapProps {
  value: string | number;
  animationKey?: string | number;
  direction?: DigitSwapDirection;
  duration?: number;
  stagger?: number;
  suffixLength?: number;
  className?: string;
  glyphClassName?: string;
  suffixClassName?: string;
}
```

### `ContextMenu.tsx` (`src/components/ui/context-menu.tsx`)
Morphing clip-path animated context menu component inspired by `beui.dev` and customized for Mica theme:
* **Clip-Path Morphing Expansion**: Morphs from an initial collapsed point (`inset(...)`) out to full rounded bounding box with `EASE_OUT` and motion reduced compliance.
* **Touch & Pointer Modality**:
  - Touch/Pen support: Long-press trigger (`LONG_PRESS_DELAY: 520ms`, `LONG_PRESS_TOLERANCE: 10px`) with selection suppression (`holdSelection`).
  - Mouse right-click (`onContextMenu`) and keyboard summoning (`ContextMenu` key or `Shift+F10`).
* **Active Indicator Glide**: `layoutId={`${menuId}-active`}` pill glides smoothly across focused items using `SPRING_LAYOUT`.
* **Keyboard Navigation & Typeahead**: Full arrow key traversal (`ArrowUp`/`ArrowDown`/`Home`/`End`), escape dismissal, and alphanumeric typeahead search across menu items.
* **Mica & Glassmorphic Backdrop**: Rendered via `createPortal` into `document.body` with `bg-card/95 backdrop-blur-xl border border-white/10 [filter:drop-shadow(...)]`.
* **Sidebar Integration**: Integrated into `ProfileSidebar.tsx` and `NativeNestedList.tsx` for server profile management:
  - **Connect (Terminal)** (`Terminal`, shortcut `Enter`)
  - **Live Status Charts** (`Activity`)
  - **Live Service Logs** (`FileText`)
  - **Pin for Background Monitoring** (`Pin`, toggles active background monitoring)
  - **Edit Server Connection…** (`Pencil`)
  - **Delete Server** (`Trash2`, `tone="destructive"`)

```tsx
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuCheckboxItem,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
} from "@/components/ui/context-menu";
```

### `AnimatedToastStack.tsx` (`src/components/ui/animated-toast-stack.tsx`)
Spring-animated stacked toast notification system from `beui.dev` tailored for dark Mica theme:
* **Physics & Stack Layout**: `STACK_SPRING` (`stiffness: 420, damping: 34`) with smooth scale/blur entrance and swipe-to-dismiss drag physics (`drag="x"`, `dragElastic: 0.18`).
* **Auto-Dismiss & Queue Management**: Timers update dynamically with individual toast lifecycles (`defaultDuration: 4000ms`, `limit: 5`).
* **Toast Statuses**:
  - `neutral`: subtle primary tint, bell icon.
  - `info`: blue/primary status pill.
  - `success`: emerald status pill with checkmark.
  - `loading`: spinning loader indicator.
  - `error`: red destructive status pill.
* **Global Provider & Hook**:
  - `<ToastProvider>` wraps the application shell in `App.tsx`.
  - `const { toast, dismiss, clear } = useToast()` allows dispatching toasts anywhere across modals, forms, and handlers.

```tsx
import {
  ToastProvider,
  useToast,
  AnimatedToastStack,
  useAnimatedToastStack,
} from "@/components/ui/animated-toast-stack";
```

### `DropdownMenu.tsx` (`src/components/ui/dropdown-menu.tsx`)
Animated Radix UI dropdown menu system with floating active highlight pill and spring transitions:
* **Motion Hover Indicator (`DropdownMenuHighlight`)**: Uses `layoutId="dropdown-menu-highlight"` to smoothly glide an active background pill (`bg-white/[0.08]`) between items using `SPRING_LAYOUT` physics.
* **Radix UI Primitives Integration**:
  - `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuGroup`
  - `DropdownMenuItem`, `DropdownMenuCheckboxItem`, `DropdownMenuRadioGroup`, `DropdownMenuRadioItem`
  - `DropdownMenuLabel`, `DropdownMenuSeparator`, `DropdownMenuShortcut`
  - `DropdownMenuSub`, `DropdownMenuSubTrigger`, `DropdownMenuSubContent`
* **Mica & Dark Theme Native**:
  - `bg-zinc-950/98 backdrop-blur-2xl border border-white/[0.08] shadow-2xl text-foreground rounded-xl p-1.5`
  - Accessible keyboard navigation (arrows, typeahead, escape, sub-menus).

```tsx
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
```

### `DirectionAwareTabs.tsx` (`src/components/ui/direction-aware-tabs.tsx`)
Direction-aware animated tab bar with dynamic auto-height container and sliding spring bubble indicator:
* **Direction-Aware Sliding Transitions**: Content smoothly translates and fades (`x: 200 * direction`, `filter: "blur(4px)"` $\to$ `0`) depending on whether the user selects a tab to the left or right of the active index.
* **Spring Layout Bubble Pill**: Active tab indicator with `layoutId="direction-aware-tabs-bubble"` tracks selection changes using spring animation physics (`bounce: 0.19, duration: 0.4s`).
* **Dynamic Auto-Height Container**: Integrates `react-use-measure` and `MotionConfig` to smoothly resize the parent container height to match varying panel content heights without abrupt layout jumps.
* **Dark Mica Theming**: Capsule / rounded pill options (`rounded="rounded-lg"`, `roundedInner="rounded-md"`), `bg-zinc-900/90 border border-white/[0.08]` pill rail, and glowing indicator border.
* **Live Integrations**:
  - **Header Subview Tabs** (`PaneView.tsx`): Direction-aware tab switcher for **Terminal**, **Status Charts**, and **Live Logs** with distinct Lucide icon badges and spring bubble indicator.
  - **Service Log Stream Tabs** (`ServiceLogViewer.tsx`): Tab bar for live PM2, Docker, and systemd service streams with close buttons (`X`) and real-time active tab tracking.

```tsx
import { DirectionAwareTabs, type Tab } from "@/components/ui/direction-aware-tabs";

const TABS: Tab[] = [
  { id: 0, label: "Overview", content: <OverviewContent /> },
  { id: 1, label: "Metrics", content: <MetricsContent /> },
  { id: 2, label: "Logs", content: <LogsContent /> },
];

<DirectionAwareTabs tabs={TABS} onChange={(id) => console.log(id)} />
```

### `FloatingPanel.tsx` (`src/components/ui/floating-panel.tsx`)
Animated spring popover floating panel system for quick actions, color pickers, notes, and interactive tool popups:
* **Spring Layout & Entrance Physics**: Uses `SPRING_PANEL` (`stiffness: 420, damping: 40, mass: 0.5`) with scale/opacity/y-translation transitions and `SPRING_PRESS` on button click interactions.
* **Dismiss & Keyboard Accessibility**: Built-in outside-click dismiss and Escape key handlers with focus and trigger ref management.
* **Dark Mica Popover Styling**: `bg-zinc-950/98 backdrop-blur-2xl border border-white/[0.08] shadow-2xl text-foreground rounded-xl p-3`.
* **Compound Primitives**:
  - `FloatingPanelRoot`: Context provider with controlled/uncontrolled state and render prop function support `({ setIsOpen }) => ...`.
  - `FloatingPanelTrigger`: Anchors panel opening to any button or interactive element.
  - `FloatingPanelContent`: Animated popover container (`align="start" | "center" | "end"`).
  - `FloatingPanelHeader`, `FloatingPanelBody`, `FloatingPanelFooter`: Standardized panel sections.
  - `FloatingPanelForm`, `FloatingPanelLabel`, `FloatingPanelTextarea`: Form workflow controls.
  - `FloatingPanelButton`, `FloatingPanelCloseButton`, `FloatingPanelSubmitButton`: Action triggers with spring press physics.
* **Live Integration**:
  - **Terminal Macro Runner Panel** (`PaneView.tsx`): Replaced static select dropdown with an interactive Floating Panel allowing search/filtering, step previews, and 1-click execution of PTY macros directly into active SSH/local terminal sessions.

```tsx
import {
  FloatingPanelRoot,
  FloatingPanelTrigger,
  FloatingPanelContent,
  FloatingPanelHeader,
  FloatingPanelBody,
  FloatingPanelFooter,
  FloatingPanelButton,
  FloatingPanelCloseButton,
} from "@/components/ui/floating-panel";
```

### `Checkbox.tsx` (`src/components/ui/checkbox.tsx`)
Motion-driven animated checkbox component with spring press tactile feedback, SVG path drawing, and indeterminate support:
* **Micro-Motion Physics**:
  - **Press Spring**: Uses `SPRING_PRESS` (`stiffness: 500, damping: 30, mass: 0.6`) with `whileTap={{ scale: 0.92 }}` for responsive haptic press feedback.
  - **SVG Path Drawing**: Checkmark (`M5 13l4 4L19 7`) and indeterminate line (`M6 12h12`) animate using Framer Motion `pathLength: 0 -> 1` with `EASE_OUT` (`[0.16, 1, 0.3, 1]`) and entry scale/fade.
  - **Exit Blur**: Exits smoothly with `opacity: 0, scale: 0.5, filter: "blur(4px)"` over 160ms.
  - **Reduced Motion**: Full `useReducedMotion()` support, bypassing scale/blur/pathLength animations instantly for accessibility.
* **Accessible & Fluent 2 Native**:
  - Semantic `role="checkbox"` button bound to an accessible label container with `htmlFor={id}`.
  - Active state: `border-primary bg-primary text-primary-foreground`.
  - Inactive state: `border-muted-foreground/40 bg-background/60 hover:border-muted-foreground`.
  - Accessible focus rings: `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`.
  - Supports `aria-checked`, `aria-label`, `aria-describedby`, `disabled`, and `indeterminate`.
* **Universal App Adoption**:
  - **Close Confirmation Prompt** (`ClosePromptModal.tsx`): Replaced native checkbox with animated Checkbox for *"Remember my choice and don't ask again"*.
  - **Add/Edit Server Modal** (`ServerFormModal.tsx`): Replaced native checkbox for *"Save this key to Key Vault for reuse"*.
  - **Macro Editor Tab** (`MacroEditorView.tsx`): Replaced native checkbox for *"Halt on non-zero exit"*.

```tsx
import { Checkbox } from "@/components/ui/checkbox";

<Checkbox
  checked={isChecked}
  onCheckedChange={setIsChecked}
  label="Remember my choice and don't ask again"
/>
```




## 5b. Sidebar: Profiles + Macros Tabs, Macro Creation Moved to a Main Tab

The left sidebar (`Sidebar.tsx`) is now a small tabbed switcher (Profiles / Macros) over one `Card`, using the same `Tabs`/`TabsList`/`TabsTrigger` primitives + animated pill pattern as `TabBar.tsx`'s horizontal mode — reusing the pattern rather than `NativeTabs`, since `NativeTabs`'s own content wrapper (padded card, `max-w-md`) doesn't fit a full-height sidebar column.

**Macro creation moved out of the sidebar entirely.** The old inline form (name/mode/checkbox/textarea all cramped into a ~250px-wide column) is gone; `MacrosPanel.tsx` is now list-only (name, run mode, assigned profile if any, delete). Clicking "+" opens a new **main tab** (`TabContentState`'s `"macro-editor"` kind → `MacroEditorView.tsx`) with the same fields laid out in a proper two-column form and a 16-row monospace textarea — the space a multi-line deploy script actually needs. Saving or cancelling closes that tab via a new `onCloseTab` callback threaded `App.tsx → PaneView → TabContent`.

**Macros can be assigned to a profile, or left global.** `macros` gained a nullable `profile_id` column (`ALTER TABLE ... ON DELETE SET NULL`, so deleting a profile un-assigns its macros rather than deleting them). `NULL` = global, shown everywhere; set = scoped to that one profile. Applies to **both** run modes:
* **Exec-mode** — the profile-sidebar's per-profile macro picker only lists exec macros where `profileId == null || profileId === thatProfile.id`.
* **PTY-mode** — a pane's macro-run picker filters the same way, keyed off the pane's own `profileId` (new: `TabContentState`'s `"ssh"`/`"local"` variants now carry an optional `profileId`, set whenever the pane traces back to a saved profile — opened from the sidebar, or created via "Save & Connect" / "Save local profile"). Ad-hoc connections and ephemeral local shells have no `profileId`, so they only ever see global PTY macros — there's no profile to scope them to.

The `macroAppliesToProfile(macro, profileId)` helper in `sessions.ts` is the single filter predicate both pickers use, so the "global or exact match" rule can't drift between them.

**Macros are now editable**, not just create-or-delete. `MacrosPanel.tsx` rows got a pencil button (`onEditMacro`) alongside delete; it opens the same `"macro-editor"` tab kind used for creation, but with `macroId` set. `MacroEditorView.tsx` branches on whether `macroId` resolves to an existing macro (looked up from the `macros` list already in scope, no extra round-trip for the metadata) — pre-fills name/mode/halt-on-error/profile from that, and fetches the step list via `getMacroSteps` in a `useEffect` (shows `Loader` until that resolves, since it's the one genuinely async part of opening the editor). Saving calls the new `macro_update` Tauri command (backend: full `UPDATE` + `DELETE`+re-`INSERT` of `macro_steps` in one transaction) instead of `macro_save` — a full replace, not a diff, matching how the textarea already treats steps as one wholesale block rather than an editable list with per-row identity. The routing between create/update lives in one place: `App.tsx`'s `handleSaveMacro(params, macroId?)` picks `updateMacro` vs `saveMacro` based on whether `macroId` is present, so `MacroEditorView`/`TabContent`/`PaneView` don't need to know or care which one is happening.

**Macros can also be assigned to a folder** (`macros.folder`, same flat-tag string model `profiles.folder` already used — shares the namespace, so a folder named "Zoopify" can hold both profiles and macros tagged with that name). Unlike the profile assignment above, this one only matters for *display*: `ProfileSidebar.tsx`'s tree now merges macros into the same folder nodes as profiles. Only folder-assigned macros show there — global (folder-less) macros stay exclusively in the Macros tab, not duplicated at the tree's top level, since top-level profile-tree real estate is scarce and "every global macro" would drown out the profiles it's meant to organize alongside. Clicking a macro entry in that tree opens it for editing (same action as the pencil button in `MacrosPanel.tsx`) rather than trying to run it — there's no unambiguous "run against what" answer from inside a mixed folder, since exec macros need a specific profile and PTY macros need a specific open tab, neither of which a folder node implies.

**Profiles, macros, and folders now have distinct icons**, everywhere all three can appear: `Server` (profiles), `Zap` (macros), `Folder` (folder nodes) in `ProfileSidebar.tsx`'s tree and `MacrosPanel.tsx`'s list; the same `Server`/`Zap` pair on the Sidebar's Profiles/Macros switcher tabs (`Sidebar.tsx`). The main open-session tab bar (`TabBar.tsx`, both orientations) also shows a per-tab icon now, keyed off `TabContentState.kind` rather than profile-vs-macro: `Plus` (unconnected "connect" tab), `Terminal` (local shell), `Server` (SSH session — intentionally the same icon as an SSH profile, since that's what it is), `Zap` (macro-run), `Pencil` (macro-editor). For a split tab (two panes, potentially different kinds), the icon just reflects the first pane — not worth trying to represent two kinds in one glyph.

## 6. How the Existing Tab-Content-Survival Mechanism Interacts With This

The app's core guarantee — switching away from a tab doesn't kill its SSH/PTY session — was built (pre-restyle) as a plain `display: tab.id === activeId ? "block" : "none"` map in `App.tsx`, with every tab's content always mounted. That mechanism is **unchanged** by this restyle. `TabBar`'s new Radix/NativeNestedList-based chrome only decides *which tab id is active*; it does not own content mounting/unmounting the way `NativeTabs`'s self-contained `TabsContent` does. This was a deliberate integration choice, not an oversight: letting Radix `Tabs.Content` own panel-switching for a dynamic, closable, cross-orientation tab set would mean re-deriving the exact hidden/mounted semantics `App.tsx` already has working and tested — simpler to keep that one mechanism and only swap the visual selector on top of it.

## 7. Deferred / Not Done This Pass

* Light mode (see §2 — dark-only by decision, not oversight).
* Fallback backdrop (acrylic/blur/solid) for non-Mica-capable systems (Windows 10, other OSes).
* Full shadcn CLI adoption (`components.json`, CLI-managed updates) — primitives were hand-authored to the same conventions instead, to avoid the CLI's interactive setup fighting a non-standard (Tauri, not Next.js) project layout. Low risk to switch to CLI-managed later since the API surface matches.
