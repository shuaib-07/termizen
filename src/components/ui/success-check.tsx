import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export function SuccessCheck({
  children,
  trigger = false,
  className,
}: {
  children?: React.ReactNode;
  trigger?: boolean;
  className?: string;
}) {
  const [state, setState] = useState<"out" | "in">("out");
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (trigger) {
      setState("out");
      requestAnimationFrame(() => {
        if (ref.current) void ref.current.offsetWidth;
        setState("in");
      });
    } else {
      setState("out");
    }
  }, [trigger]);

  return (
    <span
      ref={ref}
      className={cn("t-success-check", className)}
      data-state={state}
      aria-hidden="true"
    >
      {children || (
        <svg
          className="h-5 w-5 text-emerald-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
    </span>
  );
}

export default SuccessCheck;
