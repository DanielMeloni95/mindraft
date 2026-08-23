import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("skeleton h-4 w-full", className)} aria-hidden {...props} />;
}

export function SkeletonCard() {
  return (
    <div className="surface-card space-y-3 p-4" aria-hidden>
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-4/5" />
    </div>
  );
}

export function SkeletonList({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Caricamento in corso</span>
      {Array.from({ length: rows }).map((_, index) => (
        <SkeletonCard key={index} />
      ))}
    </div>
  );
}
