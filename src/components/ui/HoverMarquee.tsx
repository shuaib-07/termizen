import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface HoverMarqueeProps {
  text: string;
  className?: string;
  speed?: number; // pixels per second (default 32px/s)
  gapPx?: number; // spacing between loop copies (default 32px)
  delayMs?: number; // delay before starting marquee on hover (default 200ms)
}

export function HoverMarquee({
  text,
  className,
  speed = 34,
  gapPx = 32,
  delayMs = 200,
}: HoverMarqueeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [shouldAnimate, setShouldAnimate] = useState(false);
  const [contentWidth, setContentWidth] = useState(0);

  // Measure overflow
  useEffect(() => {
    const checkOverflow = () => {
      if (containerRef.current && measureRef.current) {
        const containerWidth = containerRef.current.clientWidth;
        const textWidth = measureRef.current.scrollWidth;
        const overflows = textWidth > containerWidth;
        setIsOverflowing(overflows);
        setContentWidth(textWidth + gapPx);
      }
    };

    checkOverflow();

    const resizeObserver = new ResizeObserver(checkOverflow);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => resizeObserver.disconnect();
  }, [text, gapPx]);

  // Delay before starting marquee on hover
  useEffect(() => {
    let timer: number | undefined;
    if (isHovered && isOverflowing) {
      timer = window.setTimeout(() => {
        setShouldAnimate(true);
      }, delayMs);
    } else {
      setShouldAnimate(false);
    }

    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, [isHovered, isOverflowing, delayMs]);

  // Duration in seconds = (width of single copy + gap) / speed
  const duration = contentWidth > 0 ? Math.max(3, contentWidth / speed) : 6;

  return (
    <div
      ref={containerRef}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        "relative overflow-hidden w-full min-w-0 select-none",
        isOverflowing && shouldAnimate && "cursor-default",
        className
      )}
      style={{
        maskImage:
          isOverflowing && shouldAnimate
            ? "linear-gradient(to right, transparent 0%, black 8px, black calc(100% - 12px), transparent 100%)"
            : undefined,
        WebkitMaskImage:
          isOverflowing && shouldAnimate
            ? "linear-gradient(to right, transparent 0%, black 8px, black calc(100% - 12px), transparent 100%)"
            : undefined,
      }}
      title={isOverflowing ? text : undefined}
    >
      {/* Hidden measure element to detect accurate scrollWidth */}
      <span
        ref={measureRef}
        aria-hidden="true"
        className="absolute left-0 top-0 opacity-0 pointer-events-none whitespace-nowrap"
      >
        {text}
      </span>

      {isOverflowing && shouldAnimate ? (
        <div
          className="flex whitespace-nowrap will-change-transform animate-marquee-loop"
          style={{
            ["--marquee-duration" as any]: `${duration}s`,
          }}
        >
          <span style={{ paddingRight: `${gapPx}px` }} className="inline-block flex-shrink-0">
            {text}
          </span>
          <span style={{ paddingRight: `${gapPx}px` }} className="inline-block flex-shrink-0">
            {text}
          </span>
        </div>
      ) : (
        <span className="block truncate w-full text-left">{text}</span>
      )}
    </div>
  );
}
