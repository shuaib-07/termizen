import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  maxWidth?: string;
}

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  icon,
  children,
  className,
  maxWidth = "max-w-lg",
}: ModalProps) {
  // "closed" | "open" | "closing"
  const [state, setState] = useState<"closed" | "open" | "closing">(isOpen ? "open" : "closed");

  useEffect(() => {
    if (isOpen) {
      setState("open");
    } else if (state === "open") {
      setState("closing");
      const id = window.setTimeout(() => setState("closed"), 150);
      return () => window.clearTimeout(id);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (state === "closed") return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm t-modal-backdrop",
        state === "open" && "is-open",
        state === "closing" && "is-closing"
      )}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <Card
        role="dialog"
        aria-modal="true"
        className={cn(
          "t-modal w-full p-5 space-y-4 border-border/90 bg-card/85 backdrop-blur-xl shadow-2xl rounded-2xl overflow-y-auto max-h-[90vh]",
          state === "open" && "is-open",
          state === "closing" && "is-closing",
          maxWidth,
          className
        )}
      >
        {(title || icon) && (
          <div className="flex items-center justify-between border-b border-border/40 pb-3">
            <div className="flex items-center gap-2.5">
              {icon && (
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20 flex-shrink-0">
                  {icon}
                </div>
              )}
              <div>
                {title && <h3 className="font-semibold text-foreground text-sm">{title}</h3>}
                {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {children}
      </Card>
    </div>
  );
}

export default Modal;
