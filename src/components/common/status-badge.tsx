import { cn } from "@/lib/utils";
import type { Descriptor } from "@/lib/domain/constants";

/**
 * Colour is never the only signal: the label is always rendered, so the
 * badge still reads correctly in monochrome or with colour-blindness.
 */
export function StatusBadge<T extends string>({
  descriptor,
  className,
  title,
}: {
  descriptor: Descriptor<T> | undefined;
  className?: string;
  title?: string;
}) {
  if (!descriptor) return null;
  return (
    <span
      title={title ?? descriptor.hint}
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium leading-5",
        descriptor.className,
        className,
      )}
    >
      {descriptor.label}
    </span>
  );
}
