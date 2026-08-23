"use client";

import * as React from "react";
import Link from "next/link";
import { HelpCircle, Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { AiBadge, AssumptionList } from "@/components/ai/ai-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { QuestionsResult, SimilarIdeasResult } from "@/lib/ai/schemas";
import { findSimilarIdeasAction, missingQuestionsAction } from "@/server/actions/ai";

/** Two small assists that answer "what am I not seeing?". */
export function IdeaAssist({ ideaId }: { ideaId: string }) {
  const [questions, setQuestions] = React.useState<
    (QuestionsResult & { provider: string }) | null
  >(null);
  const [similar, setSimilar] = React.useState<
    (SimilarIdeasResult & { provider: string; titles: Record<string, string> }) | null
  >(null);
  const [loading, setLoading] = React.useState<"questions" | "similar" | null>(null);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HelpCircle className="size-4 text-accent-600" aria-hidden />
            Domande che mancano
          </CardTitle>
          {questions && <AiBadge provider={questions.provider} />}
        </CardHeader>
        <CardContent>
          {!questions ? (
            <>
              <p className="text-[13px] leading-relaxed text-muted-foreground">
                Le domande che cambierebbero la decisione, non quelle di cortesia.
              </p>
              <Button
                variant="secondary"
                size="sm"
                className="mt-3"
                disabled={loading !== null}
                onClick={async () => {
                  setLoading("questions");
                  const result = await missingQuestionsAction(ideaId);
                  setLoading(null);
                  if (!result.ok) {
                    toast.error(result.error);
                    return;
                  }
                  setQuestions(result.data);
                }}
              >
                {loading === "questions" && <Loader2 className="animate-spin" />}
                Trova le domande
              </Button>
            </>
          ) : (
            <>
              <ol className="space-y-2.5">
                {questions.questions.map((item, index) => (
                  <li key={index}>
                    <p className="text-[13px] font-medium leading-snug">{item.question}</p>
                    {item.why && (
                      <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
                        {item.why}
                      </p>
                    )}
                  </li>
                ))}
              </ol>
              <AssumptionList assumptions={questions.assumptions} questions={[]} />
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Copy className="size-4 text-accent-600" aria-hidden />
            Idee simili
          </CardTitle>
          {similar && <AiBadge provider={similar.provider} />}
        </CardHeader>
        <CardContent>
          {!similar ? (
            <>
              <p className="text-[13px] leading-relaxed text-muted-foreground">
                Controlla se hai già scritto due volte la stessa cosa.
              </p>
              <Button
                variant="secondary"
                size="sm"
                className="mt-3"
                disabled={loading !== null}
                onClick={async () => {
                  setLoading("similar");
                  const result = await findSimilarIdeasAction(ideaId);
                  setLoading(null);
                  if (!result.ok) {
                    toast.error(result.error);
                    return;
                  }
                  setSimilar(result.data);
                }}
              >
                {loading === "similar" && <Loader2 className="animate-spin" />}
                Cerca duplicati
              </Button>
            </>
          ) : similar.matches.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">
              Nessuna sovrapposizione evidente con le altre idee.
            </p>
          ) : (
            <>
              <ul className="space-y-2">
                {similar.matches.map((match) => (
                  <li key={match.ideaId} className="text-[13px]">
                    <Link href={`/ideas/${match.ideaId}`} className="font-medium hover:underline">
                      {similar.titles[match.ideaId] ?? "Idea"}
                    </Link>
                    {match.duplicate && (
                      <span className="ml-1.5 rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
                        probabile duplicato
                      </span>
                    )}
                    <span className="mt-0.5 block text-[12px] text-muted-foreground">
                      {match.why} · somiglianza {Math.round(match.similarity * 100)}%
                    </span>
                  </li>
                ))}
              </ul>
              <AssumptionList assumptions={similar.assumptions} questions={[]} />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
