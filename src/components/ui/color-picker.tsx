"use client";

import React, { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { SPRING_PANEL } from "@/lib/ease";
import { FLUENT_FOLDER_COLORS } from "@/lib/folderMetadata";

// Helper functions for color conversion
export const hslToHex = (h: number, s: number, l: number): string => {
  l /= 100;
  const a = (s * Math.min(l, 1 - l)) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
};

export const hexToHsl = (hex: string): [number, number, number] => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return [0, 0, 0];

  const r = parseInt(result[1], 16) / 255;
  const g = parseInt(result[2], 16) / 255;
  const b = parseInt(result[3], 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
};

export const normalizeColor = (color: string): string => {
  if (color.startsWith("#")) {
    return color.toUpperCase();
  } else if (color.startsWith("hsl")) {
    const [h, s, l] = color.match(/\d+(\.\d+)?/g)?.map(Number) || [0, 0, 0];
    return `hsl(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%)`;
  }
  return color;
};

const trimColorString = (color: string, maxLength: number = 20): string => {
  if (color.length <= maxLength) return color;
  return `${color.slice(0, maxLength - 3)}...`;
};

export interface ColorPickerProps {
  color: string;
  onChange: (color: string) => void;
  className?: string;
  align?: "left" | "right";
}

export function ColorPicker({
  color,
  onChange,
  className,
  align = "left",
}: ColorPickerProps) {
  const [hsl, setHsl] = useState<[number, number, number]>([0, 0, 0]);
  const [colorInput, setColorInput] = useState(color);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    handleColorChange(color);
  }, [color]);

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleColorChange = (newColor: string) => {
    const normalizedColor = normalizeColor(newColor);
    setColorInput(normalizedColor);

    let h = 0, s = 0, l = 0;
    if (normalizedColor.startsWith("#")) {
      [h, s, l] = hexToHsl(normalizedColor);
    } else {
      [h, s, l] = normalizedColor.match(/\d+(\.\d+)?/g)?.map(Number) || [0, 0, 0];
    }

    setHsl([h, s, l]);
    // Always provide clean hex if starting with #, or hex form for easy storage
    if (newColor.startsWith("#")) {
      onChange(newColor.toUpperCase());
    } else {
      onChange(hslToHex(h, s, l));
    }
  };

  const handleHueChange = (hue: number) => {
    const newHsl: [number, number, number] = [hue, hsl[1], hsl[2]];
    setHsl(newHsl);
    const hex = hslToHex(newHsl[0], newHsl[1], newHsl[2]);
    setColorInput(hex);
    onChange(hex);
  };

  const handleSaturationLightnessChange = (
    event: React.MouseEvent<HTMLDivElement>
  ) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const s = Math.min(100, Math.max(0, Math.round((x / rect.width) * 100)));
    const l = Math.min(100, Math.max(0, Math.round(100 - (y / rect.height) * 100)));
    const newHsl: [number, number, number] = [hsl[0], s, l];
    setHsl(newHsl);
    const hex = hslToHex(newHsl[0], newHsl[1], newHsl[2]);
    setColorInput(hex);
    onChange(hex);
  };

  const handleColorInputChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const newColor = event.target.value;
    setColorInput(newColor);
    if (
      /^#[0-9A-Fa-f]{6}$/.test(newColor) ||
      /^hsl\(\d+,\s*\d+%,\s*\d+%\)$/.test(newColor)
    ) {
      handleColorChange(newColor);
    }
  };

  const colorPresets = FLUENT_FOLDER_COLORS;

  return (
    <div ref={containerRef} className={cn("relative inline-block", className)}>
      {/* Trigger Button */}
      <Button
        type="button"
        variant="outline"
        onClick={() => setIsOpen(!isOpen)}
        className="w-[180px] justify-start text-left font-normal bg-card/60 hover:bg-card/80 border-border h-8.5 px-2.5 text-xs cursor-pointer shadow-xs"
      >
        <div
          className="w-3.5 h-3.5 rounded-full mr-2 shadow-xs border border-white/20 shrink-0"
          style={{ backgroundColor: colorInput }}
        />
        <span className="flex-grow font-mono truncate">{trimColorString(colorInput)}</span>
        <ChevronDown className={cn("h-3.5 w-3.5 opacity-50 transition-transform duration-150", isOpen && "rotate-180")} />
      </Button>

      {/* Popover Dropdown Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -4 }}
            transition={SPRING_PANEL}
            style={{ transformOrigin: "top center" }}
            className={cn(
              "absolute top-full z-50 mt-1.5 w-[250px] rounded-xl border border-white/10 bg-[#16171b] p-3 text-foreground shadow-2xl space-y-3 select-none",
              align === "right" ? "right-0" : "left-0"
            )}
          >
            {/* Saturation / Lightness Picker Pad */}
            <div
              className="w-full h-32 rounded-lg cursor-crosshair relative overflow-hidden shadow-inner border border-white/10"
              style={{
                background: `
                  linear-gradient(to top, rgba(0, 0, 0, 1), transparent),
                  linear-gradient(to right, rgba(255, 255, 255, 1), rgba(255, 0, 0, 0)),
                  hsl(${hsl[0]}, 100%, 50%)
                `,
              }}
              onClick={handleSaturationLightnessChange}
            >
              <motion.div
                className="w-3.5 h-3.5 rounded-full border-2 border-white absolute shadow-md -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                style={{
                  left: `${hsl[1]}%`,
                  top: `${100 - hsl[2]}%`,
                  backgroundColor: `hsl(${hsl[0]}, ${hsl[1]}%, ${hsl[2]}%)`,
                }}
              />
            </div>

            {/* Hue Rainbow Slider */}
            <input
              type="range"
              min="0"
              max="360"
              value={hsl[0]}
              onChange={(e) => handleHueChange(Number(e.target.value))}
              className="w-full h-2.5 rounded-full appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, 
                  hsl(0, 100%, 50%), hsl(60, 100%, 50%), hsl(120, 100%, 50%), 
                  hsl(180, 100%, 50%), hsl(240, 100%, 50%), hsl(300, 100%, 50%), hsl(360, 100%, 50%)
                )`,
              }}
            />

            {/* Hex Input & Color Chip */}
            <div className="flex items-center space-x-2">
              <label htmlFor="color-input" className="sr-only">
                Color
              </label>
              <Input
                id="color-input"
                type="text"
                value={colorInput}
                onChange={handleColorInputChange}
                className="flex-grow bg-white/[0.04] border border-white/[0.08] text-foreground rounded-md text-xs font-mono h-7 px-2"
                placeholder="#RRGGBB"
              />
              <div
                className="w-7 h-7 rounded-md shadow-xs border border-white/20 shrink-0"
                style={{ backgroundColor: colorInput }}
              />
            </div>

            {/* Presets Grid */}
            <div>
              <div className="text-[10px] uppercase font-semibold text-muted-foreground/70 mb-1.5">
                Fluent Presets
              </div>
              <div className="grid grid-cols-6 gap-1.5">
                {colorPresets.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    className="w-7 h-7 rounded-md relative flex items-center justify-center transition-transform hover:scale-110 active:scale-95 border border-white/10 cursor-pointer"
                    style={{ backgroundColor: preset }}
                    onClick={() => handleColorChange(preset)}
                  >
                    {colorInput.toUpperCase() === preset.toUpperCase() && (
                      <Check className="w-3.5 h-3.5 text-white drop-shadow-md stroke-[3]" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default ColorPicker;
