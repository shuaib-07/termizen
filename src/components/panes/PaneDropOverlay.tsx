import React from "react";
import { motion } from "framer-motion";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ArrowLeftRight } from "lucide-react";

export type DropZone = "left" | "right" | "top" | "bottom" | "center";

export interface PaneDropOverlayProps {
  zone: DropZone | null;
  targetTitle: string;
}

export const PaneDropOverlay: React.FC<PaneDropOverlayProps> = ({ zone, targetTitle }) => {
  if (!zone) return null;

  const getPositionClasses = () => {
    switch (zone) {
      case "left":
        return "inset-y-0 left-0 w-1/2 rounded-l-xl";
      case "right":
        return "inset-y-0 right-0 w-1/2 rounded-r-xl";
      case "top":
        return "inset-x-0 top-0 h-1/2 rounded-t-xl";
      case "bottom":
        return "inset-x-0 bottom-0 h-1/2 rounded-b-xl";
      case "center":
        return "inset-0 rounded-xl";
    }
  };

  const getLabel = () => {
    switch (zone) {
      case "left":
        return { icon: <ArrowLeft className="h-4 w-4" />, text: "Dock Left" };
      case "right":
        return { icon: <ArrowRight className="h-4 w-4" />, text: "Dock Right" };
      case "top":
        return { icon: <ArrowUp className="h-4 w-4" />, text: "Dock Top" };
      case "bottom":
        return { icon: <ArrowDown className="h-4 w-4" />, text: "Dock Bottom" };
      case "center":
        return {
          icon: <ArrowLeftRight className="h-4 w-4" />,
          text: `Swap with ${targetTitle || "Terminal"}`,
        };
    }
  };

  const { icon, text } = getLabel();

  return (
    <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.15 }}
        className={`absolute ${getPositionClasses()} bg-primary/20 backdrop-blur-[2px] border-2 border-primary/80 flex items-center justify-center shadow-lg`}
      >
        <div className="px-3 py-1.5 rounded-lg bg-zinc-950/90 border border-primary/40 text-primary flex items-center gap-2 text-xs font-medium shadow-md">
          {icon}
          <span>{text}</span>
        </div>
      </motion.div>
    </div>
  );
};
