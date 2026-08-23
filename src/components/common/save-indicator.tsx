"use client";

import { Check, CloudOff, Loader2, TriangleAlert } from "lucide-react";

import { cn } from "@/lib/utils";

export type SaveState = "idle" | "saving" | "saved" | "error" | "offline";

const COPY: Record<SaveState, { label: string; icon: React.ReactNode; className: string }> = {
  idle: { label: "", icon: null, className: "" },
  saving: {
    label: "Salvataggio…",
    icon: <Loader2 className="size-3.5 animate-spin" aria-hidden />,
    className: "text-muted-foreground",
  },
  saved: {
    label: "Salvato",
    icon: <Check className="size-3.5" aria-hidden />,
    className: "text-muted-foreground",
  },
  error: {
    label: "Non salvato",
    icon: <TriangleAlert className="size-3.5" aria-hidden />,
    className: "text-danger",
  },
  offline: {
    label: "Offline: le modifiche restano in questa pagina",
    icon: <CloudOff className="size-3.5" aria-hidden />,
    className: "text-warning",
  },
};

export function SaveIndicator({ state, className }: { state: SaveState; className?: string }) {
  const copy = COPY[state];
  if (!copy.label) return null;
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 text-[12px]", copy.className, className)}
      role="status"
      aria-live="polite"
    >
      {copy.icon}
      {copy.label}
    </span>
  );
}
