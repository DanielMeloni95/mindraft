import { describe, expect, it } from "vitest";

import {
  SCORING_CRITERIA,
  computeScore,
  matrixPosition,
} from "@/lib/domain/scoring";

describe("computeScore", () => {
  it("returns nothing when no criterion has been rated", () => {
    const result = computeScore([]);
    expect(result.total).toBeNull();
    expect(result.confidence).toBe("none");
    expect(result.formula).toMatch(/Nessun criterio/);
  });

  it("computes a weighted mean on a 0-100 scale", () => {
    const result = computeScore([
      { criterion: "impact", value: 8, weight: 1 },
      { criterion: "feasibility", value: 6, weight: 1 },
    ]);
    // (8*1 + 6*1) / 2 * 10 = 70
    expect(result.total).toBe(70);
  });

  it("inverts cost-like criteria so that cheap and fast score higher", () => {
    const cheap = computeScore([{ criterion: "cost", value: 1, weight: 1 }]);
    const expensive = computeScore([{ criterion: "cost", value: 9, weight: 1 }]);

    expect(cheap.total).toBeGreaterThan(expensive.total!);
    expect(cheap.contributions[0].inverted).toBe(true);
    expect(cheap.contributions[0].effectiveValue).toBe(9);
  });

  it("respects weights", () => {
    const balanced = computeScore([
      { criterion: "impact", value: 10, weight: 1 },
      { criterion: "feasibility", value: 0, weight: 1 },
    ]);
    const impactHeavy = computeScore([
      { criterion: "impact", value: 10, weight: 3 },
      { criterion: "feasibility", value: 0, weight: 1 },
    ]);

    expect(balanced.total).toBe(50);
    expect(impactHeavy.total).toBe(75);
  });

  it("reports low confidence when few criteria are filled in", () => {
    const partial = computeScore([{ criterion: "impact", value: 7, weight: 1 }]);
    expect(partial.confidence).toBe("low");
    expect(partial.coverage).toBeLessThan(0.4);
  });

  it("reports high confidence when most criteria are filled in", () => {
    const full = computeScore(
      SCORING_CRITERIA.map((criterion) => ({
        criterion: criterion.key,
        value: 5,
        weight: 1,
      })),
    );
    expect(full.confidence).toBe("high");
    expect(full.total).toBe(50);
  });

  it("ignores unknown criteria instead of guessing", () => {
    const result = computeScore([
      { criterion: "impact", value: 8, weight: 1 },
      { criterion: "vibes", value: 10, weight: 5 },
    ]);
    expect(result.total).toBe(80);
    expect(result.contributions).toHaveLength(1);
  });

  it("exposes a formula the interface can show verbatim", () => {
    const result = computeScore([
      { criterion: "impact", value: 8, weight: 1.5 },
      { criterion: "cost", value: 2, weight: 1 },
    ]);
    expect(result.formula).toContain("8×1.5");
    expect(result.formula).toContain("(10−2)×1");
  });
});

describe("matrixPosition", () => {
  it("refuses to place an idea without impact and feasibility", () => {
    expect(matrixPosition([{ criterion: "impact", value: 9 }]).quadrant).toBe("unknown");
    expect(matrixPosition([]).quadrant).toBe("unknown");
  });

  it("classifies the four quadrants", () => {
    const at = (impact: number, feasibility: number) =>
      matrixPosition([
        { criterion: "impact", value: impact },
        { criterion: "feasibility", value: feasibility },
      ]).quadrant;

    expect(at(9, 9)).toBe("quick_win");
    expect(at(9, 2)).toBe("big_bet");
    expect(at(2, 9)).toBe("filler");
    expect(at(2, 2)).toBe("avoid");
  });
});
