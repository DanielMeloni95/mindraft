import { cn, initials } from "@/lib/utils";

export function Avatar({
  name,
  size = "md",
  className,
}: {
  name: string | null | undefined;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-brand-100 font-medium text-brand-700 dark:bg-brand-900/60 dark:text-brand-200",
        size === "sm" ? "size-6 text-[10px]" : "size-8 text-xs",
        className,
      )}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}
