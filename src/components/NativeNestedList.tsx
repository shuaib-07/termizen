import type React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { useState } from "react";

export interface ListItem {
  /**
   * Unique identifier for the list item
   */
  id: string;
  /**
   * Display label for the list item
   */
  label: string;
  /**
   * Optional icon component
   */
  icon?: React.ReactNode;
  /**
   * Nested children items
   */
  children?: ListItem[];
  /**
   * Additional metadata
   */
  metadata?: Record<string, unknown>;
  /**
   * Optional URL to navigate to
   */
  href?: string;
  /**
   * Optional click handler
   */
  onClick?: (e: React.MouseEvent) => void;
  /**
   * Optional trailing content (e.g. a close/delete button), rendered right-aligned.
   * Not part of the original component -- added so this list can double as a
   * closable tab switcher / deletable profile list without forking it.
   */
  actions?: React.ReactNode;
  /**
   * Optional secondary row content (e.g. macro controls or sub-actions)
   * rendered on the next line below the item button.
   */
  subRow?: React.ReactNode;
  /**
   * Optional context menu content rendered upon right-click / long-press.
   */
  contextMenu?: React.ReactNode;
}

export interface NativeNestedListProps {
  items: ListItem[];
  activeId?: string;
  onItemClick?: (item: ListItem) => void;
  size?: "sm" | "md" | "lg";
  showExpandIcon?: boolean;
  defaultExpanded?: boolean;
  className?: string;
  indentSize?: number;
}

const sizeVariants = {
  sm: "h-8 text-xs px-2",
  md: "h-10 text-sm px-3",
  lg: "h-12 text-base px-4",
};

const iconSizeVariants = {
  sm: "h-3 w-3",
  md: "h-4 w-4",
  lg: "h-5 w-5",
};

import { ContextMenu, ContextMenuTrigger } from "@/components/ui/context-menu";

interface NestedItemProps {
  item: ListItem;
  level: number;
  activeId?: string;
  onItemClick?: (item: ListItem) => void;
  size: "sm" | "md" | "lg";
  showExpandIcon: boolean;
  defaultExpanded: boolean;
  indentSize: number;
}

function NestedItem({ item, level, activeId, onItemClick, size, showExpandIcon, defaultExpanded, indentSize }: NestedItemProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const hasChildren = item.children && item.children.length > 0;
  const isActive = activeId === item.id;

  const handleClick = (e: React.MouseEvent) => {
    if (hasChildren) {
      e.preventDefault();
      setIsExpanded(!isExpanded);
    }
    onItemClick?.(item);
    item.onClick?.(e);
  };

  const Comp = item.href ? "a" : "span";
  const props = item.href ? { href: item.href } : {};

  const itemButton = (
    <Button
      variant="ghost"
      size="default"
      asChild={!!item.href}
      aria-expanded={hasChildren ? isExpanded : undefined}
      aria-current={isActive ? "true" : undefined}
      className={cn(
        sizeVariants[size],
        "w-full justify-start gap-2 relative overflow-hidden rounded-md transition-colors",
        isActive
          ? "font-semibold bg-background border border-border text-foreground shadow-sm"
          : "hover:bg-accent/40 text-muted-foreground hover:text-foreground"
      )}
      onClick={handleClick}
    >
      <Comp className="flex items-center gap-2 w-full min-w-0" {...props}>
        {showExpandIcon && hasChildren && (
          <motion.div
            initial={false}
            animate={{ rotate: isExpanded ? 90 : 0 }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 20,
            }}
            className="flex-shrink-0"
          >
            <ChevronRight aria-hidden="true" className={iconSizeVariants[size]} />
          </motion.div>
        )}
        {showExpandIcon && !hasChildren && <div className={cn(iconSizeVariants[size], "flex-shrink-0")} />}
        {item.icon && <div className="flex-shrink-0">{item.icon}</div>}
        <span className="truncate flex-1 text-left min-w-0">{item.label}</span>
        {item.actions && (
          <span onClick={(e) => e.stopPropagation()} className="ml-auto flex-shrink-0 flex items-center">
            {item.actions}
          </span>
        )}
      </Comp>
    </Button>
  );

  return (
    <li className="list-none my-0.5">
      <motion.div
        initial={false}
        whileHover={{ x: 3 }}
        transition={{
          type: "spring",
          stiffness: 300,
          damping: 25,
        }}
        style={{ paddingLeft: `${level * indentSize}px` }}
        className="relative rounded-md"
      >
        <div className="relative">
          <motion.div whileTap={{ scale: 0.98 }} transition={{ type: "spring", stiffness: 400, damping: 17 }}>
            {item.contextMenu ? (
              <ContextMenu>
                <ContextMenuTrigger>{itemButton}</ContextMenuTrigger>
                {item.contextMenu}
              </ContextMenu>
            ) : (
              itemButton
            )}
          </motion.div>
          <AnimatePresence>
            {isActive && (
              <motion.div
                aria-hidden="true"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                transition={{
                  type: "spring",
                  stiffness: 500,
                  damping: 30,
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-foreground rounded-full"
              />
            )}
          </AnimatePresence>
        </div>
        {item.subRow && (
          <div className="w-full" onClick={(e) => e.stopPropagation()}>
            {item.subRow}
          </div>
        )}
      </motion.div>
      {/* Nested children */}
      <AnimatePresence initial={false}>
        {hasChildren && isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{
              height: {
                type: "spring",
                stiffness: 300,
                damping: 25,
              },
              opacity: {
                duration: 0.2,
              },
            }}
            style={{ overflow: "hidden" }}
          >
            <ul className="list-none">
              {item.children!.map((child) => (
                <NestedItem
                  key={child.id}
                  item={child}
                  level={level + 1}
                  activeId={activeId}
                  onItemClick={onItemClick}
                  size={size}
                  showExpandIcon={showExpandIcon}
                  defaultExpanded={defaultExpanded}
                  indentSize={indentSize}
                />
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}

export function NativeNestedList({ items, activeId, onItemClick, size = "md", showExpandIcon = true, defaultExpanded = false, className, indentSize = 16 }: NativeNestedListProps) {
  return (
    <MotionConfig reducedMotion="user">
      <ul className={cn("w-full space-y-1 list-none", className)}>
        {items.map((item) => (
          <NestedItem key={item.id} item={item} level={0} activeId={activeId} onItemClick={onItemClick} size={size} showExpandIcon={showExpandIcon} defaultExpanded={defaultExpanded} indentSize={indentSize} />
        ))}
      </ul>
    </MotionConfig>
  );
}
