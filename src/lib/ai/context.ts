/**
 * The shape of what we send to the model. Everything the AI sees is
 * assembled here, from data the caller already had permission to read.
 * Keeping it a typed object (serialised as JSON) means the mock provider
 * and the real one receive exactly the same input.
 */

export type AiIdeaContext = {
  id: string;
  title: string;
  originalContent: string;
  summary: string | null;
  problem: string | null;
  solution: string | null;
  audience: string | null;
  category: string | null;
  scores?: Array<{ criterion: string; value: number; weight: number }>;
};

export type AiProjectContext = {
  id: string;
  name: string;
  shortDescription: string | null;
  vision: string | null;
  problem: string | null;
  solution: string | null;
  status: string;
  openTasks: Array<{ id: string; title: string; status: string; dueDate: string | null }>;
  decisions: Array<{ id: string; title: string; status: string }>;
  documentExcerpt: string | null;
};

export type AiContext = {
  locale: "it";
  today: string;
  idea?: AiIdeaContext;
  ideas?: AiIdeaContext[];
  project?: AiProjectContext;
  text?: string;
  workspaceSummary?: {
    unprocessedInbox: number;
    ideasByStatus: Record<string, number>;
    staleProjects: Array<{ id: string; name: string; lastActivityAt: string }>;
    overdueTasks: Array<{ id: string; title: string; dueDate: string | null }>;
    openDecisions: Array<{ id: string; title: string }>;
  };
};

export function serializeContext(context: AiContext): string {
  return JSON.stringify(context, null, 2);
}

export function parseContext(raw: string): AiContext {
  try {
    return JSON.parse(raw) as AiContext;
  } catch {
    return { locale: "it", today: new Date().toISOString().slice(0, 10) };
  }
}
