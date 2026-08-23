"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";

import { Button } from "./button";

export function ErrorState({
  title = "Qualcosa non ha funzionato",
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-3 rounded-[var(--radius-xl)] border border-rose-200 bg-rose-50 p-4 text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100"
    >
      <div className="flex items-center gap-2">
        <AlertTriangle className="size-4" aria-hidden />
        <span className="font-display text-sm font-semibold">{title}</span>
      </div>
      <p className="text-[13px] leading-relaxed">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          <RefreshCw /> Riprova
        </Button>
      )}
    </div>
  );
}
