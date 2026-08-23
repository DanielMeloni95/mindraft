"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LayoutGrid, List, Rows3, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IDEA_STATUSES } from "@/lib/domain/constants";
import { cn } from "@/lib/utils";

export type IdeaView = "cards" | "list" | "matrix";

/**
 * Filters live in the URL: a filtered view is shareable, survives a
 * refresh and can be saved as a view without extra state.
 */
export function IdeaFilterBar({
  categories,
  view,
}: {
  categories: string[];
  view: IdeaView;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [term, setTerm] = React.useState(params.get("q") ?? "");

  const activeStatuses = (params.get("status") ?? "").split(",").filter(Boolean);

  const push = React.useCallback(
    (mutate: (next: URLSearchParams) => void) => {
      const next = new URLSearchParams(params.toString());
      mutate(next);
      const query = next.toString();
      router.push(query ? `${pathname}?${query}` : pathname);
    },
    [params, pathname, router],
  );

  React.useEffect(() => {
    const timer = setTimeout(() => {
      const current = params.get("q") ?? "";
      if (term === current) return;
      push((next) => {
        if (term.trim()) next.set("q", term.trim());
        else next.delete("q");
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [term, params, push]);

  const toggleStatus = (value: string) => {
    push((next) => {
      const set = new Set(activeStatuses);
      if (set.has(value)) set.delete(value);
      else set.add(value);
      if (set.size === 0) next.delete("status");
      else next.set("status", [...set].join(","));
    });
  };

  const hasFilters = activeStatuses.length > 0 || Boolean(params.get("q")) || Boolean(params.get("category"));

  return (
    <div className="mb-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Filtra le idee…"
            aria-label="Filtra le idee"
            className="pl-8"
          />
        </div>

        <select
          value={params.get("category") ?? ""}
          onChange={(event) =>
            push((next) => {
              if (event.target.value) next.set("category", event.target.value);
              else next.delete("category");
            })
          }
          aria-label="Categoria"
          className="h-9 rounded-[var(--radius-md)] border border-border bg-surface px-2 text-[13px]"
        >
          <option value="">Tutte le categorie</option>
          {categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>

        <select
          value={params.get("sort") ?? "recent"}
          onChange={(event) =>
            push((next) => {
              if (event.target.value === "recent") next.delete("sort");
              else next.set("sort", event.target.value);
            })
          }
          aria-label="Ordinamento"
          className="h-9 rounded-[var(--radius-md)] border border-border bg-surface px-2 text-[13px]"
        >
          <option value="recent">Aggiornate di recente</option>
          <option value="created">Più recenti</option>
          <option value="score">Punteggio</option>
          <option value="alpha">Alfabetico</option>
        </select>

        <div className="flex rounded-[var(--radius-md)] border border-border bg-surface p-0.5" role="group" aria-label="Vista">
          {(
            [
              { value: "cards", label: "Card", icon: LayoutGrid },
              { value: "list", label: "Lista", icon: List },
              { value: "matrix", label: "Matrice", icon: Rows3 },
            ] as const
          ).map((option) => {
            const Icon = option.icon;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={view === option.value}
                aria-label={option.label}
                onClick={() =>
                  push((next) => {
                    if (option.value === "cards") next.delete("view");
                    else next.set("view", option.value);
                  })
                }
                className={cn(
                  "rounded-[var(--radius-sm)] p-1.5 transition-colors",
                  view === option.value
                    ? "bg-surface-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {IDEA_STATUSES.map((status) => {
          const active = activeStatuses.includes(status.value);
          return (
            <button
              key={status.value}
              type="button"
              aria-pressed={active}
              onClick={() => toggleStatus(status.value)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[12px] font-medium transition-colors",
                active
                  ? "border-primary bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-100"
                  : "border-border bg-surface text-muted-foreground hover:border-border-strong",
              )}
            >
              {status.label}
            </button>
          );
        })}

        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setTerm("");
              router.push(pathname);
            }}
          >
            <X /> Azzera
          </Button>
        )}
      </div>
    </div>
  );
}
