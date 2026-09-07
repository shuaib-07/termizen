"use client";

import { useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import useMeasure from "react-use-measure";
import { cn } from "@/lib/utils";

export type Tab = {
  id: number | string;
  label: ReactNode;
  content?: ReactNode;
  icon?: ReactNode;
  onClose?: () => void;
};

export interface DirectionAwareTabsProps {
  tabs: Tab[];
  className?: string;
  tabClassName?: string;
  activeTabClassName?: string;
  inactiveTabClassName?: string;
  bubbleClassName?: string;
  containerClassName?: string;
  contentClassName?: string;
  /** Unique layout ID for Framer Motion shared layout transition */
  layoutId?: string;
  /** Outer container radius (e.g. `rounded-lg`, `rounded-full`) */
  rounded?: string;
  /** Inner tab/bubble radius — should be outer radius minus container padding (~3px) */
  roundedInner?: string;
  /** Active tab ID if controlled */
  activeTabId?: number | string;
  /** Whether to render the content panel below the tabs */
  showContent?: boolean;
  onChange?: (tabId: number | string) => void;
}

export type OgImageSectionProps = DirectionAwareTabsProps;

export function DirectionAwareTabs({
  tabs,
  className,
  tabClassName,
  activeTabClassName,
  inactiveTabClassName,
  bubbleClassName,
  containerClassName,
  contentClassName,
  layoutId = "direction-aware-tabs-bubble",
  rounded,
  roundedInner,
  activeTabId,
  showContent = true,
  onChange,
}: DirectionAwareTabsProps) {
  const initialTab = activeTabId ?? tabs[0]?.id ?? 0;
  const [internalActiveTab, setInternalActiveTab] = useState<number | string>(initialTab);
  const activeTab = activeTabId !== undefined ? activeTabId : internalActiveTab;

  const [direction, setDirection] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [ref, bounds] = useMeasure();

  const content = useMemo(() => {
    const activeTabContent = tabs.find((tab) => tab.id === activeTab)?.content;
    return activeTabContent || null;
  }, [activeTab, tabs]);

  const handleTabClick = (newTabId: number | string) => {
    if (newTabId !== activeTab && !isAnimating) {
      const newIndex = tabs.findIndex((t) => t.id === newTabId);
      const currIndex = tabs.findIndex((t) => t.id === activeTab);
      const newDirection = newIndex > currIndex ? 1 : -1;
      setDirection(newDirection);
      if (activeTabId === undefined) {
        setInternalActiveTab(newTabId);
      }
      onChange?.(newTabId);
    }
  };

  const variants = {
    initial: (dir: number) => ({
      x: 180 * dir,
      opacity: 0,
      filter: "blur(4px)",
    }),
    active: {
      x: 0,
      opacity: 1,
      filter: "blur(0px)",
    },
    exit: (dir: number) => ({
      x: -180 * dir,
      opacity: 0,
      filter: "blur(4px)",
    }),
  };

  const hasAnyContent = showContent && tabs.some((t) => t.content !== undefined);

  return (
    <div className={cn("flex flex-col items-center w-full", containerClassName)}>
      <div
        className={cn(
          "flex space-x-1 rounded-full cursor-pointer bg-zinc-900/90 border border-white/[0.08] px-[3px] py-[3.2px] shadow-inner shadow-black/40 backdrop-blur-md",
          className,
          rounded
        )}
      >
        {tabs.map((tab) => {
          const isSelected = activeTab === tab.id;
          return (
            <button
              key={String(tab.id)}
              type="button"
              onClick={() => handleTabClick(tab.id)}
              className={cn(
                "relative rounded-full px-3 py-1.5 text-xs font-medium transition focus-visible:outline-1 focus-visible:ring-1 focus-visible:outline-none flex gap-1.5 items-center select-none",
                isSelected
                  ? cn("text-white font-semibold shadow-xs", activeTabClassName)
                  : cn("text-zinc-400 hover:text-zinc-200", inactiveTabClassName),
                tabClassName,
                rounded ? roundedInner : undefined
              )}
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              {isSelected && (
                <motion.span
                  layoutId={layoutId}
                  className={cn(
                    "absolute inset-0 z-0 bg-white/[0.12] shadow-sm border border-white/[0.15]",
                    bubbleClassName,
                    rounded ? roundedInner : "rounded-full"
                  )}
                  transition={{ type: "spring", bounce: 0.19, duration: 0.4 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-1.5">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {hasAnyContent && (
        <MotionConfig transition={{ duration: 0.35, type: "spring", bounce: 0.18 }}>
          <motion.div
            className={cn("relative mx-auto w-full h-full overflow-hidden", contentClassName)}
            initial={false}
            animate={{ height: bounds.height > 0 ? bounds.height : "auto" }}
          >
            <div className="p-1" ref={ref}>
              <AnimatePresence
                custom={direction}
                mode="popLayout"
                onExitComplete={() => setIsAnimating(false)}
              >
                <motion.div
                  key={String(activeTab)}
                  variants={variants}
                  initial="initial"
                  animate="active"
                  exit="exit"
                  custom={direction}
                  onAnimationStart={() => setIsAnimating(true)}
                  onAnimationComplete={() => setIsAnimating(false)}
                  transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                >
                  {content}
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        </MotionConfig>
      )}
    </div>
  );
}
