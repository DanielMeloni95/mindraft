"use client";

import Link from "next/link";

import { Progress } from "@/components/ui/progress";
import { Hint } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function UsageIndicator({
  used,
  limit,
  planName,
  collapsed = false,
}: {
  used: number;
  limit: number;
  planName: string;
  collapsed?: boolean;
}) {
  const unlimited = limit < 0;
  const percent = unlimited ? 0 : Math.min(100, (used / Math.max(1, limit)) * 100);
  const nearLimit = !unlimited && percent >= 80;

  if (collapsed) {
    return (
      <Hint label={`Crediti AI: ${used}/${unlimited ? "∞" : limit}`}>
        <Link
          href="/settings/billing"
          className={cn(
            "mx-auto block size-2 rounded-full",
            nearLimit ? "bg-warning" : "bg-accent-500",
          )}
          aria-label={`Crediti AI usati: ${used} su ${unlimited ? "illimitati" : limit}`}
        />
      </Hint>
    );
  }

  return (
    <Link
      href="/settings/billing"
      className="block rounded-[var(--radius-md)] px-2 py-2 transition-colors hover:bg-surface-muted"
    >
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-medium text-foreground">Piano {planName}</span>
        <span className={cn("tabular-nums", nearLimit ? "text-warning" : "text-muted-foreground")}>
          {used}/{unlimited ? "∞" : limit}
        </span>
      </div>
      <Progress value={percent} className="mt-1.5" label="Crediti AI utilizzati questo mese" />
      <span className="mt-1 block text-[11px] text-subtle-foreground">crediti AI questo mese</span>
    </Link>
  );
}
