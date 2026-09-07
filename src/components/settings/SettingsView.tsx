"use client";

import { useState, useEffect } from "react";
import {
  Palette,
  Sparkles,
  Monitor,
  Layers,
  Check,
  Cpu,
  HelpCircle,
  Minimize2,
  Power,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ColorPicker } from "@/components/ui/color-picker";
import {
  getStoredCloseBehavior,
  setStoredCloseBehavior,
  resetStoredCloseBehavior,
  type AppCloseBehavior,
} from "@/lib/closeSettings";

export type ThemeMode = "sefirah" | "deep-blue" | "neutral";
export type AccentMode = string;

export function resolveAccentHex(accent: string): string {
  if (!accent) return "#3B82F6";
  if (accent === "blue") return "#3B82F6";
  if (accent === "lavender") return "#A855F7";
  if (accent.startsWith("#")) return accent.toUpperCase();
  return "#3B82F6";
}

export function isLightColor(hex: string): boolean {
  const cleanHex = hex.replace("#", "");
  const r = parseInt(cleanHex.substring(0, 2), 16) || 0;
  const g = parseInt(cleanHex.substring(2, 4), 16) || 0;
  const b = parseInt(cleanHex.substring(4, 6), 16) || 0;
  // Perceived brightness formula (YIQ)
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 160;
}

export function getStoredTheme(): ThemeMode {
  if (typeof window === "undefined") return "sefirah";
  return (localStorage.getItem("termizen_theme") as ThemeMode) || "sefirah";
}

export function getStoredAccent(): AccentMode {
  if (typeof window === "undefined") return "#3B82F6";
  const stored = localStorage.getItem("termizen_accent");
  if (!stored) return "#3B82F6";
  return resolveAccentHex(stored);
}

export function applyTheme(theme: ThemeMode, accent: AccentMode) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", theme);
  const hex = resolveAccentHex(accent);
  document.documentElement.setAttribute("data-accent", hex);
  localStorage.setItem("termizen_theme", theme);
  localStorage.setItem("termizen_accent", hex);

  // Directly set CSS variables on document.documentElement.style
  document.documentElement.style.setProperty("--primary", hex);
  document.documentElement.style.setProperty("--ring", `${hex}66`);

  const isLight = isLightColor(hex);
  document.documentElement.style.setProperty(
    "--primary-foreground",
    isLight ? "#09090b" : "#ffffff"
  );
}

