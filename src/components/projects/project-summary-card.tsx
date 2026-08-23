"use client";

import * as React from "react";
import { FileClock, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { AiBadge, AssumptionList } from "@/components/ai/ai-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { SummaryResult } from "@/lib/ai/schemas";
import { summarizeProjectAction } from "@/server/actions/ai";

/** "Dove eravamo rimasti", for the day you come back after three weeks. */
export function ProjectSummaryCard({ projectId }: { projectId: string }) {
  const [summary, setSummary] = React.useState<(SummaryResult & { provider: string }) | null>(
    null,
  );
  const [loading, setLoading] = React.useState(false);

  const run = async () => {
    setLoading(true);
    const result = await summarizeProjectAction(projectId);
    setLoading(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setSummary(result.data);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileClock className="size-4 text-accent-600" aria-hidden />
          Dove eravamo rimasti
        </CardTitle>
        {summary && <AiBadge provider={summary.provider} />}
      </CardHeader>
      <CardContent>
        {loading && (
          <div className="space-y-2" role="status" aria-live="polite">
            <span className="sr-only">Sto ricostruendo lo stato</span>
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        )}

        {!loading && !summary && (
          <>
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              Una sintesi di cosa è aperto e cosa serve decidere, costruita su attività e
              decisioni registrate.
            </p>
            <Button variant="secondary" size="sm" className="mt-3" onClick={run}>
              Ricostruisci lo stato
            </Button>
          </>
        )}

        {!loading && summary && (
          <>
            <p className="text-[13px] leading-relaxed">{summary.summary}</p>
            {summary.highlights.length > 0 && (
              <ul className="mt-2.5 space-y-1">
                {summary.highlights.map((highlight, index) => (
                  <li key={index} className="text-[12px] text-muted-foreground">
                    · {highlight}
                  </li>
                ))}
              </ul>
            )}
            <AssumptionList assumptions={summary.assumptions} questions={summary.questions} />
            <Button variant="ghost" size="sm" className="mt-3" onClick={run}>
              <RefreshCw /> Aggiorna
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
