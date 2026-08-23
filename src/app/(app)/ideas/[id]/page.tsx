import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, Link2 } from "lucide-react";

import { IdeaToProjectPanel } from "@/components/ai/idea-to-project-panel";
import { RelativeTime } from "@/components/common/relative-time";
import { IdeaAssist } from "@/components/ideas/idea-assist";
import { IdeaFields } from "@/components/ideas/idea-fields";
import { ScoreEditor } from "@/components/ideas/score-editor";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RELATION_MAP } from "@/lib/domain/constants";
import {
  parseCitations,
  parseSections,
  type ProposalView,
} from "@/lib/domain/proposals";
import { SCORING_CRITERIA } from "@/lib/domain/scoring";
import { getIdea } from "@/server/queries/ideas";
import { requireSession } from "@/server/session";
import type { RelationType } from "@/types/database";

export const metadata = { title: "Idea" };

export default async function IdeaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;

  const idea = await getIdea(session.supabase, session.workspace.id, id);
  if (!idea) notFound();

  const { data: proposalRow } = await session.supabase
    .from("ai_proposals")
    .select("id, feature, entity_type, entity_id, status, sections, assumptions, questions, citations, accepted_keys, created_at, run:ai_runs(provider)")
    .eq("workspace_id", session.workspace.id)
    .eq("entity_id", id)
    .eq("feature", "idea_to_project")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const proposal: ProposalView | null = proposalRow
    ? {
        id: proposalRow.id,
        feature: proposalRow.feature,
        entityType: proposalRow.entity_type,
        entityId: proposalRow.entity_id,
        status: proposalRow.status,
        provider:
          (proposalRow as unknown as { run: { provider: string } | null }).run?.provider ??
          "mock",
        sections: parseSections(proposalRow.sections),
        assumptions: proposalRow.assumptions ?? [],
        questions: proposalRow.questions ?? [],
        citations: parseCitations(proposalRow.citations),
        acceptedKeys: proposalRow.accepted_keys ?? [],
        createdAt: proposalRow.created_at,
      }
    : null;

  const scores =
    idea.scores.length > 0
      ? idea.scores
      : SCORING_CRITERIA.slice(0, 5).map((criterion) => ({
          criterion: criterion.key,
          value: 5,
          weight: criterion.defaultWeight,
        }));

  return (
    <>
      <div className="mb-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/ideas">
            <ArrowLeft /> Tutte le idee
          </Link>
        </Button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="size-4 text-muted-foreground" aria-hidden />
                Il tuo testo, invariato
              </CardTitle>
              <span className="text-[11px] text-subtle-foreground">
                catturato <RelativeTime value={idea.created_at} />
              </span>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-foreground">
                {idea.original_content}
              </p>
              <p className="mt-3 text-[12px] text-subtle-foreground">
                Questo blocco è di sola lettura per costruzione: né l&apos;AI né
                l&apos;interfaccia possono riscriverlo.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Struttura dell&apos;idea</CardTitle>
            </CardHeader>
            <CardContent>
              <IdeaFields idea={idea} />
            </CardContent>
          </Card>

          {idea.relatedIdeas.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Link2 className="size-4 text-muted-foreground" aria-hidden /> Idee collegate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {idea.relatedIdeas.map((related) => (
                    <li key={related.id} className="flex items-center gap-2 text-[13px]">
                      <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                        {RELATION_MAP[related.relation as RelationType]?.label ?? related.relation}
                      </span>
                      <Link href={`/ideas/${related.id}`} className="truncate hover:underline">
                        {related.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <IdeaToProjectPanel
            ideaId={idea.id}
            proposal={proposal}
            linkedProjectId={idea.project_id}
          />

          <Card>
            <CardHeader>
              <CardTitle>Valutazione</CardTitle>
            </CardHeader>
            <CardContent>
              <ScoreEditor ideaId={idea.id} initial={scores} />
            </CardContent>
          </Card>

          <IdeaAssist ideaId={idea.id} />
        </div>
      </div>
    </>
  );
}
