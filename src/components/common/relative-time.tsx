"use client";

import * as React from "react";

const UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["week", 7 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
];

export function formatRelative(iso: string, now = Date.now()): string {
  const diffSeconds = (new Date(iso).getTime() - now) / 1000;
  const formatter = new Intl.RelativeTimeFormat("it", { numeric: "auto" });
  for (const [unit, seconds] of UNITS) {
    if (Math.abs(diffSeconds) >= seconds) {
      return formatter.format(Math.round(diffSeconds / seconds), unit);
    }
  }
  return "adesso";
}

/**
 * Rendered on the client only after mount, so the server HTML and the
 * first client paint cannot disagree about "now".
 */
export function RelativeTime({ value, className }: { value: string; className?: string }) {
  const [label, setLabel] = React.useState<string | null>(null);

  React.useEffect(() => {
    setLabel(formatRelative(value));
    const timer = setInterval(() => setLabel(formatRelative(value)), 60_000);
    return () => clearInterval(timer);
  }, [value]);

  const absolute = new Date(value).toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <time dateTime={value} title={absolute} className={className} suppressHydrationWarning>
      {label ?? absolute}
    </time>
  );
}
