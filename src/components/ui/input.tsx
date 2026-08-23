import * as React from "react";

import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = "text", ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        "flex h-9 w-full rounded-[var(--radius-md)] border border-border bg-surface px-3 py-1 text-sm text-foreground shadow-soft transition-colors",
        "placeholder:text-subtle-foreground focus-visible:border-primary disabled:cursor-not-allowed disabled:opacity-60",
        "aria-[invalid=true]:border-danger",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";
