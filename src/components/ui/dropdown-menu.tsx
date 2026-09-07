import * as React from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { AnimatePresence, motion, type HTMLMotionProps } from "framer-motion";
import { Check, ChevronRight, Circle } from "lucide-react";
import { SPRING_LAYOUT, SPRING_PANEL } from "@/lib/ease";
import { cn } from "@/lib/utils";

// ── Shared Highlight State ───────────────────────────────────────────────────
interface HighlightContextValue {
  activeId: string | null;
  setActiveId: (id: string | null) => void;
  variantMap: React.MutableRefObject<Map<string, string>>;
}

const HighlightContext = React.createContext<HighlightContextValue | null>(null);

function useHighlight() {
  return React.useContext(HighlightContext);
}

// ── Primitives ───────────────────────────────────────────────────────────────
const DropdownMenu = DropdownMenuPrimitive.Root;
const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
const DropdownMenuGroup = DropdownMenuPrimitive.Group;
const DropdownMenuPortal = DropdownMenuPrimitive.Portal;
const DropdownMenuSub = DropdownMenuPrimitive.Sub;
const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;

// ── DropdownMenuHighlight ───────────────────────────────────────────────────
function DropdownMenuHighlight({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("relative", className)}>{children}</div>;
}

// ── DropdownMenuHighlightItem ───────────────────────────────────────────────
type HighlightChildProps = React.HTMLAttributes<HTMLElement> & {
  children?: React.ReactNode;
};

function DropdownMenuHighlightItem({
  children,
  activeClassName,
  disabled,
}: {
  children: React.ReactElement<HighlightChildProps>;
  activeClassName?: string;
  disabled?: boolean;
}) {
  const highlight = useHighlight();
  const itemId = React.useId();

  React.useEffect(() => {
    if (activeClassName && highlight) {
      highlight.variantMap.current.set(itemId, activeClassName);
      return () => {
        highlight.variantMap.current.delete(itemId);
      };
    }
  }, [activeClassName, highlight, itemId]);

  if (!React.isValidElement<HighlightChildProps>(children)) return null;

  const isActive = highlight?.activeId === itemId && !disabled;
  const childProps = children.props;

  return React.cloneElement(children, {
    onMouseEnter: (e: React.MouseEvent<HTMLElement>) => {
      childProps.onMouseEnter?.(e);
      if (!disabled) highlight?.setActiveId(itemId);
    },
    onFocus: (e: React.FocusEvent<HTMLElement>) => {
      childProps.onFocus?.(e);
      if (!disabled) highlight?.setActiveId(itemId);
    },
    children: (
      <>
        {isActive ? (
          <motion.span
            layoutId="dropdown-menu-highlight"
            className={cn(
              "absolute inset-0 -z-10 rounded-md bg-white/[0.08]",
              activeClassName,
            )}
            transition={SPRING_LAYOUT}
          />
        ) : null}
        {childProps.children}
      </>
    ),
  } as Partial<HighlightChildProps>);
}

// ── DropdownMenuContent ─────────────────────────────────────────────────────
type DropdownMenuContentProps = React.ComponentPropsWithoutRef<
  typeof DropdownMenuPrimitive.Content
>;

const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  DropdownMenuContentProps
>(({ className, sideOffset = 4, children, ...props }, ref) => {
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const variantMap = React.useRef<Map<string, string>>(new Map());

  return (
    <DropdownMenuPortal>
      <DropdownMenuPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        onMouseLeave={() => setActiveId(null)}
        className={cn(
          "t-dropdown z-50 min-w-[9rem] overflow-hidden rounded-xl border border-white/[0.08] bg-zinc-950/98 p-1.5 text-foreground shadow-2xl backdrop-blur-2xl outline-none",
          className,
        )}
        {...props}
      >
        <HighlightContext.Provider value={{ activeId, setActiveId, variantMap }}>
          <DropdownMenuHighlight>{children}</DropdownMenuHighlight>
        </HighlightContext.Provider>
      </DropdownMenuPrimitive.Content>
    </DropdownMenuPortal>
  );
});
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName;

// ── DropdownMenuItem ────────────────────────────────────────────────────────
interface DropdownMenuItemProps
  extends React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> {
  inset?: boolean;
  variant?: "default" | "destructive";
}

const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  DropdownMenuItemProps
>(({ className, inset, variant = "default", disabled, ...props }, ref) => {
  return (
    <DropdownMenuHighlightItem
      activeClassName={
        variant === "destructive" ? "bg-red-500/15 text-red-300" : ""
      }
      disabled={disabled}
    >
      <DropdownMenuPrimitive.Item
        ref={ref}
        disabled={disabled}
        data-inset={inset}
        data-variant={variant}
        className={cn(
          "relative isolate flex cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs outline-none transition-colors",
          "focus:text-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-40",
          inset && "pl-8",
          variant === "destructive"
            ? "text-red-400 hover:text-red-300"
            : "text-foreground",
          className,
        )}
        {...props}
      />
    </DropdownMenuHighlightItem>
  );
});
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName;

// ── DropdownMenuItemIndicator ───────────────────────────────────────────────
function DropdownMenuItemIndicator({
  children,
  layoutId,
  ...props
}: HTMLMotionProps<"span">) {
  return (
    <motion.span
      layoutId={layoutId}
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.6 }}
      transition={SPRING_PANEL}
      className="inline-flex items-center justify-center"
      {...props}
    >
      {children}
    </motion.span>
  );
}

// ── DropdownMenuCheckboxItem ────────────────────────────────────────────────
interface DropdownMenuCheckboxItemProps
  extends React.ComponentPropsWithoutRef<
    typeof DropdownMenuPrimitive.CheckboxItem
  > {}

const DropdownMenuCheckboxItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.CheckboxItem>,
  DropdownMenuCheckboxItemProps
>(({ className, children, checked, disabled, ...props }, ref) => {
  return (
    <DropdownMenuHighlightItem disabled={disabled}>
      <DropdownMenuPrimitive.CheckboxItem
        ref={ref}
        disabled={disabled}
        checked={checked}
        className={cn(
          "relative isolate flex cursor-pointer select-none items-center gap-2 rounded-lg py-1.5 pr-2.5 pl-8 text-xs outline-none transition-colors",
          "focus:text-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-40",
          className,
        )}
        {...props}
      >
        <span className="pointer-events-none absolute left-2.5 flex h-3.5 w-3.5 items-center justify-center">
          <AnimatePresence initial={false}>
            {checked ? (
              <DropdownMenuItemIndicator>
                <Check className="h-3.5 w-3.5 text-primary" strokeWidth={2.4} />
              </DropdownMenuItemIndicator>
            ) : null}
          </AnimatePresence>
        </span>
        {children}
      </DropdownMenuPrimitive.CheckboxItem>
    </DropdownMenuHighlightItem>
  );
});
DropdownMenuCheckboxItem.displayName =
  DropdownMenuPrimitive.CheckboxItem.displayName;

// ── DropdownMenuRadioItem ───────────────────────────────────────────────────
interface DropdownMenuRadioItemProps
  extends React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.RadioItem> {}

const DropdownMenuRadioItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.RadioItem>,
  DropdownMenuRadioItemProps
>(({ className, children, disabled, ...props }, ref) => {
  return (
    <DropdownMenuHighlightItem disabled={disabled}>
      <DropdownMenuPrimitive.RadioItem
        ref={ref}
        disabled={disabled}
        className={cn(
          "relative isolate flex cursor-pointer select-none items-center gap-2 rounded-lg py-1.5 pr-2.5 pl-8 text-xs outline-none transition-colors",
          "focus:text-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-40",
          className,
        )}
        {...props}
      >
        <span className="pointer-events-none absolute left-2.5 flex h-3.5 w-3.5 items-center justify-center">
          <DropdownMenuPrimitive.ItemIndicator>
            <DropdownMenuItemIndicator layoutId="dropdown-menu-radio-indicator">
              <Circle className="h-2 w-2 fill-primary text-primary" />
            </DropdownMenuItemIndicator>
          </DropdownMenuPrimitive.ItemIndicator>
        </span>
        {children}
      </DropdownMenuPrimitive.RadioItem>
    </DropdownMenuHighlightItem>
  );
});
DropdownMenuRadioItem.displayName = DropdownMenuPrimitive.RadioItem.displayName;

// ── DropdownMenuLabel ───────────────────────────────────────────────────────
interface DropdownMenuLabelProps
  extends React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label> {
  inset?: boolean;
}

const DropdownMenuLabel = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Label>,
  DropdownMenuLabelProps
>(({ className, inset, ...props }, ref) => (
  <DropdownMenuPrimitive.Label
    ref={ref}
    data-inset={inset}
    className={cn(
      "px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground",
      inset && "pl-8",
      className,
    )}
    {...props}
  />
));
DropdownMenuLabel.displayName = DropdownMenuPrimitive.Label.displayName;

// ── DropdownMenuSeparator ───────────────────────────────────────────────────
const DropdownMenuSeparator = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-white/[0.06]", className)}
    {...props}
  />
));
DropdownMenuSeparator.displayName = DropdownMenuPrimitive.Separator.displayName;

// ── DropdownMenuShortcut ────────────────────────────────────────────────────
function DropdownMenuShortcut({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "ml-auto text-[10px] font-medium tracking-wider text-muted-foreground/70",
        className,
      )}
      {...props}
    />
  );
}

// ── DropdownMenuSubTrigger ──────────────────────────────────────────────────
interface DropdownMenuSubTriggerProps
  extends React.ComponentPropsWithoutRef<
    typeof DropdownMenuPrimitive.SubTrigger
  > {
  inset?: boolean;
}

const DropdownMenuSubTrigger = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.SubTrigger>,
  DropdownMenuSubTriggerProps
>(({ className, inset, children, disabled, ...props }, ref) => (
  <DropdownMenuHighlightItem disabled={disabled}>
    <DropdownMenuPrimitive.SubTrigger
      ref={ref}
      disabled={disabled}
      data-inset={inset}
      className={cn(
        "relative isolate flex cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs outline-none transition-colors",
        "focus:text-foreground data-[state=open]:text-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-40",
        inset && "pl-8",
        className,
      )}
      {...props}
    >
      {children}
      <ChevronRight className="ml-auto h-3.5 w-3.5 text-muted-foreground transition-transform duration-200" />
    </DropdownMenuPrimitive.SubTrigger>
  </DropdownMenuHighlightItem>
));
DropdownMenuSubTrigger.displayName =
  DropdownMenuPrimitive.SubTrigger.displayName;

// ── DropdownMenuSubContent ──────────────────────────────────────────────────
const DropdownMenuSubContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.SubContent>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubContent>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.SubContent
    ref={ref}
    className={cn(
      "z-50 min-w-[9rem] overflow-hidden rounded-xl border border-white/[0.08] bg-zinc-950/98 p-1.5 text-foreground shadow-2xl backdrop-blur-2xl outline-none",
      "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
      className,
    )}
    {...props}
  />
));
DropdownMenuSubContent.displayName =
  DropdownMenuPrimitive.SubContent.displayName;

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuHighlight,
  DropdownMenuHighlightItem,
  DropdownMenuItemIndicator,
};
