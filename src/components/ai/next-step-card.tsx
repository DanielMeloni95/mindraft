"use client";

import * as React from "react";
import { Compass, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { suggestNextStepAction } from "@/server/actions/ai";
import type { NextStepResult } from "@/lib/ai/schemas";

import { AiBadge, AssumptionList } from "./ai-badge";

/**
 * A suggestion, never an order: the wording is a proposal and the
 * reasoning is always visible, so the user can disagree with it.
 */
export function NextStepCard({ projectId }: { projectId?: string }) {
  const [state, setState] = React.useState<
    | { status: "idle" }
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "ready"; data: NextStepResult & { provider: string } }
  >({ status: "idle" });

  const run = React.useCallback(() => {
    setState({ status: "loading" });
    void suggestNextStepAction(projectId).then((result) => {
      setState(
        result.ok
          ? { status: "ready", data: result.data }
          : { status: "error", message: result.error },
      );
    });
  }, [projectId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Compass className="size-4 text-accent-600" aria-hidden />
          Prossimo passo
        </CardTitle>
        {state.status === "ready" && <AiBadge provider={state.data.provider} />}
      </CardHeader>
      <CardContent>
        {state.status === "idle" && (
          <>
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              Posso guardare cosa è aperto e proporti una cosa sola da fare adesso.
              Decidi tu se ha senso.
            </p>
            <Button variant="secondary" size="sm" className="mt-3" onClick={run}>
              Chiedi un suggerimento
            </Button>
          </>
        )}

        {state.status === "loading" && (
          <div className="space-y-2" role="status" aria-live="polite">
            <span className="sr-only">Sto guardando il tuo spazio</span>
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
          </div>
        )}

        {state.status === "error" && (
          <div role="alert">
            <p className="text-[13px] text-danger">{state.message}</p>
            <Button variant="secondary" size="sm" className="mt-3" onClick={run}>
              <RefreshCw /> Riprova
            </Button>
          </div>
        )}

        {state.status === "ready" && (
          <>
            <p className="font-display text-[15px] font-semibold leading-snug">
              {state.data.suggestion}
            </p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
              {state.data.reasoning}
            </p>
            {state.data.effortMinutes > 0 && (
              <p className="mt-2 text-[12px] text-subtle-foreground">
                Stima: circa {state.data.effortMinutes} minuti.
              </p>
            )}
            <AssumptionList
              assumptions={state.data.assumptions}
              questions={state.data.questions}
            />
            <Button variant="ghost" size="sm" className="mt-3" onClick={run}>
              <RefreshCw /> Un altro
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
