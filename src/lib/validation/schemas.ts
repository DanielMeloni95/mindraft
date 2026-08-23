import { z } from "zod";

/**
 * One schema per mutation, shared by the form (React Hook Form) and the
 * server action. The server always re-validates: the client copy exists
 * for immediate feedback, not for safety.
 */

export const uuid = z.string().uuid("Identificativo non valido");

const trimmed = (min: number, max: number, message: string) =>
  z.string().trim().min(min, message).max(max, `Massimo ${max} caratteri`);

export const ideaStatusEnum = z.enum([
  "inbox",
  "to_explore",
  "analyzing",
  "promising",
  "converted",
  "paused",
  "discarded",
  "archived",
]);

export const ideaMaturityEnum = z.enum(["spark", "sketch", "shaped", "validated"]);

export const projectStatusEnum = z.enum([
  "idea",
  "exploration",
  "validation",
  "design",
  "development",
  "paused",
  "completed",
  "archived",
]);

export const projectHealthEnum = z.enum(["unknown", "on_track", "at_risk", "blocked"]);
export const taskStatusEnum = z.enum(["todo", "in_progress", "blocked", "done"]);
export const taskPriorityEnum = z.enum(["low", "medium", "high", "urgent"]);
export const decisionStatusEnum = z.enum(["proposed", "approved", "superseded"]);
export const severityEnum = z.enum(["low", "medium", "high"]);
export const milestoneStatusEnum = z.enum(["planned", "in_progress", "done", "canceled"]);
export const relationEnum = z.enum([
  "derives_from",
  "depends_on",
  "supports",
  "contradicts",
  "part_of",
  "blocks",
  "replaces",
  "relates_to",
]);
export const entityTypeEnum = z.enum([
  "inbox_item",
  "idea",
  "project",
  "document",
  "goal",
  "milestone",
  "task",
  "decision",
  "risk",
  "resource",
  "canvas_node",
  "note",
]);
export const canvasNodeTypeEnum = z.enum([
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
  "group",
]);

const optionalDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data non valida")
  .optional()
  .or(z.literal("").transform(() => undefined));

/* ---------------------------------------------------------- capture */

export const quickCaptureSchema = z.object({
  content: trimmed(1, 20_000, "Scrivi qualcosa prima di salvare"),
  url: z.string().url("URL non valido").optional().or(z.literal("").transform(() => undefined)),
  projectId: uuid.optional().or(z.literal("").transform(() => undefined)),
  tags: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
});
export type QuickCaptureInput = z.infer<typeof quickCaptureSchema>;

export const inboxUpdateSchema = z.object({
  id: uuid,
  content: z.string().trim().max(20_000).optional(),
  status: z.enum(["unprocessed", "processed", "archived"]).optional(),
  projectId: uuid.nullable().optional(),
});

/* ------------------------------------------------------------ ideas */

export const ideaCreateSchema = z.object({
  title: trimmed(1, 200, "Serve un titolo").optional(),
  originalContent: trimmed(1, 20_000, "Serve un contenuto"),
  category: z.string().trim().max(60).optional(),
  status: ideaStatusEnum.optional(),
  sourceInboxItemId: uuid.optional(),
  projectId: uuid.optional(),
});
export type IdeaCreateInput = z.infer<typeof ideaCreateSchema>;

export const ideaUpdateSchema = z.object({
  id: uuid,
  title: trimmed(1, 200, "Serve un titolo").optional(),
  summary: z.string().trim().max(2_000).nullable().optional(),
  problem: z.string().trim().max(4_000).nullable().optional(),
  solution: z.string().trim().max(4_000).nullable().optional(),
  audience: z.string().trim().max(2_000).nullable().optional(),
  expectedValue: z.string().trim().max(2_000).nullable().optional(),
  personalMotivation: z.string().trim().max(2_000).nullable().optional(),
  category: z.string().trim().max(60).nullable().optional(),
  status: ideaStatusEnum.optional(),
  maturity: ideaMaturityEnum.optional(),
  isFavorite: z.boolean().optional(),
});
export type IdeaUpdateInput = z.infer<typeof ideaUpdateSchema>;

export const ideaScoreSchema = z.object({
  ideaId: uuid,
  scores: z
    .array(
      z.object({
        criterion: z.string().min(1).max(40),
        value: z.number().int().min(0).max(10),
        weight: z.number().min(0).max(5),
      }),
    )
    .max(20),
});

