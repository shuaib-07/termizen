"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type HTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, X } from "lucide-react";
import { SPRING_PANEL, SPRING_PRESS } from "@/lib/ease";
import { cn } from "@/lib/utils";

interface FloatingPanelContextType {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  panelId: string;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  formValue: string;
  setFormValue: (val: string) => void;
}

const FloatingPanelContext = createContext<FloatingPanelContextType | null>(null);

function useFloatingPanel() {
  const ctx = useContext(FloatingPanelContext);
  if (!ctx) {
    throw new Error("FloatingPanel components must be used within a FloatingPanelRoot");
  }
  return ctx;
}

// ── Root ────────────────────────────────────────────────────────────────────
export interface FloatingPanelRootProps {
  children: ReactNode | ((ctx: FloatingPanelContextType) => ReactNode);
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
  className?: string;
}

export function FloatingPanelRoot({
  children,
  open: controlledOpen,
  onOpenChange,
  defaultOpen = false,
  className,
}: FloatingPanelRootProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const [formValue, setFormValue] = useState("");
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : uncontrolledOpen;
  const panelId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);

  const setIsOpen = (newOpen: boolean) => {
    if (!isControlled) {
      setUncontrolledOpen(newOpen);
    }
    onOpenChange?.(newOpen);
  };

  const contextValue: FloatingPanelContextType = {
    isOpen,
    setIsOpen,
    panelId,
    triggerRef,
    formValue,
    setFormValue,
  };

  return (
    <FloatingPanelContext.Provider value={contextValue}>
      <div className={cn("relative inline-block", className)}>
        {typeof children === "function" ? children(contextValue) : children}
      </div>
    </FloatingPanelContext.Provider>
  );
}

// ── Trigger ─────────────────────────────────────────────────────────────────
export interface FloatingPanelTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
}

export function FloatingPanelTrigger({
  children,
  className,
  onClick,
  ...props
}: FloatingPanelTriggerProps) {
  const { isOpen, setIsOpen, triggerRef } = useFloatingPanel();

  return (
    <button
      ref={triggerRef}
      type="button"
      onClick={(e) => {
        onClick?.(e);
        setIsOpen(!isOpen);
      }}
      aria-expanded={isOpen}
      className={cn(
        "cursor-pointer outline-none transition select-none",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

// ── Content ─────────────────────────────────────────────────────────────────
export interface FloatingPanelContentProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  align?: "start" | "center" | "end";
  sideOffset?: number;
}

export function FloatingPanelContent({
  children,
  className,
  align = "start",
  sideOffset = 6,
  ...props
}: FloatingPanelContentProps) {
  const { isOpen, setIsOpen, triggerRef } = useFloatingPanel();
  const contentRef = useRef<HTMLDivElement>(null);

  // Close on Escape or click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        contentRef.current &&
        !contentRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, setIsOpen, triggerRef]);

  const alignClass =
    align === "end" ? "right-0" : align === "center" ? "left-1/2 -translate-x-1/2" : "left-0";

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={contentRef}
          initial={{ opacity: 0, scale: 0.94, y: -4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: -4 }}
          transition={SPRING_PANEL}
          style={{ top: `calc(100% + ${sideOffset}px)` }}
          className={cn(
            "absolute z-50 overflow-hidden rounded-xl border border-white/[0.08] bg-zinc-950/98 p-3 shadow-2xl backdrop-blur-2xl text-foreground min-w-[12rem]",
            alignClass,
            className
          )}
          {...(props as any)}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Form ────────────────────────────────────────────────────────────────────
export interface FloatingPanelFormProps
  extends Omit<React.FormHTMLAttributes<HTMLFormElement>, "onSubmit"> {
  onSubmit?: (val: string, e: FormEvent<HTMLFormElement>) => void;
  children: ReactNode;
}

export function FloatingPanelForm({
  children,
  onSubmit,
  className,
  ...props
}: FloatingPanelFormProps) {
  const { formValue, setIsOpen } = useFloatingPanel();

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSubmit?.(formValue, e);
    setIsOpen(false);
  };

  return (
    <form onSubmit={handleSubmit} className={cn("space-y-3", className)} {...props}>
      {children}
    </form>
  );
}

// ── Header ──────────────────────────────────────────────────────────────────
export function FloatingPanelHeader({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex items-center justify-between pb-2 mb-2 border-b border-white/[0.06] text-xs font-semibold text-foreground", className)}
      {...props}
    >
      {children}
    </div>
  );
}

// ── Body ────────────────────────────────────────────────────────────────────
export function FloatingPanelBody({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("space-y-2 text-xs", className)} {...props}>
      {children}
    </div>
  );
}

// ── Footer ──────────────────────────────────────────────────────────────────
export function FloatingPanelFooter({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex items-center justify-end gap-2 pt-2.5 mt-2.5 border-t border-white/[0.06]", className)}
      {...props}
    >
      {children}
    </div>
  );
}

// ── Label ───────────────────────────────────────────────────────────────────
export function FloatingPanelLabel({
  children,
  className,
  htmlFor,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn("block text-[11px] font-medium text-muted-foreground mb-1 select-none", className)}
      {...props}
    >
      {children}
    </label>
  );
}

// ── Textarea ────────────────────────────────────────────────────────────────
export function FloatingPanelTextarea({
  className,
  value,
  onChange,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { formValue, setFormValue } = useFloatingPanel();

  return (
    <textarea
      value={value !== undefined ? value : formValue}
      onChange={(e) => {
        onChange?.(e);
        if (value === undefined) {
          setFormValue(e.target.value);
        }
      }}
      className={cn(
        "w-full rounded-lg border border-white/[0.08] bg-zinc-900/90 px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none resize-none transition",
        className
      )}
      {...props}
    />
  );
}

// ── Button ──────────────────────────────────────────────────────────────────
export interface FloatingPanelButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
}

export function FloatingPanelButton({
  children,
  className,
  ...props
}: FloatingPanelButtonProps) {
  return (
    <motion.button
      type="button"
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={SPRING_PRESS}
      className={cn(
        "flex cursor-pointer items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition select-none disabled:pointer-events-none disabled:opacity-50",
        className
      )}
      {...(props as any)}
    >
      {children}
    </motion.button>
  );
}

// ── Close Button ────────────────────────────────────────────────────────────
export function FloatingPanelCloseButton({
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { setIsOpen } = useFloatingPanel();

  return (
    <button
      type="button"
      onClick={() => setIsOpen(false)}
      className={cn(
        "cursor-pointer rounded-md p-1 text-muted-foreground hover:bg-white/[0.08] hover:text-foreground transition select-none text-xs flex items-center gap-1",
        className
      )}
      {...props}
    >
      {children || <X className="h-3.5 w-3.5" />}
    </button>
  );
}

// ── Submit Button ───────────────────────────────────────────────────────────
export function FloatingPanelSubmitButton({
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="submit"
      className={cn(
        "cursor-pointer flex items-center gap-1 rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition select-none shadow-xs",
        className
      )}
      {...props}
    >
      {children || (
        <>
          <Check className="h-3.5 w-3.5" />
          <span>Submit</span>
        </>
      )}
    </button>
  );
}
