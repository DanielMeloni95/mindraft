import { describe, expect, it } from "vitest";

import { PLANS, costOf, isWithinLimit, planLimit } from "@/lib/domain/plans";

describe("plan limits", () => {
  it("free is bounded, pro is not", () => {
    expect(planLimit("free", "projects")).toBe(3);
    expect(planLimit("pro", "projects")).toBe(-1);
  });

  it("blocks at the limit, not after it", () => {
    expect(isWithinLimit("free", "projects", 2)).toBe(true);
    expect(isWithinLimit("free", "projects", 3)).toBe(false);
    expect(isWithinLimit("free", "projects", 4)).toBe(false);
  });

  it("treats a negative limit as unlimited", () => {
    expect(isWithinLimit("pro", "projects", 10_000)).toBe(true);
  });

  it("prices the expensive AI features higher than the cheap ones", () => {
    expect(costOf("idea_to_project")).toBeGreaterThan(costOf("next_step"));
    expect(costOf("qualcosa_di_sconosciuto")).toBe(1);
  });

  it("keeps every plan internally consistent", () => {
    for (const plan of Object.values(PLANS)) {
      expect(plan.limits.aiCreditsPerMonth).toBeGreaterThan(0);
      expect(plan.features.length).toBeGreaterThan(0);
    }
  });
});
