import React, { useState } from "react";
import { cn } from "@/lib/utils";
import type { PaneBounds } from "@/utils/paneTree";

export interface SplitDividerProps {
  direction: "row" | "column";
  splitId: string;
  sizes: [number, number];
  containerRef: React.RefObject<HTMLDivElement | null>;
  splitBox?: PaneBounds;
  style?: React.CSSProperties;
  onResize: (splitId: string, sizes: [number, number]) => void;
}

export const SplitDivider: React.FC<SplitDividerProps> = ({
  direction,
  splitId,
  sizes: _sizes,
  containerRef,
  splitBox,
  style,
  onResize,
}) => {
  const [isDragging, setIsDragging] = useState(false);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Fallback if pointer capture unsupported
    }
    setIsDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const isRow = direction === "row";

    let percent: number;
    if (splitBox) {
      const splitLeftPx = rect.left + (splitBox.left / 100) * rect.width;
      const splitTopPx = rect.top + (splitBox.top / 100) * rect.height;
      const splitWidthPx = (splitBox.width / 100) * rect.width;
      const splitHeightPx = (splitBox.height / 100) * rect.height;

      if (isRow) {
        if (splitWidthPx <= 0) return;
        percent = ((e.clientX - splitLeftPx) / splitWidthPx) * 100;
      } else {
        if (splitHeightPx <= 0) return;
        percent = ((e.clientY - splitTopPx) / splitHeightPx) * 100;
      }
    } else {
      if (isRow) {
        if (rect.width <= 0) return;
        percent = ((e.clientX - rect.left) / rect.width) * 100;
      } else {
        if (rect.height <= 0) return;
        percent = ((e.clientY - rect.top) / rect.height) * 100;
      }
    }

    // Clamp between 10% and 90%
    const clamped = Math.max(10, Math.min(90, percent));
    const roundedFirst = Math.round(clamped * 10) / 10;
    const second = Math.round((100 - roundedFirst) * 10) / 10;

    onResize(splitId, [roundedFirst, second]);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Safe ignore
      }
      setIsDragging(false);
    }
  };

  return (
    <>
      {/* Invisible global overlay during active drag to guarantee smooth pointer tracking across terminals */}
      {isDragging && (
        <div
          className={cn(
            "fixed inset-0 z-50 select-none",
            direction === "row" ? "cursor-col-resize" : "cursor-row-resize"
          )}
        />
      )}

      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={style}
        className={cn(
          "group relative flex items-center justify-center shrink-0 z-30 select-none transition-colors",
          direction === "row"
            ? "cursor-col-resize"
            : "cursor-row-resize"
        )}
      >
        {/* Visual Line */}
        <div
          className={cn(
            "transition-all duration-150 rounded-full",
            direction === "row" ? "w-[2px] h-full" : "h-[2px] w-full",
            isDragging
              ? "bg-primary w-[3px]"
              : "bg-white/[0.08] group-hover:bg-primary/70"
          )}
        />
      </div>
    </>
  );
};
