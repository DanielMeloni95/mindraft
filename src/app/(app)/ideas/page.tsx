import Link from "next/link";
import { Lightbulb, Scale } from "lucide-react";

import { PageHeader } from "@/components/common/page-header";
import { StatusBadge } from "@/components/common/status-badge";
import { RelativeTime } from "@/components/common/relative-time";
import { IdeaCard } from "@/components/ideas/idea-card";
import { IdeaFilterBar, type IdeaView } from "@/components/ideas/idea-filter-bar";
import { IdeaMatrix } from "@/components/ideas/idea-matrix";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { IDEA_STATUS_MAP } from "@/lib/domain/constants";
import { truncate } from "@/lib/utils";
import { listCategories, listIdeas } from "@/server/queries/ideas";
import { requireSession } from "@/server/session";
import type { IdeaStatus } from "@/types/database";

export const metadata = { title: "Idee" };

export default async function IdeasPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    category?: string;
    sort?: string;
    view?: string;
  }>;
}) {
  const session = await requireSession();
  const params = await searchParams;

  const view: IdeaView =
    params.view === "list" || params.view === "matrix" ? params.view : "cards";

  const statuses = (params.status ?? "")
    .split(",")
    .filter(Boolean) as IdeaStatus[];

  const [{ items }, categories] = await Promise.all([
    listIdeas(session.supabase, session.workspace.id, {
      search: params.q ?? null,
      status: statuses.length > 0 ? statuses : null,
      category: params.category ?? null,
      sort:
        params.sort === "created" || params.sort === "score" || params.sort === "alpha"
          ? params.sort
          : "recent",
      limit: 60,
    }),
    listCategories(session.supabase, session.workspace.id),
  ]);

  return (
    <>
      <PageHeader
        title="Idee"
        description="Il contenuto originale resta sempre visibile: tutto il resto è aggiunto sopra."
        actions={
          <Button variant="secondary" size="sm" asChild>
            <Link href="/ideas/compare">
              <Scale /> Confronta
            </Link>
          </Button>
        }
      />

      <IdeaFilterBar categories={categories} view={view} />

      {items.length === 0 ? (
        <EmptyState
          icon={Lightbulb}
          title="Nessuna idea con questi filtri"
          description="Le idee nascono dall'Inbox: cattura un pensiero e trasformalo in idea in un clic."
          action={
            <Button variant="primary" size="sm" asChild>
              <Link href="/inbox">Vai all&apos;Inbox</Link>
            </Button>
          }
        />
      ) : view === "matrix" ? (
        <IdeaMatrix ideas={items} />
      ) : view === "list" ? (
        <ul className="surface-card divide-y divide-border">
          {items.map((idea) => (
            <li key={idea.id}>
              <Link
                href={`/ideas/${idea.id}`}
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-muted"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium">{idea.title}</span>
                  <span className="block truncate text-[12px] text-muted-foreground">
                    {truncate(idea.summary ?? idea.original_content, 110)}
                  </span>
                </span>
                <StatusBadge descriptor={IDEA_STATUS_MAP[idea.status]} />
                <span className="w-12 shrink-0 text-right text-[12px] tabular-nums text-muted-foreground">
                  {idea.breakdown.total ?? "—"}
                </span>
                <RelativeTime
                  value={idea.updated_at}
                  className="hidden w-24 shrink-0 text-right text-[11px] text-subtle-foreground sm:block"
                />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((idea) => (
            <IdeaCard key={idea.id} idea={idea} />
          ))}
        </ul>
      )}
    </>
  );
}
