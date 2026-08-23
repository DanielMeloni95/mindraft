import type { z } from "zod";
import { describe, expect, it } from "vitest";

import { serializeContext, type AiContext } from "@/lib/ai/context";
import { MockAiProvider } from "@/lib/ai/mock";
import { buildPrompt } from "@/lib/ai/prompts";
import { AI_SCHEMAS } from "@/lib/ai/schemas";
import { AiError } from "@/lib/ai/provider";

const provider = new MockAiProvider();

const IDEA_CONTEXT: AiContext = {
  locale: "it",
  today: "2026-08-23",
  idea: {
    id: "11111111-1111-4111-8111-111111111111",
    title: "Radar delle idee",
    originalContent:
      "Ho quaranta idee in tre app diverse e ogni volta perdo mezz'ora a ricostruire perché mi interessavano. Vorrei un radar che me le ordini per impatto e fattibilità.",
    summary: null,
    problem: null,
    solution: null,
    audience: null,
    category: null,
    scores: [],
  },
};

async function run<K extends keyof typeof AI_SCHEMAS>(
  feature: K,
  context: AiContext,
): Promise<{ provider: string; data: z.infer<(typeof AI_SCHEMAS)[K]> }> {
  const { system, user } = buildPrompt(feature, context);
  const schema = AI_SCHEMAS[feature] as (typeof AI_SCHEMAS)[K];
  const result = await provider.generate({ feature, schema, schemaName: feature, system, user });
  return { provider: result.provider, data: result.data as z.infer<(typeof AI_SCHEMAS)[K]> };
}

describe("mock AI provider", () => {
  it("produces schema-valid Idea-to-Project output", async () => {
    const result = await run("idea_to_project", IDEA_CONTEXT);

    expect(result.provider).toBe("mock");
    expect(result.data.projectName.length).toBeGreaterThan(0);
    expect(result.data.sections.length).toBeGreaterThan(0);
    expect(result.data.milestones.every((m) => m.isEstimate)).toBe(true);
  });

  it("derives the proposal from the user's own words, not from invented facts", async () => {
    const result = await run("idea_to_project", IDEA_CONTEXT);
    const problem = result.data.sections.find((section) => section.key === "problem");

    expect(problem).toBeDefined();
    expect(IDEA_CONTEXT.idea!.originalContent).toContain(problem!.proposed.slice(0, 25));
  });

  it("declares its assumptions and asks for what is missing", async () => {
    const result = await run("idea_to_project", IDEA_CONTEXT);

    expect(result.data.assumptions.length).toBeGreaterThan(0);
    expect(result.data.questions.length).toBeGreaterThan(0);
    expect(
      result.data.assumptions.some((assumption) => assumption.toLowerCase().includes("pubblico")),
    ).toBe(true);
  });

  it("marks an undeclared audience as low confidence instead of inventing one", async () => {
    const result = await run("idea_to_project", IDEA_CONTEXT);
    const users = result.data.sections.find((section) => section.key === "users");

    expect(users?.confidence).toBe("low");
    expect(users?.proposed).toMatch(/non ancora dichiarato/i);
  });

  it("cites the internal item it worked from", async () => {
    const result = await run("idea_to_project", IDEA_CONTEXT);
    expect(result.data.citations[0]).toMatchObject({
      entityType: "idea",
      entityId: IDEA_CONTEXT.idea!.id,
    });
  });

  it("is deterministic: the same input gives the same proposal", async () => {
    const first = await run("idea_to_project", IDEA_CONTEXT);
    const second = await run("idea_to_project", IDEA_CONTEXT);
    expect(JSON.stringify(first.data)).toBe(JSON.stringify(second.data));
  });

  it("organises a messy capture without touching the original", async () => {
    const result = await run("organize_note", {
      locale: "it",
      today: "2026-08-23",
      text: "Registrare note vocali mentre cammino. La sera le ritrovo divise per progetto. Forse serve anche una trascrizione.",
    });

    expect(result.data.title.length).toBeGreaterThan(0);
    expect(result.data.bulletPoints.length).toBeGreaterThan(1);
  });

  it("suggests a next step with a reason attached", async () => {
    const result = await run("next_step", {
      locale: "it",
      today: "2026-08-23",
      workspaceSummary: {
        unprocessedInbox: 4,
        ideasByStatus: { inbox: 2 },
        staleProjects: [],
        overdueTasks: [],
        openDecisions: [],
      },
    });

    expect(result.data.suggestion).toContain("Inbox");
    expect(result.data.reasoning.length).toBeGreaterThan(10);
  });

  it("only recommends among the ideas it was given when comparing", async () => {
    const ideas = [IDEA_CONTEXT.idea!, { ...IDEA_CONTEXT.idea!, id: "22222222-2222-4222-8222-222222222222", title: "Newsletter" }];
    const result = await run("compare_ideas", {
      locale: "it",
      today: "2026-08-23",
      ideas,
    });

    expect(result.data.rows).toHaveLength(2);
    expect(ideas.map((idea) => idea.id)).toContain(result.data.recommendation.ideaId);
    expect(result.data.recommendation.uncertainties.length).toBeGreaterThan(0);
  });

  it("fails loudly on an unsupported feature instead of returning junk", async () => {
    await expect(
      provider.generate({
        // @ts-expect-error deliberately unsupported
        feature: "nope",
        schema: AI_SCHEMAS.organize_note,
        schemaName: "nope",
        system: "",
        user: serializeContext({ locale: "it", today: "2026-08-23" }),
      }),
    ).rejects.toBeInstanceOf(AiError);
  });
});
