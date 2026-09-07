"use client";

import { useState } from "react";
import { Activity, Check, Minimize2, Power } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { setStoredCloseBehavior } from "@/lib/closeSettings";
import { Checkbox } from "@/components/ui/checkbox";

export interface ClosePromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onKeepInBackground: () => void;
  onCloseCompletely: () => void;
}

export function ClosePromptModal({
  isOpen,
  onClose,
  onKeepInBackground,
  onCloseCompletely,
}: ClosePromptModalProps) {
  const [selectedAction, setSelectedAction] = useState<"background" | "quit">("background");
  const [rememberChoice, setRememberChoice] = useState(false);

  const handleConfirm = () => {
    if (rememberChoice) {
      setStoredCloseBehavior(selectedAction);
    }
    onClose();
    if (selectedAction === "background") {
      onKeepInBackground();
    } else {
      onCloseCompletely();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Close Termizen"
      description="Choose how Termizen behaves when the application window is closed."
      icon={<Activity className="h-4 w-4 text-primary" />}
      maxWidth="max-w-md"
    >
      <div className="space-y-4 pt-1 select-none">
        {/* Choice Cards */}
        <div className="grid grid-cols-1 gap-2.5">
          {/* Option 1: Keep in Background */}
          <button
            type="button"
            onClick={() => setSelectedAction("background")}
            className={cn(
              "flex items-start gap-3 p-3 rounded-xl border text-left transition-all cursor-pointer relative",
              selectedAction === "background"
                ? "border-primary/60 bg-primary/10 shadow-xs ring-1 ring-primary/40 text-foreground"
                : "border-border/60 bg-card/60 hover:bg-card/90 text-muted-foreground hover:text-foreground"
            )}
          >
            <div className="mt-0.5 rounded-lg bg-sky-500/15 p-2 text-sky-400 shrink-0">
              <Minimize2 className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0 pr-6">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-xs text-foreground">
                  Keep in Background
                </span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-sky-500/20 text-sky-300 font-medium">
                  Recommended
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                Minimizes to the Windows system tray. 24/7 background monitors and active SSH sessions continue running.
              </p>
            </div>
            {selectedAction === "background" && (
              <div className="absolute top-3 right-3 text-primary">
                <Check className="h-4 w-4" />
              </div>
            )}
          </button>

          {/* Option 2: Close Completely */}
          <button
            type="button"
            onClick={() => setSelectedAction("quit")}
            className={cn(
              "flex items-start gap-3 p-3 rounded-xl border text-left transition-all cursor-pointer relative",
              selectedAction === "quit"
                ? "border-destructive/60 bg-destructive/10 shadow-xs ring-1 ring-destructive/40 text-foreground"
                : "border-border/60 bg-card/60 hover:bg-card/90 text-muted-foreground hover:text-foreground"
            )}
          >
            <div className="mt-0.5 rounded-lg bg-destructive/15 p-2 text-destructive shrink-0">
              <Power className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0 pr-6">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-xs text-foreground">
                  Close Completely
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                Exits Termizen entirely and closes all terminal sessions, background tasks, and active connections.
              </p>
            </div>
            {selectedAction === "quit" && (
              <div className="absolute top-3 right-3 text-destructive">
                <Check className="h-4 w-4" />
              </div>
            )}
          </button>
        </div>

        {/* Remember Choice Checkbox */}
        <div className="pt-2 border-t border-border/40 space-y-1">
          <Checkbox
            checked={rememberChoice}
            onCheckedChange={setRememberChoice}
            label="Remember my choice and don't ask again"
          />
          <p className="text-[10px] text-muted-foreground/70 pl-7">
            You can modify or reset this preference anytime in Settings.
          </p>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            variant={selectedAction === "quit" ? "destructive" : "default"}
            onClick={handleConfirm}
          >
            {selectedAction === "background" ? "Keep in Background" : "Close Completely"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
