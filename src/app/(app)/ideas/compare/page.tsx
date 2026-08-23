import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { CompareIdeas } from "@/components/ideas/compare-ideas";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { listIdeas } from "@/server/queries/ideas";
import { requireSession } from "@/server/session";

export const metadata = { title: "Confronta idee" };

export default async function CompareIdeasPage() {
  const session = await requireSession();
  const { items } = await listIdeas(session.supabase, session.workspace.id, {
    limit: 60,
    sort: "score",
  });

  return (
    <>
      <div className="mb-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/ideas">
            <ArrowLeft /> Tutte le idee
          </Link>
        </Button>
      </div>

      <PageHeader
        title="Confronta idee"
        description="Da due a cinque idee, la stessa griglia per tutte. La raccomandazione dichiara sempre compromessi e incertezze."
      />

      {items.length < 2 ? (
        <EmptyState
          title="Servono almeno due idee"
          description="Il confronto ha senso quando c'è qualcosa da mettere a fianco."
          action={
            <Button variant="primary" size="sm" asChild>
              <Link href="/inbox">Cattura un pensiero</Link>
            </Button>
          }
        />
      ) : (
        <CompareIdeas
          ideas={items.map((idea) => ({
            id: idea.id,
            title: idea.title,
            score: idea.breakdown.total,
            status: idea.status,
          }))}
        />
      )}
    </>
  );
}
