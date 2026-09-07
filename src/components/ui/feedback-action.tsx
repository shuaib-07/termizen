import React, { useState, useEffect } from "react";
import { motion, AnimatePresence, MotionConfig } from "framer-motion";
import { AlertCircle, Loader2, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FeedbackActionProps {
  status?: "error" | "loading" | "idle" | "success";
  errorMessage?: string;
  loadingMessage?: string;
  successMessage?: string;
  idleMessage?: string;
  size?: "sm" | "md" | "lg";
  onRetry?: () => void | Promise<void>;
  className?: string;
  autoTimeout?: boolean;
}

export const FeedbackAction: React.FC<FeedbackActionProps> = ({
  status: controlledStatus,
  errorMessage = "Sync Failed",
  loadingMessage = "Syncing...",
  successMessage = "Synced",
  idleMessage = "Refresh",
  size = "sm",
  onRetry,
  className,
  autoTimeout = false,
}) => {
  const [internalStatus, setInternalStatus] = useState<"error" | "loading" | "idle" | "success">(
    controlledStatus || "idle"
  );

  const status = controlledStatus !== undefined ? controlledStatus : internalStatus;

  const handleRetry = async () => {
    if (controlledStatus === undefined) {
      setInternalStatus("loading");
    }
    if (onRetry) {
      try {
        await onRetry();
        if (controlledStatus === undefined) {
          setInternalStatus("success");
          setTimeout(() => setInternalStatus("idle"), 2000);
        }
      } catch {
        if (controlledStatus === undefined) {
          setInternalStatus("error");
        }
      }
    }
  };

  useEffect(() => {
    if (autoTimeout && status === "loading" && controlledStatus === undefined) {
      const timer = setTimeout(() => {
        setInternalStatus("error");
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [status, autoTimeout, controlledStatus]);

  const isSmall = size === "sm";
  const isMedium = size === "md";

  const heightClass = isSmall ? "h-7" : isMedium ? "h-9" : "h-12";
  const paddingClass = isSmall ? "px-2.5 py-1" : isMedium ? "px-3.5 py-1.5" : "px-5 py-3";
  const textClass = isSmall ? "text-xs font-medium" : isMedium ? "text-sm font-semibold" : "text-base font-semibold";
  const iconSize = isSmall ? 13 : isMedium ? 16 : 20;
  const buttonSizeClass = isSmall ? "h-7 w-7" : isMedium ? "h-9 w-9" : "h-12 w-12";

  return (
    <div className={cn("inline-flex items-center gap-1.5", heightClass, className)}>
      <MotionConfig transition={{ type: "spring", bounce: 0.25, duration: 0.5 }}>
        <motion.div
          animate={{ width: "auto" }}
          layout
          initial={false}
          className={cn(
            "relative z-20 flex items-center justify-center overflow-hidden border rounded-full backdrop-blur-md shadow-xs transition-colors",
            paddingClass,
            status === "error"
              ? "border-destructive/40 bg-destructive/10 text-destructive"
              : status === "loading"
              ? "border-primary/40 bg-primary/10 text-primary"
              : status === "success"
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
              : "border-border/60 bg-card/70 text-muted-foreground hover:text-foreground"
          )}
        >
          <motion.div
            initial={{ opacity: 0, filter: "blur(4px)" }}
            animate={{ opacity: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, filter: "blur(4px)" }}
            transition={{ type: "spring", stiffness: 300, damping: 24 }}
            className="flex items-center gap-1.5"
          >
            <AnimatePresence mode="popLayout">
              <motion.div
                layout
                key={status}
                initial={{ opacity: 0, scale: 0.3, filter: "blur(2px)" }}
                animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                exit={{ opacity: 0, scale: 0.3, filter: "blur(2px)" }}
                transition={{ type: "spring", bounce: 0, duration: 0.25 }}
              >
                {status === "error" ? (
                  <AlertCircle size={iconSize} className="text-destructive" />
                ) : status === "loading" ? (
                  <Loader2 size={iconSize} className="animate-spin text-primary" />
                ) : (
                  <RotateCw size={iconSize} className="text-muted-foreground" />
                )}
              </motion.div>
            </AnimatePresence>

            <AnimatedText
              text={
                status === "error"
                  ? errorMessage
                  : status === "loading"
                  ? loadingMessage
                  : status === "success"
                  ? successMessage
                  : idleMessage
              }
              className={cn(
                textClass,
                status === "error"
                  ? "text-destructive"
                  : status === "loading"
                  ? "text-primary"
                  : status === "success"
                  ? "text-emerald-400"
                  : "text-foreground"
              )}
            />
          </motion.div>
        </motion.div>

        <AnimatePresence mode="popLayout">
          {(status === "error" || status === "idle") && onRetry && (
            <motion.button
              type="button"
              initial={{
                opacity: 0,
                x: -20,
                filter: "blur(4px)",
                scale: 0.8,
              }}
              animate={{ opacity: 1, x: 0, filter: "blur(0px)", scale: 1 }}
              exit={{ opacity: 0, x: -20, filter: "blur(4px)", scale: 0.8 }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              onClick={handleRetry}
              className={cn(
                "z-10 flex items-center justify-center rounded-full bg-secondary hover:bg-secondary/80 text-foreground border border-border/80 shadow-sm cursor-pointer transition-colors",
                buttonSizeClass
              )}
              title="Retry / Refresh"
            >
              <RotateCw size={isSmall ? 12 : isMedium ? 15 : 18} />
            </motion.button>
          )}
        </AnimatePresence>
      </MotionConfig>
    </div>
  );
};

export function AnimatedText({
  text,
  className,
  delayStep = 0.014,
}: {
  text: string;
  className?: string;
  delayStep?: number;
}) {
  const chars = text.split("");

  return (
    <span style={{ display: "inline-flex" }}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          layout
          key={text}
          style={{ display: "inline-flex", willChange: "transform" }}
        >
          {chars.map((char, i) => (
            <motion.span
              key={i}
              initial={{ y: 8, opacity: 0, scale: 0.6, filter: "blur(2px)" }}
              animate={{ y: 0, opacity: 1, scale: 1, filter: "blur(0px)" }}
              exit={{ y: -8, opacity: 0, scale: 0.6, filter: "blur(2px)" }}
              transition={{
                type: "spring",
                stiffness: 240,
                damping: 16,
                mass: 1.2,
                delay: i * delayStep,
              }}
              style={{
                display: "inline-block",
                whiteSpace: char === " " ? "pre" : undefined,
              }}
              className={className}
            >
              {char}
            </motion.span>
          ))}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

export default FeedbackAction;
