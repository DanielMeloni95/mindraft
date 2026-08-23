"use client";

import * as React from "react";
import Link from "next/link";
import { Scale } from "lucide-react";
import { toast } from "sonner";

import { AiBadge } from "@/components/ai/ai-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { SkeletonList } from "@/components/ui/skeleton";
import type { CompareIdeasResult } from "@/lib/ai/schemas";
import { compareIdeasAction } from "@/server/actions/ai";
import { cn } from "@/lib/utils";

type Option = { id: string; title: string; score: number | null; status: string };

export function CompareIdeas({ ideas }: { ideas: Option[] }) {
  const [selected, setSelected] = React.useState<string[]>([]);
  const [result, setResult] = React.useState<
    (CompareIdeasResult & { provider: string }) | null
  >(null);
  const [pending, startTransition] = React.useTransition();

  const toggle = (id: string) => {
    setSelected((current) => {
      if (current.includes(id)) return current.filter((value) => value !== id);
      if (current.length >= 5) {
        toast.error("Massimo cinque idee per confronto.");
        return current;
      }
      return [...current, id];
    });
  };

  const run = () =>
    startTransition(async () => {
      const response = await compareIdeasAction(selected);
      if (!response.ok) {
        toast.error(response.error);
        return;
      }
      setResult(response.data);
    });

  return (
    <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
      <Card className="h-fit">
        <CardHeader>
          <CardTitle>Scegli le idee</CardTitle>
          <span className="text-[12px] text-muted-foreground">{selected.length}/5</span>
        </CardHeader>
        <CardContent>
          <ul className="max-h-[420px] space-y-1 overflow-y-auto scrollbar-thin">
            {ideas.map((idea) => {
              const checked = selected.includes(idea.id);
              return (
                <li key={idea.id}>
                  <label
                    className={cn(
                      "flex cursor-pointer items-start gap-2.5 rounded-[var(--radius-md)] p-2 text-[13px] transition-colors",
                      checked ? "bg-brand-50 dark:bg-brand-900/30" : "hover:bg-surface-muted",
                    )}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggle(idea.id)}
                      className="mt-0.5"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{idea.title}</span>
                      <span className="text-[11px] text-subtle-foreground">
                        {idea.score === null ? "non valutata" : `punteggio ${idea.score}`}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>

          <Button
            variant="primary"
            size="sm"
            className="mt-3 w-full"
            disabled={selected.length < 2 || pending}
            loading={pending}
            onClick={run}
          >
            <Scale /> Confronta
          </Button>
        </CardContent>
      </Card>

      <div>
        {pending && <SkeletonList rows={3} />}

        {!pending && !result && (
          <Card>
            <CardContent className="pt-4">
              <p className="text-[13px] leading-relaxed text-muted-foreground">
                Seleziona da due a cinque idee a sinistra. Il confronto usa solo quello
                che hai scritto e valutato: non consulta fonti esterne, e te lo dice.
              </p>
            </CardContent>
          </Card>
        )}

        {result && !pending && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Griglia di confronto</CardTitle>
                <AiBadge provider={result.provider} />
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] border-collapse text-[13px]">
                    <caption className="sr-only">Confronto fra le idee selezionate</caption>
                    <thead>
                      <tr>
                        <th scope="col" className="border-b border-border p-2 text-left font-medium">
                          Idea
                        </th>
                        {result.criteria.map((criterion) => (
                          <th
                            key={criterion}
                            scope="col"
                            className="border-b border-border p-2 text-left font-medium"
                          >
                            {criterion}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.rows.map((row) => (
                        <tr key={row.ideaId}>
                          <th scope="row" className="border-b border-border p-2 text-left font-medium">
                            <Link href={`/ideas/${row.ideaId}`} className="hover:underline">
                              {row.title}
                            </Link>
                          </th>
                          {row.cells.map((cell, index) => (
                            <td key={index} className="border-b border-border p-2 text-muted-foreground">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Raccomandazione</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-[14px] leading-relaxed">{result.recommendation.reasoning}</p>

                {result.recommendation.tradeoffs.length > 0 && (
                  <div className="mt-3">
                    <h4 className="text-[11px] font-semibold uppercase tracking-wide text-subtle-foreground">
                      Compromessi
                    </h4>
                    <ul className="mt-1 space-y-1">
                      {result.recommendation.tradeoffs.map((item, index) => (
                        <li key={index} className="text-[12px] text-muted-foreground">
                          · {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {result.recommendation.uncertainties.length > 0 && (
                  <div className="mt-3">
                    <h4 className="text-[11px] font-semibold uppercase tracking-wide text-subtle-foreground">
                      Incertezze
                    </h4>
                    <ul className="mt-1 space-y-1">
                      {result.recommendation.uncertainties.map((item, index) => (
                        <li key={index} className="text-[12px] text-muted-foreground">
                          · {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
