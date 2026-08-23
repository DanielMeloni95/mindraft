import "server-only";

import type { AiContext, AiIdeaContext, AiProjectContext } from "@/lib/ai/context";
import type { Supabase } from "@/lib/supabase/server";
import { truncate } from "@/lib/utils";

/**
 * Builds the payload sent to the model. Only data the caller can already
 * read is included (every query runs under RLS), and long text is
 * truncated so a single capture cannot blow up the request.
 */

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function buildIdeaContext(
  supabase: Supabase,
  workspaceId: string,
  ideaId: string,
): Promise<AiContext | null> {
  const { data } = await supabase
    .from("ideas")
    .select("id, title, original_content, summary, problem, solution, audience, category, scores:idea_scores(criterion, value, weight)")
    .eq("workspace_id", workspaceId)
    .eq("id", ideaId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!data) return null;

  const row = data as unknown as {
    id: string;
    title: string;
    original_content: string;
    summary: string | null;
    problem: string | null;
    solution: string | null;
    audience: string | null;
    category: string | null;
    scores: Array<{ criterion: string; value: number; weight: number }> | null;
  };

  return {
    locale: "it",
    today: today(),
    idea: toIdeaContext(row),
  };
}

function toIdeaContext(row: {
  id: string;
  title: string;
  original_content: string;
  summary: string | null;
  problem: string | null;
  solution: string | null;
  audience: string | null;
  category: string | null;
  scores?: Array<{ criterion: string; value: number; weight: number }> | null;
}): AiIdeaContext {
  return {
    id: row.id,
    title: row.title,
    originalContent: truncate(row.original_content, 6_000),
    summary: row.summary,
    problem: row.problem,
    solution: row.solution,
    audience: row.audience,
    category: row.category,
    scores: row.scores ?? [],
  };
}

export async function buildIdeasContext(
  supabase: Supabase,
  workspaceId: string,
  ideaIds: string[],
): Promise<AiIdeaContext[]> {
  if (ideaIds.length === 0) return [];
  const { data } = await supabase
    .from("ideas")
    .select("id, title, original_content, summary, problem, solution, audience, category, scores:idea_scores(criterion, value, weight)")
    .eq("workspace_id", workspaceId)
    .in("id", ideaIds)
    .is("deleted_at", null);

  return ((data ?? []) as unknown as Parameters<typeof toIdeaContext>[0][]).map(toIdeaContext);
}

export async function buildProjectContext(
  supabase: Supabase,
  workspaceId: string,
  projectId: string,
): Promise<AiProjectContext | null> {
  const { data: project } = await supabase
    .from("projects")
    .select("id, name, short_description, vision, problem, solution, status")
    .eq("workspace_id", workspaceId)
    .eq("id", projectId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!project) return null;

  const [{ data: tasks }, { data: decisions }, { data: document }] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, title, status, due_date")
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .neq("status", "done")
      .limit(20),
    supabase
      .from("decisions")
      .select("id, title, status")
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .limit(15),
    supabase
      .from("documents")
      .select("plain_text")
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .maybeSingle(),
  ]);

  return {
    id: project.id,
    name: project.name,
    shortDescription: project.short_description,
    vision: project.vision,
    problem: project.problem,
    solution: project.solution,
    status: project.status,
    openTasks: (tasks ?? []).map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      dueDate: t.due_date,
    })),
    decisions: (decisions ?? []).map((d) => ({ id: d.id, title: d.title, status: d.status })),
    documentExcerpt: document?.plain_text ? truncate(document.plain_text, 3_000) : null,
  };
}

export async function buildWorkspaceContext(
  supabase: Supabase,
  workspaceId: string,
): Promise<AiContext> {
  const staleBefore = new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString();

  const [{ count: inbox }, { data: ideas }, { data: stale }, { data: overdue }, { data: decisions }] =
    await Promise.all([
      supabase
        .from("inbox_items")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .eq("status", "unprocessed")
        .is("deleted_at", null),
      supabase
        .from("ideas")
        .select("status")
        .eq("workspace_id", workspaceId)
        .is("deleted_at", null),
      supabase
        .from("projects")
        .select("id, name, last_activity_at")
        .eq("workspace_id", workspaceId)
        .is("deleted_at", null)
        .lt("last_activity_at", staleBefore)
        .neq("status", "archived")
        .limit(5),
      supabase
        .from("tasks")
        .select("id, title, due_date")
        .eq("workspace_id", workspaceId)
        .is("deleted_at", null)
        .neq("status", "done")
        .lt("due_date", today())
        .limit(10),
      supabase
        .from("decisions")
        .select("id, title")
        .eq("workspace_id", workspaceId)
        .is("deleted_at", null)
        .eq("status", "proposed")
        .limit(10),
    ]);

  const ideasByStatus = (ideas ?? []).reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = (acc[row.status] ?? 0) + 1;
    return acc;
  }, {});

  return {
    locale: "it",
    today: today(),
    workspaceSummary: {
      unprocessedInbox: inbox ?? 0,
      ideasByStatus,
      staleProjects: (stale ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        lastActivityAt: p.last_activity_at,
      })),
      overdueTasks: (overdue ?? []).map((t) => ({ id: t.id, title: t.title, dueDate: t.due_date })),
      openDecisions: (decisions ?? []).map((d) => ({ id: d.id, title: d.title })),
    },
  };
}
