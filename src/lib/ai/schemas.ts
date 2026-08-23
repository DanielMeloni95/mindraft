import { z } from "zod";

/**
 * Every AI answer is parsed through one of these before it touches the
 * database. A model that returns something unexpected produces a
 * validation error and a visible failure — never a half-written record.
 */

export const confidenceEnum = z.enum(["low", "medium", "high"]);

/** A single proposed change, always paired with what is there today. */
export const proposedSectionSchema = z.object({
  key: z.string().min(1).max(60),
  label: z.string().min(1).max(120),
  proposed: z.string().max(8_000),
  confidence: confidenceEnum.default("medium"),
  rationale: z.string().max(600).default(""),
});
export type ProposedSection = z.infer<typeof proposedSectionSchema>;

export const citationSchema = z.object({
  entityType: z.string().max(40),
  entityId: z.string().max(64),
  label: z.string().max(200),
});

const baseProposal = {
  assumptions: z.array(z.string().max(400)).max(10).default([]),
  questions: z.array(z.string().max(300)).max(6).default([]),
  citations: z.array(citationSchema).max(20).default([]),
};

/* ------------------------------------------------- organise a capture */

export const organizeNoteSchema = z.object({
  title: z.string().min(1).max(160),
  summary: z.string().max(600),
  category: z.string().max(60).default(""),
  tags: z.array(z.string().max(40)).max(8).default([]),
  bulletPoints: z.array(z.string().max(300)).max(10).default([]),
  ...baseProposal,
});
export type OrganizeNoteResult = z.infer<typeof organizeNoteSchema>;

/* ---------------------------------------------------- idea to project */

export const ideaToProjectSchema = z.object({
  projectName: z.string().min(1).max(120),
  summary: z.string().max(600),
  sections: z.array(proposedSectionSchema).min(1).max(16),
  features: z.array(z.string().max(200)).max(12).default([]),
  mvp: z.array(z.string().max(200)).max(8).default([]),
  milestones: z
    .array(
      z.object({
        title: z.string().max(120),
        description: z.string().max(400).default(""),
        weeksFromStart: z.number().int().min(0).max(104).default(0),
        durationWeeks: z.number().int().min(1).max(52).default(2),
        isEstimate: z.literal(true).default(true),
      }),
    )
    .max(8)
    .default([]),
  tasks: z
    .array(
      z.object({
        title: z.string().max(200),
        priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
        milestoneTitle: z.string().max(120).default(""),
      }),
    )
    .max(15)
    .default([]),
  risks: z
    .array(
      z.object({
        title: z.string().max(200),
        likelihood: z.enum(["low", "medium", "high"]).default("medium"),
        impact: z.enum(["low", "medium", "high"]).default("medium"),
        mitigation: z.string().max(400).default(""),
      }),
    )
    .max(8)
    .default([]),
  map: z
    .object({
      nodes: z
        .array(
          z.object({
            key: z.string().max(60),
            type: z.enum([
              "idea",
              "project",
              "note",
              "goal",
              "feature",
              "task",
              "decision",
              "risk",
              "resource",
              "text",
            ]),
            label: z.string().max(120),
            body: z.string().max(400).default(""),
          }),
        )
        .max(20)
        .default([]),
      edges: z
        .array(
          z.object({
            from: z.string().max(60),
            to: z.string().max(60),
            relation: z.enum([
              "derives_from",
              "depends_on",
              "supports",
              "contradicts",
              "part_of",
              "blocks",
              "replaces",
              "relates_to",
            ]),
            label: z.string().max(60).default(""),
          }),
        )
        .max(30)
        .default([]),
    })
    .default({ nodes: [], edges: [] }),
  ...baseProposal,
});
export type IdeaToProjectResult = z.infer<typeof ideaToProjectSchema>;

/* -------------------------------------------------------- comparison */

export const compareIdeasSchema = z.object({
  criteria: z.array(z.string().max(60)).min(1).max(8),
  rows: z
    .array(
      z.object({
        ideaId: z.string().max(64),
        title: z.string().max(200),
        cells: z.array(z.string().max(300)),
        strengths: z.array(z.string().max(200)).max(4).default([]),
        weaknesses: z.array(z.string().max(200)).max(4).default([]),
      }),
    )
    .max(5),
  recommendation: z.object({
    ideaId: z.string().max(64),
    reasoning: z.string().max(1_200),
    tradeoffs: z.array(z.string().max(300)).max(5).default([]),
    uncertainties: z.array(z.string().max(300)).max(5).default([]),
  }),
  ...baseProposal,
});
export type CompareIdeasResult = z.infer<typeof compareIdeasSchema>;

/* ---------------------------------------------------------- extraction */

export const extractTasksSchema = z.object({
  tasks: z
    .array(
      z.object({
        title: z.string().max(200),
        description: z.string().max(600).default(""),
        priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
      }),
    )
    .max(20),
  ...baseProposal,
});
export type ExtractTasksResult = z.infer<typeof extractTasksSchema>;

export const nextStepSchema = z.object({
  suggestion: z.string().max(300),
  reasoning: z.string().max(800),
  entityType: z.string().max(40).default(""),
  entityId: z.string().max(64).default(""),
  effortMinutes: z.number().int().min(5).max(480).default(60),
  ...baseProposal,
});
export type NextStepResult = z.infer<typeof nextStepSchema>;

export const summarySchema = z.object({
  summary: z.string().max(4_000),
  highlights: z.array(z.string().max(300)).max(8).default([]),
  ...baseProposal,
});
export type SummaryResult = z.infer<typeof summarySchema>;

export const questionsSchema = z.object({
  questions: z
    .array(
      z.object({
        question: z.string().max(300),
        why: z.string().max(400).default(""),
      }),
    )
    .max(8),
  assumptions: baseProposal.assumptions,
  citations: baseProposal.citations,
});
export type QuestionsResult = z.infer<typeof questionsSchema>;

export const similarIdeasSchema = z.object({
  matches: z
    .array(
      z.object({
        ideaId: z.string().max(64),
        similarity: z.number().min(0).max(1),
        why: z.string().max(300),
        duplicate: z.boolean().default(false),
      }),
    )
    .max(10),
  ...baseProposal,
});
export type SimilarIdeasResult = z.infer<typeof similarIdeasSchema>;

export const AI_SCHEMAS = {
  organize_note: organizeNoteSchema,
  idea_to_project: ideaToProjectSchema,
  compare_ideas: compareIdeasSchema,
  extract_tasks: extractTasksSchema,
  next_step: nextStepSchema,
  project_summary: summarySchema,
  weekly_summary: summarySchema,
  missing_questions: questionsSchema,
  similar_ideas: similarIdeasSchema,
} as const;

export type AiFeature = keyof typeof AI_SCHEMAS;
export type AiResultOf<F extends AiFeature> = z.infer<(typeof AI_SCHEMAS)[F]>;