/* --------------------------------------------------------- projects */

export const projectCreateSchema = z.object({
  name: trimmed(1, 200, "Serve un nome"),
  shortDescription: z.string().trim().max(500).optional(),
  emoji: z.string().trim().max(8).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Colore non valido").optional(),
  sourceIdeaId: uuid.optional(),
  status: projectStatusEnum.optional(),
});
export type ProjectCreateInput = z.infer<typeof projectCreateSchema>;

export const projectUpdateSchema = z.object({
  id: uuid,
  name: trimmed(1, 200, "Serve un nome").optional(),
  emoji: z.string().trim().max(8).nullable().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
  shortDescription: z.string().trim().max(500).nullable().optional(),
  vision: z.string().trim().max(4_000).nullable().optional(),
  problem: z.string().trim().max(4_000).nullable().optional(),
  solution: z.string().trim().max(4_000).nullable().optional(),
  audience: z.string().trim().max(2_000).nullable().optional(),
  valueProposition: z.string().trim().max(2_000).nullable().optional(),
  scopeIn: z.string().trim().max(4_000).nullable().optional(),
  scopeOut: z.string().trim().max(4_000).nullable().optional(),
  status: projectStatusEnum.optional(),
  health: projectHealthEnum.optional(),
  progress: z.number().int().min(0).max(100).optional(),
  nextStep: z.string().trim().max(500).nullable().optional(),
  costEstimate: z.number().min(0).nullable().optional(),
  stack: z.array(z.string().trim().min(1).max(40)).max(30).optional(),
  isFavorite: z.boolean().optional(),
});
export type ProjectUpdateInput = z.infer<typeof projectUpdateSchema>;

/* -------------------------------------------------------- documents */

export const documentSaveSchema = z.object({
  documentId: uuid,
  content: z.unknown(),
  plainText: z.string().max(500_000),
  /** Optimistic-concurrency token: the revision the client started from. */
  baseRevision: z.number().int().min(0).optional(),
  snapshotLabel: z.string().trim().max(80).optional(),
});

/* ------------------------------------------------------------ tasks */

export const taskCreateSchema = z.object({
  title: trimmed(1, 300, "Serve un titolo"),
  description: z.string().trim().max(8_000).optional(),
  projectId: uuid.optional(),
  milestoneId: uuid.optional(),
  status: taskStatusEnum.optional(),
  priority: taskPriorityEnum.optional(),
  dueDate: optionalDate,
  estimateMinutes: z.number().int().min(0).max(100_000).optional(),
  originType: entityTypeEnum.optional(),
  originId: uuid.optional(),
});
export type TaskCreateInput = z.infer<typeof taskCreateSchema>;

export const taskUpdateSchema = z.object({
  id: uuid,
  title: trimmed(1, 300, "Serve un titolo").optional(),
  description: z.string().trim().max(8_000).nullable().optional(),
  status: taskStatusEnum.optional(),
  priority: taskPriorityEnum.optional(),
  dueDate: optionalDate.nullable(),
  estimateMinutes: z.number().int().min(0).max(100_000).nullable().optional(),
  milestoneId: uuid.nullable().optional(),
  projectId: uuid.nullable().optional(),
  position: z.number().int().optional(),
  checklist: z
    .array(z.object({ id: z.string(), title: z.string().max(300), done: z.boolean() }))
    .max(50)
    .optional(),
});

/* -------------------------------------------------------- milestones */

export const milestoneSchema = z.object({
  id: uuid.optional(),
  projectId: uuid,
  title: trimmed(1, 200, "Serve un titolo"),
  description: z.string().trim().max(4_000).optional(),
  phase: z.string().trim().max(80).optional(),
  versionLabel: z.string().trim().max(40).optional(),
  status: milestoneStatusEnum.optional(),
  startsOn: optionalDate,
  endsOn: optionalDate,
  progress: z.number().int().min(0).max(100).optional(),
  isEstimate: z.boolean().optional(),
});

/* --------------------------------------------------------- decisions */

export const decisionSchema = z.object({
  id: uuid.optional(),
  projectId: uuid.optional(),
  title: trimmed(1, 300, "Descrivi la decisione"),
  context: z.string().trim().max(4_000).optional(),
  alternatives: z.string().trim().max(4_000).optional(),
  rationale: z.string().trim().max(4_000).optional(),
  consequences: z.string().trim().max(4_000).optional(),
  status: decisionStatusEnum.optional(),
  decidedOn: optionalDate,
});
export type DecisionInput = z.infer<typeof decisionSchema>;

