import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import { Check, Trash2, X } from "lucide-react";
import { useState } from "react";

export interface NativeDeleteProps {
  /**
   * Callback when delete button is first clicked (shows confirmation)
   */
  onConfirm: () => void;
  /**
   * Callback when delete is confirmed
   */
  onDelete: () => void;
  /**
   * Text to show on the delete button
   * Default: "Delete"
   */
  buttonText?: string;
  /**
   * Text to show on the confirm button
   * Default: "Confirm"
   */
  confirmText?: string;
  /**
   * Size variant
   * Default: "md"
   */
  size?: "sm" | "md" | "lg";
  /**
   * Show icon in button
   * Default: true
   */
  showIcon?: boolean;
  /**
   * Additional class names for the container
   */
  className?: string;
  /**
   * Disable the button
   */
  disabled?: boolean;
}

// Idle state is icon-only (just the red trash can); clicking morphs it into
// a labeled Confirm pill + a separate Cancel icon button. Both stay compact
// -- this sits inline in list rows, not as a standalone destructive action.
const idleSizeVariants = {
  sm: "h-5 w-5",
  md: "h-6 w-6",
  lg: "h-7 w-7",
};

const expandedSizeVariants = {
  sm: "h-5 px-1.5 gap-1 text-[11px]",
  md: "h-6 px-2 gap-1 text-xs",
  lg: "h-7 px-2.5 gap-1 text-sm",
};

const iconSizeVariants = {
  sm: "h-3 w-3",
  md: "h-3.5 w-3.5",
  lg: "h-4 w-4",
};

const cancelButtonSizes = {
  sm: "h-5 w-5",
  md: "h-6 w-6",
  lg: "h-7 w-7",
};

// Smooth spring preset for natural feel
const smoothSpring = {
  type: "spring" as const,
  bounce: 0,
  duration: 0.35,
};

// Adapted from a pasted version that used @base-ui/react's Button with a
// `nativeButton` prop -- that prop doesn't exist on the current @base-ui/react
// API (its Button already renders a plain <button> by default), and pulling
// in a whole new headless-component library just to render a <button> here
// would've been a dependency with no payoff. Swapped for our own
// @/components/ui/button, which renders identically.
export function NativeDelete({ onConfirm, onDelete, buttonText = "Delete", confirmText = "Confirm", size = "md", showIcon = true, className, disabled = false }: NativeDeleteProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleDeleteClick = () => {
    if (!disabled) {
      setIsExpanded(true);
      onConfirm();
    }
  };

  const handleConfirm = () => {
    onDelete();
    setIsExpanded(false);
  };

  const handleCancel = () => {
    setIsExpanded(false);
  };

  return (
    <MotionConfig transition={smoothSpring}>
      <motion.div layout className={cn("relative inline-flex items-center gap-2", className)}>
        {/* Main Delete/Confirm button */}
        <motion.div layout whileHover={!disabled ? { scale: 1.02 } : undefined} whileTap={!disabled ? { scale: 0.98 } : undefined}>
          <Button
            className={cn(
              "inline-flex items-center justify-center rounded-md p-0 transition-shadow cursor-pointer",
              isExpanded ? cn(expandedSizeVariants[size], "bg-destructive text-white hover:bg-destructive/90") : cn(idleSizeVariants[size], "bg-transparent text-destructive hover:bg-destructive/10"),
              disabled && "opacity-50 cursor-not-allowed"
            )}
            onClick={isExpanded ? handleConfirm : handleDeleteClick}
            disabled={disabled}
            aria-label={isExpanded ? confirmText : buttonText}
          >
            {showIcon && (
              <AnimatePresence mode="wait" initial={false}>
                <motion.span key={isExpanded ? "check-icon" : "trash-icon"} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} transition={{ duration: 0.15 }} className="flex items-center">
                  {isExpanded ? <Check className={iconSizeVariants[size]} /> : <Trash2 className={iconSizeVariants[size]} />}
                </motion.span>
              </AnimatePresence>
            )}
            <AnimatePresence initial={false}>
              {isExpanded && (
                <motion.span key="confirm" initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: "auto" }} exit={{ opacity: 0, width: 0 }} transition={{ duration: 0.15 }} className="overflow-hidden whitespace-nowrap">
                  {confirmText}
                </motion.span>
              )}
            </AnimatePresence>
          </Button>
        </motion.div>

        {/* Cancel button */}
        <AnimatePresence mode="popLayout">
          {isExpanded && (
            <motion.div key="cancel-button" layout initial={{ opacity: 0, scale: 0.8, x: -8 }} animate={{ opacity: 1, scale: 1, x: 0 }} exit={{ opacity: 0, scale: 0.8, x: -8 }} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                className={cn(cancelButtonSizes[size], "inline-flex items-center justify-center rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-shadow cursor-pointer")}
                onClick={handleCancel}
                aria-label="Cancel delete"
              >
                <X className={iconSizeVariants[size]} />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </MotionConfig>
  );
}
