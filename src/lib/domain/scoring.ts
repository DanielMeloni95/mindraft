import type { IdeaScoreRow } from "@/types/database";
import { clamp } from "@/lib/utils";

/**
 * Idea scoring.
 *
 * Deliberately simple arithmetic, fully shown to the user: a weighted
 * mean on a 0–10 scale. Two criteria are costs rather than benefits
 * (cost, time) and are inverted before averaging, so "cheap and fast"
 * pushes the score up. Nothing here pretends to be more precise than
 * the numbers a person typed in — the UI shows the formula next to the
 * result and the confidence drops when few criteria are filled in.
 */

export type CriterionDefinition = {
  key: string;
  label: string;
  hint: string;
  /** Inverted criteria: a high value is a bad thing. */
  inverted?: boolean;
  defaultWeight: number;
};

export const SCORING_CRITERIA: CriterionDefinition[] = [
  { key: "impact", label: "Impatto", hint: "Quanto cambia le cose se funziona", defaultWeight: 1.5 },
  { key: "personal_interest", label: "Interesse personale", hint: "Quanta voglia hai di lavorarci", defaultWeight: 1.2 },
  { key: "feasibility", label: "Fattibilità", hint: "Quanto è realistico farlo con ciò che hai", defaultWeight: 1.2 },
  { key: "cost", label: "Costo", hint: "Quanto denaro richiede", inverted: true, defaultWeight: 0.8 },
  { key: "time_required", label: "Tempo richiesto", hint: "Quanto tempo richiede", inverted: true, defaultWeight: 0.8 },
  { key: "skills", label: "Competenze disponibili", hint: "Quanto sai già fare di ciò che serve", defaultWeight: 1 },
  { key: "differentiation", label: "Differenziazione", hint: "Quanto è diverso da ciò che esiste", defaultWeight: 1 },
  { key: "commercial", label: "Potenziale commerciale", hint: "Quanto qualcuno pagherebbe", defaultWeight: 1 },
  { key: "urgency", label: "Urgenza", hint: "Quanto conta farlo adesso", defaultWeight: 0.8 },
  { key: "risk", label: "Rischio", hint: "Quanto può andare storto", inverted: true, defaultWeight: 0.8 },
];

export const CRITERION_MAP: Record<string, CriterionDefinition> =
  Object.fromEntries(SCORING_CRITERIA.map((c) => [c.key, c]));

export type ScoreContribution = {
  key: string;
  label: string;
  value: number;
  /** Value after inversion, i.e. what actually enters the average. */
  effectiveValue: number;
  weight: number;
  inverted: boolean;
  /** Share of the final score, 0–1. */
  share: number;
};

export type ScoreBreakdown = {
  /** 0–100, or null when nothing has been rated yet. */
  total: number | null;
  /** How much of the criteria set has been filled in, 0–1. */
  coverage: number;
  /** Low coverage means the number is indicative, and we say so. */
  confidence: "none" | "low" | "medium" | "high";
  contributions: ScoreContribution[];
  formula: string;
};

export function computeScore(
  scores: Pick<IdeaScoreRow, "criterion" | "value" | "weight">[],
): ScoreBreakdown {
  const usable = scores.filter((s) => CRITERION_MAP[s.criterion]);

  if (usable.length === 0) {
    return {
      total: null,
      coverage: 0,
      confidence: "none",
      contributions: [],
      formula: "Nessun criterio valutato",
    };
  }

  const contributions: ScoreContribution[] = usable.map((score) => {
    const def = CRITERION_MAP[score.criterion];
    const value = clamp(score.value, 0, 10);
    const weight = clamp(Number(score.weight), 0, 5);
    return {
      key: def.key,
      label: def.label,
      value,
      effectiveValue: def.inverted ? 10 - value : value,
      weight,
      inverted: Boolean(def.inverted),
      share: 0,
    };
  });

  const weightSum = contributions.reduce((sum, c) => sum + c.weight, 0);
  if (weightSum === 0) {
    return {
      total: null,
      coverage: usable.length / SCORING_CRITERIA.length,
      confidence: "none",
      contributions,
      formula: "Tutti i pesi sono a zero",
    };
  }

  const weighted = contributions.reduce(
    (sum, c) => sum + c.effectiveValue * c.weight,
    0,
  );
  const total = Math.round((weighted / weightSum) * 10);

  for (const c of contributions) {
    c.share = weighted === 0 ? 0 : (c.effectiveValue * c.weight) / weighted;
  }

  const coverage = usable.length / SCORING_CRITERIA.length;
  const confidence: ScoreBreakdown["confidence"] =
    coverage >= 0.7 ? "high" : coverage >= 0.4 ? "medium" : "low";

  return {
    total: clamp(total, 0, 100),
    coverage,
    confidence,
    contributions: contributions.sort((a, b) => b.share - a.share),
    formula: `(${contributions
      .map(
        (c) =>
          `${c.inverted ? `(10−${c.value})` : c.value}×${c.weight}`,
      )
      .join(" + ")}) ÷ ${weightSum.toFixed(1)} × 10`,
  };
}

export type MatrixPosition = {
  /** 0–10 */
  impact: number;
  /** 0–10 */
  feasibility: number;
  quadrant: "quick_win" | "big_bet" | "filler" | "avoid" | "unknown";
};

export function matrixPosition(
  scores: Pick<IdeaScoreRow, "criterion" | "value">[],
): MatrixPosition {
  const impact = scores.find((s) => s.criterion === "impact")?.value;
  const feasibility = scores.find((s) => s.criterion === "feasibility")?.value;

  if (impact === undefined || feasibility === undefined) {
    return { impact: impact ?? 0, feasibility: feasibility ?? 0, quadrant: "unknown" };
  }

  const highImpact = impact >= 5.5;
  const highFeasibility = feasibility >= 5.5;

  const quadrant: MatrixPosition["quadrant"] = highImpact
    ? highFeasibility
      ? "quick_win"
      : "big_bet"
    : highFeasibility
      ? "filler"
      : "avoid";

  return { impact, feasibility, quadrant };
}

export const QUADRANT_LABELS: Record<MatrixPosition["quadrant"], string> = {
  quick_win: "Vittoria rapida",
  big_bet: "Scommessa grande",
  filler: "Riempitivo",
  avoid: "Da evitare per ora",
  unknown: "Non posizionabile",
};

export function defaultScoresForIdea(
  ideaId: string,
  workspaceId: string,
): Array<{ workspace_id: string; idea_id: string; criterion: string; value: number; weight: number }> {
  return SCORING_CRITERIA.slice(0, 5).map((c) => ({
    workspace_id: workspaceId,
    idea_id: ideaId,
    criterion: c.key,
    value: 5,
    weight: c.defaultWeight,
  }));
}