export const riskSchema = z.object({
  id: uuid.optional(),
  projectId: uuid,
  title: trimmed(1, 300, "Serve un titolo"),
  description: z.string().trim().max(4_000).optional(),
  likelihood: severityEnum.optional(),
  impact: severityEnum.optional(),
  mitigation: z.string().trim().max(4_000).optional(),
  isOpen: z.boolean().optional(),
});

export const goalSchema = z.object({
  id: uuid.optional(),
  projectId: uuid,
  title: trimmed(1, 200, "Serve un titolo"),
  metric: z.string().trim().max(120).optional(),
  targetValue: z.string().trim().max(80).optional(),
  currentValue: z.string().trim().max(80).optional(),
  dueDate: optionalDate,
  isAchieved: z.boolean().optional(),
});

export const resourceSchema = z.object({
  id: uuid.optional(),
  projectId: uuid.optional(),
  ideaId: uuid.optional(),
  title: trimmed(1, 200, "Serve un titolo"),
  url: z.string().url("URL non valido").optional().or(z.literal("").transform(() => undefined)),
  kind: z.enum(["link", "file", "person", "tool", "budget", "note"]).optional(),
  notes: z.string().trim().max(4_000).optional(),
});

/* ------------------------------------------------------------ canvas */

export const canvasNodeCreateSchema = z.object({
  canvasId: uuid,
  type: canvasNodeTypeEnum,
  label: z.string().trim().max(200).default(""),
  body: z.string().trim().max(4_000).optional(),
  positionX: z.number(),
  positionY: z.number(),
});

export const canvasNodeUpdateSchema = z.object({
  id: uuid,
  label: z.string().trim().max(200).optional(),
  body: z.string().trim().max(4_000).nullable().optional(),
  type: canvasNodeTypeEnum.optional(),
  positionX: z.number().optional(),
  positionY: z.number().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
});

export const canvasPositionsSchema = z.object({
  canvasId: uuid,
  nodes: z
    .array(z.object({ id: uuid, positionX: z.number(), positionY: z.number() }))
    .max(500),
  viewport: z
    .object({ x: z.number(), y: z.number(), zoom: z.number().min(0.05).max(8) })
    .optional(),
});

export const canvasEdgeSchema = z.object({
  canvasId: uuid,
  sourceNodeId: uuid,
  targetNodeId: uuid,
  relation: relationEnum.optional(),
  label: z.string().trim().max(80).optional(),
});

/* --------------------------------------------------------- relations */

export const entityRelationSchema = z.object({
  sourceType: entityTypeEnum,
  sourceId: uuid,
  targetType: entityTypeEnum,
  targetId: uuid,
  relation: relationEnum,
  note: z.string().trim().max(500).optional(),
});

/* ------------------------------------------------------------- misc */

export const onboardingSchema = z.object({
  fullName: trimmed(1, 80, "Come ti chiami?"),
  primaryUse: z.string().trim().max(120).optional(),
  focusAreas: z.array(z.string().trim().min(1).max(40)).max(8),
  guidanceLevel: z.enum(["minimal", "balanced", "guided"]),
  firstIdea: z.string().trim().max(4_000).optional(),
});
export type OnboardingInput = z.infer<typeof onboardingSchema>;

export const credentialsSchema = z.object({
  email: z.string().trim().email("Indirizzo email non valido"),
  password: z.string().min(8, "Almeno 8 caratteri").max(72),
});

export const signUpSchema = credentialsSchema.extend({
  fullName: trimmed(1, 80, "Come ti chiami?"),
});

export const weeklyReviewSchema = z.object({
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  summary: z.string().trim().max(8_000),
  focusItems: z
    .array(z.object({ title: z.string().trim().min(1).max(200), done: z.boolean() }))
    .max(3, "Al massimo tre focus"),
});

export const feedbackSchema = z.object({
  kind: z.enum(["general", "bug", "idea", "ai_quality"]),
  message: trimmed(3, 4_000, "Scrivi qualcosa"),
});

export const savedViewSchema = z.object({
  scope: z.enum(["ideas", "projects", "tasks", "search"]),
  name: trimmed(1, 60, "Serve un nome"),
  filters: z.record(z.string(), z.unknown()),
});
