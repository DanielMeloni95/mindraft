"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import {
  CheckSquare,
  FileText,
  FolderKanban,
  Inbox,
  Lightbulb,
  Loader2,
  Search,
  Sparkles,
} from "lucide-react";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { PRIMARY_NAV, SECONDARY_NAV } from "./nav-items";
import type { SearchResultRow } from "@/types/database";
import { hrefForResult } from "@/lib/search-href";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  idea: Lightbulb,
  project: FolderKanban,
  task: CheckSquare,
  decision: Sparkles,
  document: FileText,
  inbox_item: Inbox,
};

const TYPE_LABEL: Record<string, string> = {
  idea: "Idea",
  project: "Progetto",
  task: "Attività",
  decision: "Decisione",
  document: "Documento",
  inbox_item: "Inbox",
};

/**
 * ⌘K / Ctrl+K. Navigation is instant and local; content search hits the
 * same Postgres full-text function the search page uses, debounced.
 */
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SearchResultRow[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  React.useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(term)}&limit=8`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("search failed");
        const payload = (await response.json()) as { results: SearchResultRow[] };
        setResults(payload.results);
      } catch (error) {
        if ((error as Error).name !== "AbortError") setResults([]);
      } finally {
        setLoading(false);
      }
    }, 220);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query]);

  const go = (href: string) => {
    setOpen(false);
    setQuery("");
    router.push(href);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-xl p-0" hideClose>
        <DialogTitle className="sr-only">Comandi e ricerca</DialogTitle>
        <Command
          shouldFilter={false}
          className="overflow-hidden rounded-[var(--radius-2xl)]"
          loop
        >
          <div className="flex items-center gap-2 border-b border-border px-4">
            <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <Command.Input
              value={query}
              onValueChange={setQuery}
              placeholder="Cerca o vai a…"
              className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-subtle-foreground"
            />
            {loading && <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden />}
          </div>

          <Command.List className="max-h-80 overflow-y-auto scrollbar-thin p-2">
            <Command.Empty className="px-3 py-6 text-center text-[13px] text-muted-foreground">
              {query.trim().length < 2
                ? "Scrivi almeno due caratteri per cercare."
                : "Nessun risultato. Prova con un'altra parola."}
            </Command.Empty>

            {results.length > 0 && (
              <Command.Group
                heading="Risultati"
                className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-subtle-foreground"
              >
                {results.map((result) => {
                  const Icon = ICONS[result.entity_type] ?? FileText;
                  return (
                    <Command.Item
                      key={`${result.entity_type}-${result.entity_id}`}
                      value={`${result.entity_id}`}
                      onSelect={() => go(hrefForResult(result))}
                      className="flex cursor-pointer items-start gap-2.5 rounded-[var(--radius-md)] px-2.5 py-2 text-sm data-[selected=true]:bg-surface-muted"
                    >
                      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{result.title}</span>
                        {result.excerpt && (
                          <span className="block truncate text-[12px] text-muted-foreground">
                            {result.excerpt}
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 text-[11px] text-subtle-foreground">
                        {TYPE_LABEL[result.entity_type] ?? ""}
                      </span>
                    </Command.Item>
                  );
                })}
              </Command.Group>
            )}

            <Command.Group
              heading="Vai a"
              className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-subtle-foreground"
            >
              {[...PRIMARY_NAV, ...SECONDARY_NAV]
                .filter((item) =>
                  query.trim().length < 2
                    ? true
                    : item.label.toLowerCase().includes(query.trim().toLowerCase()),
                )
                .map((item) => {
                  const Icon = item.icon;
                  return (
                    <Command.Item
                      key={item.href}
                      value={item.href}
                      onSelect={() => go(item.href)}
                      className="flex cursor-pointer items-center gap-2.5 rounded-[var(--radius-md)] px-2.5 py-2 text-sm data-[selected=true]:bg-surface-muted"
                    >
                      <Icon className="size-4 text-muted-foreground" />
                      {item.label}
                    </Command.Item>
                  );
                })}
            </Command.Group>
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
