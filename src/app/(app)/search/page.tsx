import Link from "next/link";
import { Search as SearchIcon } from "lucide-react";

import { PageHeader } from "@/components/common/page-header";
import { RelativeTime } from "@/components/common/relative-time";
import { SearchForm } from "@/components/common/search-form";
import { EmptyState } from "@/components/ui/empty-state";
import { ENTITY_LABELS } from "@/lib/domain/constants";
import { hrefForResult } from "@/lib/search-href";
import { searchWorkspace } from "@/server/queries/search";
import { requireSession } from "@/server/session";
import type { EntityType } from "@/types/database";

export const metadata = { title: "Ricerca" };

const FILTERS: Array<{ value: EntityType; label: string }> = [
  { value: "idea", label: "Idee" },
  { value: "project", label: "Progetti" },
  { value: "document", label: "Documenti" },
  { value: "task", label: "Attività" },
  { value: "decision", label: "Decisioni" },
  { value: "inbox_item", label: "Inbox" },
];

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; types?: string }>;
}) {
  const session = await requireSession();
  const params = await searchParams;
  const query = (params.q ?? "").trim();
  const types = (params.types ?? "").split(",").filter(Boolean) as EntityType[];

  const results =
    query.length >= 2
      ? await searchWorkspace(session.supabase, session.workspace.id, query, {
          types: types.length > 0 ? types : null,
          limit: 50,
        })
      : [];

  return (
    <>
      <PageHeader
        title="Ricerca"
        description="Ricerca full-text su idee, progetti, documenti, attività e decisioni."
      />

      <SearchForm defaultValue={query} />

      <nav className="mb-4 flex flex-wrap gap-1.5" aria-label="Filtra per tipo">
        {FILTERS.map((filter) => {
          const active = types.includes(filter.value);
          const next = active
            ? types.filter((t) => t !== filter.value)
            : [...types, filter.value];
          const search = new URLSearchParams();
          if (query) search.set("q", query);
          if (next.length > 0) search.set("types", next.join(","));
          return (
            <Link
              key={filter.value}
              href={`/search?${search.toString()}`}
              aria-current={active ? "true" : undefined}
              className={
                active
                  ? "rounded-full border border-primary bg-brand-50 px-3 py-1 text-[12px] font-medium text-brand-700 dark:bg-brand-900/40 dark:text-brand-100"
                  : "rounded-full border border-border bg-surface px-3 py-1 text-[12px] font-medium text-muted-foreground hover:border-border-strong"
              }
            >
              {filter.label}
            </Link>
          );
        })}
      </nav>

      {query.length < 2 ? (
        <EmptyState
          icon={SearchIcon}
          title="Cosa stai cercando?"
          description="Scrivi almeno due caratteri. Da qualunque schermata puoi aprire la ricerca rapida con ⌘K."
        />
      ) : results.length === 0 ? (
        <EmptyState
          icon={SearchIcon}
          title={`Nessun risultato per «${query}»`}
          description="La ricerca è testuale: prova con una parola che hai davvero scritto. La ricerca per significato è nel backlog."
        />
      ) : (
        <ul className="surface-card divide-y divide-border">
          {results.map((result) => (
            <li key={`${result.entity_type}-${result.entity_id}`}>
              <Link
                href={hrefForResult(result)}
                className="block px-4 py-3 transition-colors hover:bg-surface-muted"
              >
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                    {ENTITY_LABELS[result.entity_type]}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[14px] font-medium">
                    {result.title}
                  </span>
                  <RelativeTime
                    value={result.updated_at}
                    className="hidden shrink-0 text-[11px] text-subtle-foreground sm:block"
                  />
                </div>
                {result.headline && (
                  <p
                    className="mt-1 text-[13px] leading-relaxed text-muted-foreground [&_mark]:bg-amber-100 [&_mark]:text-foreground dark:[&_mark]:bg-amber-900/60"
                    // The headline comes from ts_headline, which only ever
                    // inserts <mark> around text it was given.
                    dangerouslySetInnerHTML={{ __html: sanitizeHeadline(result.headline) }}
                  />
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/**
 * ts_headline escapes nothing, so we escape everything and then allow
 * back only the <mark> tags it produced.
 */
function sanitizeHeadline(headline: string): string {
  return headline
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/&lt;mark&gt;/g, "<mark>")
    .replace(/&lt;\/mark&gt;/g, "</mark>");
}
