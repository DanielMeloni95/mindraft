import "server-only";

import type { Supabase } from "@/lib/supabase/server";
import type {
  DecisionRow,
  IdeaRow,
  ProjectRow,
  TaskRow,
} from "@/types/database";

export type DashboardData = {
  greetingName: string | null;
  unprocessedInbox: number;
  activeProjects: Array<
    Pick<ProjectRow, "id" | "name" | "emoji" | "color" | "status" | "health" | "progress" | "next_step" | "last_activity_at">
  >;
  recentIdeas: Array<Pick<IdeaRow, "id" | "title" | "status" | "created_at" | "summary" | "original_content">>;
  dueTasks: Array<Pick<TaskRow, "id" | "title" | "due_date" | "status" | "priority" | "project_id">>;
  openDecisions: Array<Pick<DecisionRow, "id" | "title" | "project_id" | "created_at">>;
  staleProjects: Array<Pick<ProjectRow, "id" | "name" | "emoji" | "last_activity_at">>;
  continueFrom: {
    kind: "project" | "idea" | "inbox" | "none";
    id: string | null;
    label: string;
    href: string;
  };
  week: {
    ideasCaptured: number;
    tasksCompleted: number;
    decisionsMade: number;
  };
};

const STALE_DAYS = 14;

export async function getDashboardData(
  supabase: Supabase,
  workspaceId: string,
  fullName: string | null,
): Promise<DashboardData> {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000).toISOString();
  const staleBefore = new Date(now.getTime() - STALE_DAYS * 24 * 3600 * 1000).toISOString();
  const inAWeek = new Date(now.getTime() + 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);

  const [
    { count: inboxCount },
    { data: projects },
    { data: ideas },
    { data: tasks },
    { data: decisions },
    { data: weekIdeas },
    { data: weekTasks },
    { data: weekDecisions },
    { data: lastActivity },
  ] = await Promise.all([
    supabase
      .from("inbox_items")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("status", "unprocessed")
      .is("deleted_at", null),
    supabase
      .from("projects")
      .select("id, name, emoji, color, status, health, progress, next_step, last_activity_at")
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .not("status", "in", "(archived,completed)")
      .order("last_activity_at", { ascending: false })
      .limit(6),
    supabase
      .from("ideas")
      .select("id, title, status, created_at, summary, original_content")
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .in("status", ["inbox", "to_explore", "analyzing"])
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("tasks")
      .select("id, title, due_date, status, priority, project_id")
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .neq("status", "done")
      .not("due_date", "is", null)
      .lte("due_date", inAWeek)
      .order("due_date", { ascending: true })
      .limit(8),
    supabase
      .from("decisions")
      .select("id, title, project_id, created_at")
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .eq("status", "proposed")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("ideas")
      .select("id", { count: "exact", head: false })
      .eq("workspace_id", workspaceId)
      .gte("created_at", weekAgo),
    supabase
      .from("tasks")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("status", "done")
      .gte("completed_at", weekAgo),
    supabase
      .from("decisions")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("status", "approved")
      .gte("updated_at", weekAgo),
    supabase
      .from("activity_log")
      .select("entity_type, entity_id, summary, created_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  const activeProjects = projects ?? [];
  const stale = activeProjects.filter((p) => p.last_activity_at < staleBefore);

  const last = lastActivity?.[0];
  let continueFrom: DashboardData["continueFrom"] = {
    kind: "none",
    id: null,
    label: "Non hai ancora nulla in corso",
    href: "/inbox",
  };

  if (activeProjects.length > 0) {
    const p = activeProjects[0];
    continueFrom = {
      kind: "project",
      id: p.id,
      label: p.next_step ? `${p.name} — ${p.next_step}` : p.name,
      href: `/projects/${p.id}`,
    };
  } else if (last && last.entity_type === "idea") {
    continueFrom = {
      kind: "idea",
      id: last.entity_id,
      label: last.summary ?? "Ultima idea su cui hai lavorato",
      href: `/ideas/${last.entity_id}`,
    };
  } else if ((inboxCount ?? 0) > 0) {
    continueFrom = {
      kind: "inbox",
      id: null,
      label: `${inboxCount} elementi in Inbox da elaborare`,
      href: "/inbox",
    };
  }

  return {
    greetingName: fullName,
    unprocessedInbox: inboxCount ?? 0,
    activeProjects,
    recentIdeas: ideas ?? [],
    dueTasks: (tasks ?? []).filter((t) => t.due_date !== null),
    openDecisions: decisions ?? [],
    staleProjects: stale.map((p) => ({
      id: p.id,
      name: p.name,
      emoji: p.emoji,
      last_activity_at: p.last_activity_at,
    })),
    continueFrom,
    week: {
      ideasCaptured: (weekIdeas ?? []).length,
      tasksCompleted: (weekTasks ?? []).length,
      decisionsMade: (weekDecisions ?? []).length,
    },
  };
}

export { STALE_DAYS };
