import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Empty states always offer one real action. A screen that says "niente
 * qui" without a way forward is a dead end.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-[var(--radius-xl)] border border-dashed border-border bg-surface/60 px-6 py-10 text-center",
        className,
      )}
    >
      {Icon && (
        <span className="mb-3 flex size-10 items-center justify-center rounded-full bg-surface-muted text-muted-foreground">
          <Icon className="size-5" aria-hidden />
        </span>
      )}
      <h3 className="font-display text-sm font-semibold text-foreground">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
