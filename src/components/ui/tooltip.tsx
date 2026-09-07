import { useState, useRef, useEffect, useCallback, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

// ── 1. Standalone Spring Animated Tooltip (Portal-Rendered & Collision-Aware) ───
export interface TooltipProps {
  children: ReactNode;
  content: ReactNode;
  hotkey?: string | string[];
  side?: "top" | "bottom" | "left" | "right";
  delay?: number;
  className?: string;
}

export function Tooltip({
  children,
  content,
  hotkey,
  side = "top",
  delay = 200,
  className,
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    transform: string;
    effectiveSide: "top" | "bottom" | "left" | "right";
  } | null>(null);

  const triggerRef = useRef<HTMLDivElement | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const offset = 6;
    const tooltipEstHeight = 28;
    const tooltipEstWidth = 120;

    let effectiveSide = side;

    // Viewport boundary collision avoidance
    if (side === "top" && rect.top - tooltipEstHeight - offset < 8) {
      effectiveSide = "bottom";
    } else if (side === "bottom" && rect.bottom + tooltipEstHeight + offset > window.innerHeight - 8) {
      effectiveSide = "top";
    } else if (side === "left" && rect.left - tooltipEstWidth - offset < 8) {
      effectiveSide = "right";
    } else if (side === "right" && rect.right + tooltipEstWidth + offset > window.innerWidth - 8) {
      effectiveSide = "left";
    }

    let top = 0;
    let left = 0;
    let transform = "";

    if (effectiveSide === "top") {
      top = rect.top - offset;
      left = rect.left + rect.width / 2;
      transform = "translate(-50%, -100%)";
    } else if (effectiveSide === "bottom") {
      top = rect.bottom + offset;
      left = rect.left + rect.width / 2;
      transform = "translate(-50%, 0)";
    } else if (effectiveSide === "left") {
      top = rect.top + rect.height / 2;
      left = rect.left - offset;
      transform = "translate(-100%, -50%)";
    } else if (effectiveSide === "right") {
      top = rect.top + rect.height / 2;
      left = rect.right + offset;
      transform = "translate(0, -50%)";
    }

    // Horizontal clamping to prevent screen edge overflow
    const halfWidth = 60;
    if (effectiveSide === "top" || effectiveSide === "bottom") {
      if (left - halfWidth < 10) {
        left = 10;
        transform = effectiveSide === "top" ? "translate(0, -100%)" : "translate(0, 0)";
      } else if (left + halfWidth > window.innerWidth - 10) {
        left = window.innerWidth - 10;
        transform = effectiveSide === "top" ? "translate(-100%, -100%)" : "translate(-100%, 0)";
      }
    }

    setCoords({ top, left, transform, effectiveSide });
  }, [side]);

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      updatePosition();
      setIsVisible(true);
    }, delay);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsVisible(false);
  };

  const handleClick = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsVisible(false);
  };

  useEffect(() => {
    if (!isVisible) return;
    const handleScrollOrResize = () => {
      updatePosition();
    };
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);
    return () => {
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [isVisible, updatePosition]);

  const motionVariants = {
    initial: {
      opacity: 0,
      scale: 0.94,
      filter: "blur(3px)",
      y: coords?.effectiveSide === "top" ? 3 : coords?.effectiveSide === "bottom" ? -3 : 0,
      x: coords?.effectiveSide === "left" ? 3 : coords?.effectiveSide === "right" ? -3 : 0,
    },
    animate: {
      opacity: 1,
      scale: 1,
      filter: "blur(0px)",
      y: 0,
      x: 0,
    },
    exit: {
      opacity: 0,
      scale: 0.96,
      filter: "blur(2px)",
    },
  };

  return (
    <div
      ref={triggerRef}
      className="relative inline-flex items-center"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      {children}
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {isVisible && coords && (
              <div
                style={{
                  position: "fixed",
                  top: coords.top,
                  left: coords.left,
                  transform: coords.transform,
                  zIndex: 99999,
                  pointerEvents: "none",
                }}
              >
                <motion.div
                  variants={motionVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={{ type: "spring", stiffness: 400, damping: 28 }}
                  className={cn(
                    "flex items-center gap-1.5 whitespace-nowrap rounded-md border border-border/80 bg-popover/95 px-2.5 py-1 text-[11px] font-medium text-popover-foreground shadow-xl backdrop-blur-md",
                    className
                  )}
                >
                  <span>{content}</span>
                  {hotkey && (
                    <div className="flex items-center gap-0.5 text-muted-foreground">
                      {Array.isArray(hotkey) ? (
                        hotkey.map((k, i) => (
                          <span
                            key={i}
                            className="flex h-4 min-w-4 items-center justify-center rounded border border-border/60 bg-muted/60 px-1 text-[9px] font-mono"
                          >
                            {k}
                          </span>
                        ))
                      ) : (
                        <span className="flex h-4 min-w-4 items-center justify-center rounded border border-border/60 bg-muted/60 px-1 text-[9px] font-mono">
                          {hotkey}
                        </span>
                      )}
                    </div>
                  )}
                </motion.div>
              </div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
}

// ── 2. Sliding Clip-Path Spring Animated Tooltip Bar ─────────
export type TooltipItem = {
  icon: ReactNode;
  label: string;
  labelHasKeyword?: (string | ReactNode)[] | false;
  hasBadge?: boolean;
  onClick?: () => void;
  isActive?: boolean;
};

export interface TooltipVerticalNavbarProps {
  items: TooltipItem[];
  tooltipDelay?: number;
  className?: string;
}

export function TooltipVerticalNavbar({
  items,
  tooltipDelay = 250,
  className,
}: TooltipVerticalNavbarProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [coords, setCoords] = useState({ clipPath: "", translateY: 0 });

  const measureRefs = useRef<(HTMLDivElement | null)[]>([]);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const [isEntering, setIsEntering] = useState(true);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const calculatePosition = (index: number) => {
    const activeLabel = measureRefs.current[index];
    const activeIcon = buttonRefs.current[index];

    if (!activeLabel || !activeIcon) return null;

    const labelTop = activeLabel.offsetTop;
    const labelHeight = activeLabel.offsetHeight;
    const labelCenter = labelTop + labelHeight / 2;

    const iconTop = activeIcon.offsetTop;
    const iconHeight = activeIcon.offsetHeight;
    const iconCenter = iconTop + iconHeight / 2;

    const totalHeight = measureRefs.current.reduce(
      (acc, el) => acc + (el?.offsetHeight || 0),
      0
    );

    const cTop = (labelTop / totalHeight) * 100;
    const cBottom = 100 - ((labelTop + labelHeight) / totalHeight) * 100;

    return {
      clipPath: `inset(${cTop}% 0 ${cBottom}% 0 round 8px)`,
      translateY: iconCenter - labelCenter,
    };
  };

  const handleMouseEnter = (index: number) => {
    const newCoords = calculatePosition(index);
    if (!newCoords) return;

    if (activeIndex === null) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setIsEntering(true);

      timeoutRef.current = setTimeout(() => {
        setCoords(newCoords);
        setActiveIndex(index);
      }, tooltipDelay);
    } else {
      setCoords(newCoords);
      setActiveIndex(index);
    }
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setActiveIndex(null);
    setCoords({ clipPath: "", translateY: 0 });
    setIsEntering(true);
  };

  return (
    <div className={cn("relative flex items-center", className)}>
      <div className="relative" onMouseLeave={handleMouseLeave}>
        <AnimatePresence>
          {activeIndex !== null && coords.clipPath !== "" && (
            <motion.div
              className="absolute top-0 left-12 z-50 pointer-events-none"
              initial={{ opacity: 0, scale: 0.92, filter: "blur(4px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, scale: 0.92, filter: "blur(4px)" }}
              transition={{ duration: 0.18 }}
            >
              <motion.div
                className="rounded-lg border border-border/80 bg-popover/95 shadow-xl backdrop-blur-md"
                animate={{
                  clipPath: coords.clipPath,
                  y: coords.translateY,
                }}
                transition={{
                  type: "spring",
                  bounce: 0,
                  duration: isEntering ? 0 : 0.35,
                }}
                onUpdate={() => {
                  if (isEntering) {
                    setIsEntering(false);
                  }
                }}
              >
                <div className="flex flex-col items-start justify-center">
                  {items.map((item, index) => (
                    <div
                      key={`real-${index}`}
                      className="flex h-9 items-center justify-center gap-2 px-3 text-xs font-medium whitespace-nowrap text-popover-foreground"
                    >
                      <span>{item.label}</span>
                      {item.labelHasKeyword && (
                        <div className="flex items-center gap-0.5 text-muted-foreground">
                          {item.labelHasKeyword.map((key, i) => (
                            <span
                              key={i}
                              className="flex items-center justify-center rounded border border-border/60 bg-muted/60 px-1 py-0.5 text-[9px] font-mono tabular-nums"
                            >
                              {key}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="z-10 flex flex-col items-center justify-center gap-1 rounded-xl bg-card/80 p-1 border border-border/60 backdrop-blur-md">
          {items.map((item, index) => (
            <button
              key={index}
              onClick={item.onClick}
              onMouseEnter={() => handleMouseEnter(index)}
              ref={(el) => {
                buttonRefs.current[index] = el;
              }}
              className={cn(
                "flex size-9 cursor-pointer items-center justify-center rounded-lg transition-colors",
                item.isActive
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <div className="flex size-4 items-center justify-center">
                {item.icon}
              </div>
              <span className="sr-only">{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Hidden Measure Container */}
      <div className="pointer-events-none absolute top-0 left-0 flex flex-col overflow-hidden whitespace-nowrap opacity-0">
        {items.map((item, index) => (
          <div
            key={`measure-${index}`}
            ref={(el) => {
              measureRefs.current[index] = el;
            }}
            className="flex h-9 items-center justify-center gap-2 px-3 text-xs font-medium whitespace-nowrap"
          >
            <span>{item.label}</span>
            {item.labelHasKeyword && (
              <div className="flex items-center gap-0.5">
                {item.labelHasKeyword.map((key, i) => (
                  <span
                    key={i}
                    className="flex items-center justify-center rounded border px-1 text-[9px] font-mono"
                  >
                    {typeof key === "string" ? key : "⌘"}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