export default function SettingsView() {
  const [theme, setTheme] = useState<ThemeMode>(getStoredTheme);
  const [accent, setAccent] = useState<AccentMode>(getStoredAccent);
  const [closeBehavior, setCloseBehavior] = useState<AppCloseBehavior>(getStoredCloseBehavior);

  useEffect(() => {
    applyTheme(theme, accent);
  }, [theme, accent]);

  useEffect(() => {
    const handleStorage = () => {
      setCloseBehavior(getStoredCloseBehavior());
    };
    window.addEventListener("termizen-close-behavior-changed", handleStorage);
    return () => {
      window.removeEventListener("termizen-close-behavior-changed", handleStorage);
    };
  }, []);

  const handleSelectTheme = (newTheme: ThemeMode) => {
    setTheme(newTheme);
    applyTheme(newTheme, accent);
  };

  const handleSelectAccent = (newAccent: AccentMode) => {
    setAccent(newAccent);
    applyTheme(theme, newAccent);
  };

  const handleSelectCloseBehavior = (b: AppCloseBehavior) => {
    setCloseBehavior(b);
    setStoredCloseBehavior(b);
  };

  const handleResetCloseBehavior = () => {
    setCloseBehavior("ask");
    resetStoredCloseBehavior();
  };

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto p-6 space-y-6 select-none">
      {/* Page Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Settings
        </h1>
        <p className="text-xs text-muted-foreground">
          Customize application theme, Fluent 2 container styling, and backdrop material.
        </p>
      </div>

      {/* Section 1: Appearance & Theme */}
      <div className="space-y-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">
          Appearance & Theme
        </div>

        <div className="space-y-2">
          {/* Card 1: Backdrop Material */}
          <div className="flex items-center justify-between p-4 rounded-xl border border-white/[0.06] bg-card/60 hover:bg-card/80 transition-colors">
            <div className="flex items-center gap-3.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.05] text-muted-foreground border border-white/[0.06]">
                <Monitor className="h-4.5 w-4.5" />
              </div>
              <div>
                <div className="text-sm font-medium text-foreground">Backdrop Material</div>
                <div className="text-xs text-muted-foreground">
                  Windows 11 Native Mica sampling with real-time desktop composition
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Mica Active
              </span>
            </div>
          </div>

          {/* Card 2: Theme Style (The 3 Styles) */}
          <div className="p-4 rounded-xl border border-white/[0.06] bg-card/60 hover:bg-card/80 transition-colors space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.05] text-muted-foreground border border-white/[0.06]">
                  <Palette className="h-4.5 w-4.5" />
                </div>
                <div>
                  <div className="text-sm font-medium text-foreground">Container & Theme Style</div>
                  <div className="text-xs text-muted-foreground">
                    Select the container fill opacity and base background palette
                  </div>
                </div>
              </div>
            </div>

            {/* 3 Theme Options */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1">
              {/* Option 1: Sefirah */}
              <button
                type="button"
                onClick={() => handleSelectTheme("sefirah")}
                className={cn(
                  "relative flex flex-col items-start p-3.5 rounded-lg border text-left transition-all cursor-pointer",
                  theme === "sefirah"
                    ? "border-primary bg-primary/10 shadow-xs"
                    : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05]"
                )}
              >
                {theme === "sefirah" && (
                  <div className="absolute top-2.5 right-2.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="h-2.5 w-2.5 stroke-[3]" />
                  </div>
                )}
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="h-3.5 w-3.5 rounded-full bg-[#1e1c24] border border-white/20" />
                  <span className="text-xs font-semibold text-foreground">Sefirah (Smoked Obsidian)</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Windows 11 Fluent 2 smoked charcoal base with delicate translucent layer fills.
                </p>
              </button>

              {/* Option 2: Deep Blue */}
              <button
                type="button"
                onClick={() => handleSelectTheme("deep-blue")}
                className={cn(
                  "relative flex flex-col items-start p-3.5 rounded-lg border text-left transition-all cursor-pointer",
                  theme === "deep-blue"
                    ? "border-primary bg-primary/10 shadow-xs"
                    : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05]"
                )}
              >
                {theme === "deep-blue" && (
                  <div className="absolute top-2.5 right-2.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="h-2.5 w-2.5 stroke-[3]" />
                  </div>
                )}
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="h-3.5 w-3.5 rounded-full bg-[#151c2c] border border-white/20" />
                  <span className="text-xs font-semibold text-foreground">Deep Blue Mica</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Termizen classic midnight blue undertone with cool-tinted cards.
                </p>
              </button>

              {/* Option 3: Pure Neutral */}
              <button
                type="button"
                onClick={() => handleSelectTheme("neutral")}
                className={cn(
                  "relative flex flex-col items-start p-3.5 rounded-lg border text-left transition-all cursor-pointer",
                  theme === "neutral"
                    ? "border-primary bg-primary/10 shadow-xs"
                    : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05]"
                )}
              >
                {theme === "neutral" && (
                  <div className="absolute top-2.5 right-2.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="h-2.5 w-2.5 stroke-[3]" />
                  </div>
                )}
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="h-3.5 w-3.5 rounded-full bg-[#18181b] border border-white/20" />
                  <span className="text-xs font-semibold text-foreground">Pure Neutral Dark</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Graphite and slate dark palette with zero chromatic saturation.
                </p>
              </button>
            </div>
          </div>

          {/* Card 3: Accent Color */}
          <div className="flex items-center justify-between p-4 rounded-xl border border-white/[0.06] bg-card/60 hover:bg-card/80 transition-colors">
            <div className="flex items-center gap-3.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.05] text-muted-foreground border border-white/[0.06]">
                <Sparkles className="h-4.5 w-4.5" />
              </div>
              <div>
                <div className="text-sm font-medium text-foreground">Accent Color</div>
                <div className="text-xs text-muted-foreground">
                  Applied to primary buttons, active indicator pills, and focus rings
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {accent !== "#3B82F6" && (
                <button
                  type="button"
                  onClick={() => handleSelectAccent("#3B82F6")}
                  className="px-2.5 py-1 text-xs rounded-md border border-border/70 bg-card/60 hover:bg-card/90 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                  title="Reset to default Electric Blue"
                >
                  Reset Default
                </button>
              )}
              <ColorPicker
                color={accent}
                onChange={handleSelectAccent}
                align="right"
              />
            </div>
          </div>

          {/* Card 4: Live Container Layering Preview */}
          <div className="flex items-center justify-between p-4 rounded-xl border border-white/[0.06] bg-card/60 hover:bg-card/80 transition-colors">
            <div className="flex items-center gap-3.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.05] text-muted-foreground border border-white/[0.06]">
                <Layers className="h-4.5 w-4.5" />
              </div>
              <div>
                <div className="text-sm font-medium text-foreground">Fluent 2 Container Layering</div>
                <div className="text-xs text-muted-foreground">
                  Card background fill with hairline perimeter stroke and rounded corners
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border shadow-xs"
                style={{
                  backgroundColor: `${accent}20`,
                  borderColor: `${accent}40`,
                  color: accent,
                }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: accent }}
                />
                Accent Active
              </span>
              <div className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-foreground font-mono shadow-xs">
                --card Layer Fill
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Section 2: Background & Close Behavior */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">
            Background & Close Behavior
          </div>
          {closeBehavior !== "ask" && (
            <button
              type="button"
              onClick={handleResetCloseBehavior}
              className="flex items-center gap-1.5 text-xs text-primary hover:underline cursor-pointer"
            >
              <RotateCcw className="h-3 w-3" />
              Reset "Don't ask again" prompt
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Option 1: Ask Every Time */}
          <div
            onClick={() => handleSelectCloseBehavior("ask")}
            className={cn(
              "relative flex flex-col justify-between p-4 rounded-xl border transition-all cursor-pointer min-h-[148px]",
              closeBehavior === "ask"
                ? "border-primary/60 bg-primary/10 shadow-xs ring-1 ring-primary/40 text-foreground"
                : "border-white/[0.06] bg-card/60 hover:bg-card/80 text-muted-foreground hover:text-foreground"
            )}
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <div
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-lg border transition-colors shrink-0",
                    closeBehavior === "ask"
                      ? "bg-primary/20 border-primary/40 text-primary"
                      : "bg-white/[0.05] border-white/[0.06] text-muted-foreground"
                  )}
                >
                  <HelpCircle className="h-4.5 w-4.5" />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.06] text-muted-foreground border border-white/[0.08] font-medium">
                    Default
                  </span>
                  {closeBehavior === "ask" && (
                    <div className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center text-primary shrink-0">
                      <Check className="h-3 w-3" />
                    </div>
                  )}
                </div>
              </div>

              <div className="text-sm font-semibold text-foreground">
                Ask Every Time
              </div>
              <div className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Prompt each time the window is closed to choose between minimizing or exiting.
              </div>
            </div>
          </div>

          {/* Option 2: Keep in Background */}
          <div
            onClick={() => handleSelectCloseBehavior("background")}
            className={cn(
              "relative flex flex-col justify-between p-4 rounded-xl border transition-all cursor-pointer min-h-[148px]",
              closeBehavior === "background"
                ? "border-primary/60 bg-primary/10 shadow-xs ring-1 ring-primary/40 text-foreground"
                : "border-white/[0.06] bg-card/60 hover:bg-card/80 text-muted-foreground hover:text-foreground"
            )}
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <div
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-lg border transition-colors shrink-0",
                    closeBehavior === "background"
                      ? "bg-sky-500/20 border-sky-500/40 text-sky-400"
                      : "bg-white/[0.05] border-white/[0.06] text-muted-foreground"
                  )}
                >
                  <Minimize2 className="h-4.5 w-4.5" />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 font-medium border border-sky-500/30">
                    Minimize to Tray
                  </span>
                  {closeBehavior === "background" && (
                    <div className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center text-primary shrink-0">
                      <Check className="h-3 w-3" />
                    </div>
                  )}
                </div>
              </div>

              <div className="text-sm font-semibold text-foreground">
                Keep in Background
              </div>
              <div className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Silently minimize to tray. Background monitors and active SSH sessions stay connected.
              </div>
            </div>
          </div>

          {/* Option 3: Close Completely */}
          <div
            onClick={() => handleSelectCloseBehavior("quit")}
            className={cn(
              "relative flex flex-col justify-between p-4 rounded-xl border transition-all cursor-pointer min-h-[148px]",
              closeBehavior === "quit"
                ? "border-destructive/60 bg-destructive/10 shadow-xs ring-1 ring-destructive/40 text-foreground"
                : "border-white/[0.06] bg-card/60 hover:bg-card/80 text-muted-foreground hover:text-foreground"
            )}
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <div
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-lg border transition-colors shrink-0",
                    closeBehavior === "quit"
                      ? "bg-destructive/20 border-destructive/40 text-destructive"
                      : "bg-white/[0.05] border-white/[0.06] text-muted-foreground"
                  )}
                >
                  <Power className="h-4.5 w-4.5" />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-destructive/20 text-destructive font-medium border border-destructive/30">
                    Exit App
                  </span>
                  {closeBehavior === "quit" && (
                    <div className="h-5 w-5 rounded-full bg-destructive/20 flex items-center justify-center text-destructive shrink-0">
                      <Check className="h-3 w-3" />
                    </div>
                  )}
                </div>
              </div>

              <div className="text-sm font-semibold text-foreground">
                Close Completely
              </div>
              <div className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Immediately terminate Termizen, closing all terminal tabs and background monitoring.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Section 3: System Information */}
      <div className="space-y-3 pt-2">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">
          About & System
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between p-4 rounded-xl border border-white/[0.06] bg-card/60">
            <div className="flex items-center gap-3.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.05] text-muted-foreground border border-white/[0.06]">
                <Cpu className="h-4.5 w-4.5" />
              </div>
              <div>
                <div className="text-sm font-medium text-foreground">Termizen Platform</div>
                <div className="text-xs text-muted-foreground">
                  Tauri v2 • Windows App SDK Compositor • React 19 • Tailwind CSS v4
                </div>
              </div>
            </div>
            <div className="text-xs font-mono text-muted-foreground bg-white/[0.04] px-2.5 py-1 rounded-md border border-white/[0.06]">
              v0.2.0-preview
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
