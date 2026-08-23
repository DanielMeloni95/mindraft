import { describe, expect, it } from "vitest";

import { fail, ok, parseInput } from "@/server/action-result";
import { checkRateLimit, resetRateLimits } from "@/server/rate-limit";
import {
  ideaCreateSchema,
  ideaUpdateSchema,
  quickCaptureSchema,
  weeklyReviewSchema,
} from "@/lib/validation/schemas";
import { deriveTitle, slugify, truncate } from "@/lib/utils";

describe("validation schemas", () => {
  it("accepts a bare capture with nothing else", () => {
    const parsed = quickCaptureSchema.safeParse({ content: "  un pensiero  " });
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.content).toBe("un pensiero");
  });

  it("rejects an empty capture", () => {
    expect(quickCaptureSchema.safeParse({ content: "   " }).success).toBe(false);
  });

  it("rejects a malformed URL but allows an empty one", () => {
    expect(quickCaptureSchema.safeParse({ content: "x", url: "nope" }).success).toBe(false);
    expect(quickCaptureSchema.safeParse({ content: "x", url: "" }).success).toBe(true);
  });

  it("never lets original_content through the idea update schema", () => {
    const parsed = ideaUpdateSchema.safeParse({
      id: "11111111-1111-4111-8111-111111111111",
      original_content: "riscritto",
      summary: "ok",
    });
    expect(parsed.success).toBe(true);
    expect(parsed.success && "original_content" in parsed.data).toBe(false);
  });

  it("requires an original content when creating an idea", () => {
    expect(ideaCreateSchema.safeParse({ title: "solo titolo" }).success).toBe(false);
  });

  it("caps the weekly review at three focus items", () => {
    const four = weeklyReviewSchema.safeParse({
      weekStart: "2026-08-17",
      summary: "",
      focusItems: [1, 2, 3, 4].map((n) => ({ title: `focus ${n}`, done: false })),
    });
    expect(four.success).toBe(false);
  });
});

describe("parseInput", () => {
  it("maps zod issues to field errors the form can render", () => {
    const result = parseInput(quickCaptureSchema, { content: "" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.result.ok).toBe(false);
      if (!result.result.ok) {
        expect(result.result.fieldErrors?.content?.[0]).toBeTruthy();
      }
    }
  });

  it("returns typed data when valid", () => {
    const result = parseInput(quickCaptureSchema, { content: "ciao" });
    expect(result.ok).toBe(true);
  });
});

describe("action results", () => {
  it("wraps successes and failures in a discriminated union", () => {
    expect(ok({ id: "1" })).toEqual({ ok: true, data: { id: "1" } });
    expect(fail("boom").ok).toBe(false);
  });
});

describe("rate limiting", () => {
  it("allows up to the limit and then refuses with a retry hint", () => {
    resetRateLimits();
    const options = { limit: 3, windowMs: 60_000 };

    expect(checkRateLimit("user:ai", options).allowed).toBe(true);
    expect(checkRateLimit("user:ai", options).allowed).toBe(true);
    expect(checkRateLimit("user:ai", options).allowed).toBe(true);

    const blocked = checkRateLimit("user:ai", options);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("keys are independent per user and feature", () => {
    resetRateLimits();
    const options = { limit: 1, windowMs: 60_000 };
    expect(checkRateLimit("a:ai", options).allowed).toBe(true);
    expect(checkRateLimit("b:ai", options).allowed).toBe(true);
    expect(checkRateLimit("a:ai", options).allowed).toBe(false);
  });
});

describe("text helpers", () => {
  it("derives a usable title from a free-form capture", () => {
    expect(deriveTitle("Vorrei un radar per le idee. E anche altro.")).toBe(
      "Vorrei un radar per le idee.",
    );
    expect(deriveTitle("")).toBe("Nota senza titolo");
  });

  it("truncates on a character budget", () => {
    expect(truncate("abcdefghij", 5)).toHaveLength(5);
    expect(truncate("breve", 50)).toBe("breve");
  });

  it("slugifies accented text", () => {
    expect(slugify("Idee però accentate!")).toBe("idee-pero-accentate");
  });
});
