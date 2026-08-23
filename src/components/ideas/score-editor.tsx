"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Info, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SCORING_CRITERIA, computeScore } from "@/lib/domain/scoring";
import { saveIdeaScoresAction } from "@/server/actions/ideas";
import { cn } from "@/lib/utils";

type ScoreState = { criterion: string; value: number; weight: number };

/**
 * Transparent scoring: the number, the formula that produced it and the
 * weights are all on screen, and every weight is editable. Coverage is
 * shown too — a score built on three criteria is not the same as one
 * built on ten, and the UI says so instead of implying precision.
 */
export function ScoreEditor({
  ideaId,
  initial,
}: {
  ideaId: string;
  initial: Array<{ criterion: string; value: number; weight: number }>;
}) {
  const router = useRouter();
  const [scores, setScores] = React.useState<ScoreState[]>(
    initial.map((s) => ({ ...s, weight: Number(s.weight) })),
  );
  const [pending, startTransition] = React.useTransition();
  const [dirty, setDirty] = React.useState(false);

  const breakdown = computeScore(scores);
  const used = new Set(scores.map((s) => s.criterion));
  const available = SCORING_CRITERIA.filter((c) => !used.has(c.key));

  const update = (criterion: string, patch: Partial<ScoreState>) => {
    setScores((current) =>
      current.map((s) => (s.criterion === criterion ? { ...s, ...patch } : s)),
    );
    setDirty(true);
  };

  const save = () => {
    startTransition(async () => {
      const result = await saveIdeaScoresAction({ ideaId, scores });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setDirty(false);
      router.refresh();
      toast.success("Valutazione salvata");
    });
  };

  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <div>
          <span className="flex items-baseline gap-1.5">
            <span className="font-display text-3xl font-semibold tabular-nums">
              {breakdown.total ?? "—"}
            </span>
            <span className="text-[13px] text-muted-foreground">/100</span>
          </span>
          <span className="mt-0.5 block text-[12px] text-muted-foreground">
            {breakdown.total === null
              ? "Nessun criterio valutato"
              : breakdown.confidence === "high"
                ? "Basato su gran parte dei criteri"
                : breakdown.confidence === "medium"
                  ? "Basato su circa metà dei criteri"
                  : "Indicativo: pochi criteri valutati"}
          </span>
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm">
              <Info /> Come si calcola
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80">
            <p className="text-[12px] leading-relaxed text-muted-foreground">
              Media pesata dei criteri, riportata su 100. Costo, tempo e rischio sono
              invertiti: un valore alto abbassa il punteggio.
            </p>
            <p className="mt-2 break-words rounded-[var(--radius-sm)] bg-surface-muted p-2 font-mono text-[11px]">
              {breakdown.formula}
            </p>
            <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
              Il numero serve a confrontare, non a decidere al posto tuo.
            </p>
          </PopoverContent>
        </Popover>
      </div>

      <ul className="mt-4 space-y-3">
        {scores.map((score) => {
          const definition = SCORING_CRITERIA.find((c) => c.key === score.criterion);
          if (!definition) return null;
          return (
            <li key={score.criterion}>
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor={`score-${score.criterion}`}
                  className="text-[13px] font-medium"
                  title={definition.hint}
                >
                  {definition.label}
                  {definition.inverted && (
                    <span className="ml-1 text-[11px] font-normal text-subtle-foreground">
                      (meno è meglio)
                    </span>
                  )}
                </label>
                <span className="text-[12px] tabular-nums text-muted-foreground">
                  {score.value}/10
                </span>
              </div>
              <div className="mt-1.5 flex items-center gap-3">
                <Slider
                  id={`score-${score.criterion}`}
                  value={[score.value]}
                  min={0}
                  max={10}
                  step={1}
                  onValueChange={([value]) => update(score.criterion, { value })}
                  aria-label={`${definition.label}: ${score.value} su 10`}
                  className="flex-1"
                />
                <label className="flex items-center gap-1 text-[11px] text-subtle-foreground">
                  peso
                  <input
                    type="number"
                    min={0}
                    max={5}
                    step={0.1}
                    value={score.weight}
                    onChange={(event) =>
                      update(score.criterion, { weight: Number(event.target.value) })
                    }
                    aria-label={`Peso di ${definition.label}`}
                    className="w-14 rounded-[var(--radius-sm)] border border-border bg-surface px-1.5 py-0.5 text-[12px] tabular-nums"
                  />
                </label>
              </div>
            </li>
          );
        })}
      </ul>

      {available.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {available.map((criterion) => (
            <button
              key={criterion.key}
              type="button"
              onClick={() => {
                setScores((current) => [
                  ...current,
                  { criterion: criterion.key, value: 5, weight: criterion.defaultWeight },
                ]);
                setDirty(true);
              }}
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-1 text-[12px] text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
            >
              <Plus className="size-3" /> {criterion.label}
            </button>
          ))}
        </div>
      )}

      <div className={cn("mt-4 flex items-center gap-2", !dirty && "opacity-60")}>
        <Button variant="primary" size="sm" onClick={save} loading={pending} disabled={!dirty}>
          Salva valutazione
        </Button>
        {dirty && <span className="text-[12px] text-muted-foreground">Modifiche non salvate</span>}
      </div>
    </div>
  );
}
