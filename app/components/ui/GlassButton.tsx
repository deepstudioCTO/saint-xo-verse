import * as React from "react";
import { cn } from "~/lib/utils";

interface GlassButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  variant?: "default" | "bold";
}

export const GlassButton = React.forwardRef<
  HTMLButtonElement,
  GlassButtonProps
>(({ className, active, disabled, variant = "default", ...props }, ref) => {
  const isBold = variant === "bold";
  return (
    <button
      ref={ref}
      disabled={disabled}
      className={cn(
        "px-2 py-1.5 min-h-[32px] flex items-center text-[11px] tracking-wider font-semibold transition-colors",
        isBold ? "glass-bold" : "glass",
        disabled
          ? "text-black/10 cursor-not-allowed"
          : active
            ? "text-black/60 cursor-pointer"
            : isBold
              ? "text-black/50 hover:text-black/70 cursor-pointer"
              : "text-black/35 hover:text-black/60 cursor-pointer",
        className
      )}
      {...props}
    />
  );
});

GlassButton.displayName = "GlassButton";
