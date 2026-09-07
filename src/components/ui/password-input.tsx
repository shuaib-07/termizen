import React, { useState, forwardRef, useRef } from "react";
import { Eye, EyeOff } from "lucide-react";
import { DigitSwap } from "@/components/ui/digit-swap";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface PasswordInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  showToggle?: boolean;
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, value = "", onChange, placeholder, disabled, ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const inputRef = useRef<HTMLInputElement | null>(null);

    const stringValue = String(value || "");
    const maskedValue = "•".repeat(stringValue.length);
    const displayValue = showPassword ? stringValue : maskedValue;

    const toggleShow = () => {
      setShowPassword((prev) => !prev);
    };

    return (
      <div className={cn("relative flex items-center w-full", className)}>
        {/* Visual DigitSwap Overlay when not typing actively or for smooth visual roll */}
        <input
          ref={(el) => {
            inputRef.current = el;
            if (typeof ref === "function") ref(el);
            else if (ref) (ref as React.MutableRefObject<HTMLInputElement | null>).current = el;
          }}
          type={showPassword ? "text" : "password"}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          onFocus={(e) => {
            setIsFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            props.onBlur?.(e);
          }}
          className={cn(
            "flex h-9 w-full rounded-md border border-input bg-background/50 px-3 py-1 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 pr-9 font-mono",
            !isFocused && stringValue.length > 0 && "text-transparent caret-foreground selection:bg-primary/20"
          )}
          {...props}
        />

        {/* Animated DigitSwap Overlay when input is blurred or at rest */}
        {!isFocused && stringValue.length > 0 && (
          <div className="pointer-events-none absolute left-3 flex items-center font-mono text-sm text-foreground overflow-hidden max-w-[calc(100%-2.5rem)]">
            <DigitSwap
              value={displayValue}
              direction={showPassword ? "down" : "up"}
              duration={0.16}
              stagger={0.008}
            />
          </div>
        )}

        <Tooltip content={showPassword ? "Hide password" : "Show password"} side="top">
          <button
            type="button"
            onClick={toggleShow}
            disabled={disabled}
            className="absolute right-2 flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors focus:outline-none cursor-pointer"
            tabIndex={-1}
          >
            {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
        </Tooltip>
      </div>
    );
  }
);

PasswordInput.displayName = "PasswordInput";

export default PasswordInput;
