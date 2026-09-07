"use client";

import { Plus, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { type ComponentType, useEffect, useId, useRef, useState } from "react";
import { EASE_OUT } from "@/lib/ease";
import { cn } from "@/lib/utils";

export interface BloomMenuItem {
  id: string;
  label: string;
  description?: string;
  icon: ComponentType<{ className?: string }>;
  onClick?: () => void;
}

// Folder-open spring physics
const SPRING_FOLDER = {
  type: "spring",
  stiffness: 320,
  damping: 32,
  mass: 0.85,
} as const;

export interface BloomMenuProps {
  items: BloomMenuItem[];
  triggerLabel?: string;
  className?: string;
  triggerClassName?: string;
}

export function BloomMenu({
  items,
  triggerLabel = "Create",
  className,
  triggerClassName,
}: BloomMenuProps) {
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();
  const layoutId = useId();
  const ref = useRef<HTMLDivElement>(null);

  // Close on Escape or click outside
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onPointer = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  const morph = reduce ? { duration: 0.15 } : SPRING_FOLDER;

  return (
    <div ref={ref} className={cn("relative w-full", className)}>
      {/* Spacer preserves trigger dimensions in sidebar flow while open */}
      <div className="h-8 w-full invisible pointer-events-none" aria-hidden />

      {/* Morph container */}
      <div className="pointer-events-none absolute left-0 top-0 z-50 w-full [&>*]:pointer-events-auto">
        <AnimatePresence initial={false} mode="popLayout">
          {open ? (
            <motion.div
              key="panel"
              layoutId={layoutId}
              transition={morph}
              style={{ borderRadius: 12 }}
              className="w-full overflow-hidden border border-white/10 bg-[#15161a] text-foreground shadow-2xl"
            >
              <motion.div
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: reduce ? 0 : 0.08, duration: 0.18 }}
              >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-white/[0.08] bg-white/[0.02] px-3.5 py-2.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {triggerLabel}
                  </span>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label="Close menu"
                    className="flex h-5 w-5 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-white/[0.08] hover:text-foreground cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* 2x2 Grid with Iris reveal */}
                <motion.div
                  initial={
                    reduce ? false : { clipPath: "inset(45% 34% 45% 34%)" }
                  }
                  animate={{ clipPath: "inset(0% 0% 0% 0%)" }}
                  transition={{
                    delay: reduce ? 0 : 0.05,
                    duration: 0.38,
                    ease: EASE_OUT,
                  }}
                  className="grid grid-cols-2"
                >
                  {items.map((item, i) => {
                    const cols = 2;
                    const rows = Math.ceil(items.length / cols);
                    const col = i % cols;
                    const row = Math.floor(i / cols);
                    const dist = Math.hypot(
                      col - (cols - 1) / 2,
                      row - (rows - 1) / 2
                    );

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setOpen(false);
                          item.onClick?.();
                        }}
                        className={cn(
                          "group flex flex-col items-center justify-center p-3.5 text-muted-foreground transition-colors hover:bg-white/[0.04] hover:text-foreground active:bg-white/[0.08] cursor-pointer select-none",
                          i % cols !== cols - 1 && "border-r border-white/[0.06]",
                          row < rows - 1 && "border-b border-white/[0.06]"
                        )}
                      >
                        <motion.span
                          initial={
                            reduce
                              ? { opacity: 0 }
                              : { opacity: 0, scale: 0.88 }
                          }
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{
                            delay: reduce ? 0 : 0.06 + dist * 0.05,
                            type: "spring",
                            stiffness: 440,
                            damping: 32,
                          }}
                          className="flex flex-col items-center gap-2 text-center"
                        >
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.06] text-muted-foreground transition-all duration-200 group-hover:scale-110 group-hover:bg-primary/20 group-hover:text-primary">
                            <item.icon className="h-4.5 w-4.5" />
                          </div>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs font-semibold leading-none text-foreground/90 group-hover:text-foreground">
                              {item.label}
                            </span>
                            {item.description && (
                              <span className="text-[10px] text-muted-foreground/75 leading-tight">
                                {item.description}
                              </span>
                            )}
                          </div>
                        </motion.span>
                      </button>
                    );
                  })}
                </motion.div>
              </motion.div>
            </motion.div>
          ) : (
            <motion.button
              key="trigger"
              type="button"
              layoutId={layoutId}
              transition={morph}
              style={{ borderRadius: 6 }}
              onClick={() => setOpen(true)}
              aria-haspopup="menu"
              aria-expanded={open}
              whileTap={reduce ? undefined : { scale: 0.98 }}
              className={cn(
                "flex h-8 w-full items-center justify-center gap-1.5 rounded-md bg-primary text-xs font-medium text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors cursor-pointer select-none",
                triggerClassName
              )}
            >
              <motion.span
                layout
                className="inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <Plus className="h-3.5 w-3.5" />
                {triggerLabel}
              </motion.span>
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
