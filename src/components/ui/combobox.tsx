"use client";

import React, { useState, useRef, useEffect, useId } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, Plus, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { SPRING_PANEL } from "@/lib/ease";
import { cn } from "@/lib/utils";

export interface ComboboxItem {
  value: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  color?: string;
}

export interface AnimatedComboboxProps {
  value?: string;
  onChange: (value: string) => void;
  items: ComboboxItem[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  allowCreate?: boolean;
  createPrefix?: string;
  onCreateNew?: () => void;
  createNewText?: string;
  clearLabel?: string;
  clearValue?: string;
  className?: string;
  disabled?: boolean;
  icon?: React.ReactNode;
}

export function AnimatedCombobox({
  value,
  onChange,
  items,
  placeholder = "Select an option...",
  searchPlaceholder = "Search or type to create...",
  emptyText = "No matching options",
  allowCreate = false,
  createPrefix = "Create new folder",
  onCreateNew,
  createNewText = "+ Create a new server...",
  clearLabel,
  clearValue = "",
  className,
  disabled = false,
  icon,
}: AnimatedComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const comboboxId = useId();

  // Find the selected item
  const selectedItem = items.find(
    (item) => String(item.value).toLowerCase() === String(value || "").toLowerCase()
  );

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Focus search input when opened
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    } else {
      setSearchQuery("");
    }
  }, [isOpen]);

  // Handle ESC key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const filteredItems = items.filter((item) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      item.label.toLowerCase().includes(query) ||
      (item.description && item.description.toLowerCase().includes(query))
    );
  });

  const queryTrimmed = searchQuery.trim();
  const exactMatchExists = items.some(
    (item) => item.label.toLowerCase() === queryTrimmed.toLowerCase()
  );
  const showCreateOption = allowCreate && queryTrimmed.length > 0 && !exactMatchExists;

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
  };

  const handleCreate = () => {
    if (!queryTrimmed) return;
    onChange(queryTrimmed);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className={cn(
          "w-full flex items-center justify-between gap-2 px-3 py-2 text-xs rounded-lg border bg-card/70 border-border/70 text-foreground transition-all duration-150 cursor-pointer text-left hover:border-border/90 hover:bg-card/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary shadow-xs",
          isOpen && "border-primary/60 ring-1 ring-primary/40 bg-card/90",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <div className="flex items-center gap-2 truncate min-w-0">
          {selectedItem?.color ? (
            <span
              className="h-2.5 w-2.5 rounded-full shrink-0 shadow-xs border border-white/20"
              style={{ backgroundColor: selectedItem.color }}
            />
          ) : selectedItem?.icon ? (
            <span className="shrink-0 text-muted-foreground">{selectedItem.icon}</span>
          ) : icon ? (
            <span className="shrink-0 text-muted-foreground">{icon}</span>
          ) : value && value !== clearValue ? (
            <span className="h-2 w-2 rounded-full bg-primary/60 shrink-0" />
          ) : null}

          <span
            className={cn(
              "truncate font-medium",
              !value || value === clearValue ? "text-muted-foreground" : "text-foreground"
            )}
          >
            {selectedItem ? selectedItem.label : value && value !== clearValue ? value : placeholder}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0 ml-1">
          {value && value !== clearValue && clearLabel && !disabled && (
            <span
              role="button"
              tabIndex={0}
              title="Clear selection"
              onClick={(e) => {
                e.stopPropagation();
                onChange(clearValue);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.stopPropagation();
                  onChange(clearValue);
                }
              }}
              className="p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-white/[0.08] transition-colors"
            >
              <X className="h-3 w-3" />
            </span>
          )}
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 opacity-70",
              isOpen && "rotate-180 text-primary opacity-100"
            )}
          />
        </div>
      </button>

      {/* Animated Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            id={comboboxId}
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={SPRING_PANEL}
            style={{ transformOrigin: "top center" }}
            className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-xl border border-white/[0.08] bg-zinc-950/95 backdrop-blur-2xl shadow-2xl p-1.5 min-w-[200px]"
          >
            {/* Search input inside dropdown */}
            <div className="relative mb-1 px-0.5">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                ref={searchInputRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (showCreateOption) {
                      handleCreate();
                    } else if (filteredItems.length > 0) {
                      handleSelect(filteredItems[0].value);
                    }
                  }
                }}
                placeholder={searchPlaceholder}
                className="h-7.5 pl-8 pr-2.5 text-xs bg-white/[0.04] border-white/[0.06] rounded-lg text-foreground focus-visible:ring-1 focus-visible:ring-primary"
              />
            </div>

            {/* Options List */}
            <div className="max-h-52 overflow-y-auto space-y-0.5 p-0.5 scrollbar-thin">
              {/* Optional Clear / Default option */}
              {clearLabel && (
                <button
                  type="button"
                  onClick={() => handleSelect(clearValue)}
                  className={cn(
                    "w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-lg transition-colors text-left cursor-pointer",
                    !value || value === clearValue
                      ? "bg-primary/10 text-primary font-semibold"
                      : "text-muted-foreground hover:bg-white/[0.06] hover:text-foreground"
                  )}
                >
                  <span className="truncate italic">{clearLabel}</span>
                  {(!value || value === clearValue) && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                </button>
              )}

              {filteredItems.map((item) => {
                const isSelected =
                  String(item.value).toLowerCase() === String(value || "").toLowerCase();
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => handleSelect(item.value)}
                    className={cn(
                      "w-full flex items-center justify-between gap-2 px-2.5 py-1.5 text-xs rounded-lg transition-colors text-left cursor-pointer",
                      isSelected
                        ? "bg-primary/15 text-primary font-semibold"
                        : "text-zinc-300 hover:bg-white/[0.07] hover:text-foreground"
                    )}
                  >
                    <div className="flex items-center gap-2 truncate min-w-0">
                      {item.color ? (
                        <span
                          className="h-2.5 w-2.5 rounded-full shrink-0 shadow-xs border border-white/20"
                          style={{ backgroundColor: item.color }}
                        />
                      ) : item.icon ? (
                        <span className="shrink-0 opacity-80">{item.icon}</span>
                      ) : null}
                      <div className="truncate">
                        <span className="truncate">{item.label}</span>
                        {item.description && (
                          <span className="block text-[10px] text-muted-foreground truncate font-normal">
                            {item.description}
                          </span>
                        )}
                      </div>
                    </div>
                    {isSelected && <Check className="h-3.5 w-3.5 text-primary shrink-0 ml-1" />}
                  </button>
                );
              })}

              {filteredItems.length === 0 && !showCreateOption && (
                <div className="py-2.5 px-2 text-center text-[11px] text-muted-foreground">
                  {emptyText}
                </div>
              )}

              {/* Create new item on the fly */}
              {showCreateOption && (
                <button
                  type="button"
                  onClick={handleCreate}
                  className="w-full flex items-center gap-2 px-2.5 py-2 text-xs rounded-lg bg-primary/10 hover:bg-primary/20 text-primary font-medium transition-colors text-left border border-primary/20 mt-1 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">
                    {createPrefix} "<span className="font-semibold text-foreground">{queryTrimmed}</span>"
                  </span>
                </button>
              )}

              {/* Action button: create new server / entity */}
              {onCreateNew && (
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onCreateNew();
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-lg text-primary hover:bg-primary/10 transition-colors text-left border-t border-white/[0.06] mt-1 pt-1.5 font-medium cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5 shrink-0" />
                  <span>{createNewText}</span>
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
