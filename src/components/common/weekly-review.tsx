"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { AiBadge } from "@/components/ai/ai-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { weeklySummaryAction } from "@/server/actions/ai";
import { saveWeeklyReviewAction } from "@/server/actions/workspace";

type Stats = {
  unprocessedInbox: number;
  ideasCaptured: number;
  tasksCompleted: number;
  decisionsMade: number;
  overdueTasks: number;
  openDecisions: number;
  staleProjects: string[];
};

const STEPS = [
  "Idee catturate e non elaborate",
  "Progressi compiuti",
  "Attività scadute",
  "Decisioni ancora aperte",
  "Progetti senza aggiornamenti",
  "Priorità della prossima settimana",
  "Tre focus principali",
];

export function WeeklyReview({
  weekStart,
  stats,
  existing,
  history,
}: {
  weekStart: string;
  stats: Stats;
  existing: { summary: string; focusItems: Array<{ title: string; done: boolean }>; completedAt: string | null } | null;
  history: Array<{ id: string; weekStart: string; summary: string }>;
}) {
  const router = useRouter();
  const [summary, setSummary] = React.useState(existing?.summary ?? "");
  const [focus, setFocus] = React.useState<Array<{ title: string; done: boolean }>>(
    existing?.focusItems.length
      ? existing.focusItems
      : [
          { title: "", done: false },
          { title: "", done: false },
          { title: "", done: false },
        ],
  );
  const [pending, startTransition] = React.useTransition();
  const [provider, setProvider] = React.useState<string | null>(null);

  const facts = [
    `${stats.ideasCaptured} idee catturate`,
    `${stats.unprocessedInbox} elementi ancora in Inbox`,
    `${stats.tasksCompleted} attività completate`,
    `${stats.overdueTasks} attività scadute`,
    `${stats.decisionsMade} decisioni chiuse`,
    `${stats.openDecisions} decisioni aperte`,
    stats.staleProjects.length > 0
      ? `Fermi: ${stats.staleProjects.join(", ")}`
      : "Nessun progetto fermo",
  ];

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Cosa è successo</CardTitle>
            <span className="text-[11px] text-subtle-foreground">settimana del {weekStart}</span>
          </CardHeader>
          <CardContent>
            <ol className="space-y-1.5">
              {STEPS.slice(0, 5).map((step, index) => (
                <li key={step} className="flex items-start gap-2 text-[13px]">
                  <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-surface-muted text-[10px] font-semibold text-muted-foreground">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1">{step}</span>
                  <span className="shrink-0 text-[12px] text-muted-foreground">
                    {facts[index]}
                  </span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Riepilogo</CardTitle>
            {provider && <AiBadge provider={provider} />}
          </CardHeader>
          <CardContent>
            <Textarea
              rows={6}
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              placeholder="Cosa ti porti dietro da questa settimana?"
              aria-label="Riepilogo della settimana"
            />
            <Button
              variant="secondary"
              size="sm"
              className="mt-3"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await weeklySummaryAction();
                  if (!result.ok) {
                    toast.error(result.error);
                    return;
                  }
                  setProvider(result.data.provider);
                  setSummary((current) =>
                    current.trim().length > 0
                      ? `${current}\n\n${result.data.summary}`
                      : result.data.summary,
                  );
                })
              }
            >
              <Sparkles /> Proponi un riepilogo
            </Button>
            <p className="mt-2 text-[12px] text-muted-foreground">
              La proposta viene aggiunta in fondo: il testo che hai scritto tu non viene
              sostituito.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tre focus per la prossima settimana</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {focus.map((item, index) => (
                <li key={index} className="flex items-center gap-2">
                  <Checkbox
                    checked={item.done}
                    onCheckedChange={(value) =>
                      setFocus((current) =>
                        current.map((entry, i) =>
                          i === index ? { ...entry, done: value === true } : entry,
                        ),
                      )
                    }
                    aria-label={`Focus ${index + 1} completato`}
                  />
                  <Label htmlFor={`focus-${index}`} className="sr-only">
                    Focus {index + 1}
                  </Label>
                  <Input
                    id={`focus-${index}`}
                    value={item.title}
                    onChange={(event) =>
                      setFocus((current) =>
                        current.map((entry, i) =>
                          i === index ? { ...entry, title: event.target.value } : entry,
                        ),
                      )
                    }
                    placeholder={`Focus ${index + 1}`}
                  />
                </li>
              ))}
            </ul>

            <Button
              variant="primary"
              className="mt-4"
              loading={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await saveWeeklyReviewAction({
                    weekStart,
                    summary: summary.trim(),
                    focusItems: focus.filter((item) => item.title.trim().length > 0),
                  });
                  if (!result.ok) {
                    toast.error(result.error);
                    return;
                  }
                  toast.success("Revisione salvata");
                  router.refresh();
                })
              }
            >
              Salva la revisione
            </Button>

            {existing?.completedAt && (
              <p className="mt-2 flex items-center gap-1.5 text-[12px] text-muted-foreground">
                <CheckCircle2 className="size-3.5 text-emerald-600" aria-hidden />
                Già completata questa settimana. Salvando la aggiorni.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle>Revisioni precedenti</CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">
              Nessuna revisione salvata finora.
            </p>
          ) : (
            <ul className="space-y-3">
              {history.map((entry) => (
                <li key={entry.id}>
                  <span className="block text-[12px] font-medium">{entry.weekStart}</span>
                  <span className="mt-0.5 line-clamp-3 block text-[12px] leading-relaxed text-muted-foreground">
                    {entry.summary || "—"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
