import * as React from "react";

import { cn } from "@/lib/utils";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "flex min-h-20 w-full rounded-[var(--radius-md)] border border-border bg-surface px-3 py-2 text-sm text-foreground shadow-soft transition-colors",
      "placeholder:text-subtle-foreground focus-visible:border-primary disabled:cursor-not-allowed disabled:opacity-60",
      "aria-[invalid=true]:border-danger",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";
