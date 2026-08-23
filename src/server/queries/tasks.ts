import "server-only";

import type { Supabase } from "@/lib/supabase/server";
import type { TaskRow, TaskStatus } from "@/types/database";

export type TaskWithProject = TaskRow & {
  project: { id: string; name: string; emoji: string | null; color: string | null } | null;
};

export type TaskView = "today" | "upcoming" | "board" | "list" | "done";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function listTasks(
  supabase: Supabase,
  workspaceId: string,
  options: {
    view?: TaskView;
    projectId?: string | null;
    statuses?: TaskStatus[] | null;
    search?: string | null;
    limit?: number;
  } = {},
): Promise<TaskWithProject[]> {
  const view = options.view ?? "list";

  let query = supabase
    .from("tasks")
    .select("*, project:projects(id, name, emoji, color)")
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .limit(Math.min(options.limit ?? 200, 500));

  if (options.projectId) query = query.eq("project_id", options.projectId);
  if (options.statuses && options.statuses.length > 0) query = query.in("status", options.statuses);
  if (options.search && options.search.trim().length > 1) {
    query = query.ilike("title", `%${options.search.trim()}%`);
  }

  if (view === "today") {
    query = query.neq("status", "done").lte("due_date", todayIso()).order("due_date", { ascending: true });
  } else if (view === "upcoming") {
    query = query.neq("status", "done").gt("due_date", todayIso()).order("due_date", { ascending: true });
  } else if (view === "done") {
    query = query.eq("status", "done").order("completed_at", { ascending: false });
  } else {
    query = query.order("position", { ascending: true }).order("created_at", { ascending: false });
  }

  const { data, error } = await query;
  if (error) throw new Error(`Attività non disponibili: ${error.message}`);
  return (data ?? []) as unknown as TaskWithProject[];
}

export async function taskCounts(
  supabase: Supabase,
  workspaceId: string,
): Promise<{ overdue: number; today: number; open: number }> {
  const today = todayIso();
  const { data } = await supabase
    .from("tasks")
    .select("status, due_date")
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .neq("status", "done");

  const rows = data ?? [];
  return {
    open: rows.length,
    overdue: rows.filter((t) => t.due_date && t.due_date < today).length,
    today: rows.filter((t) => t.due_date === today).length,
  };
}
