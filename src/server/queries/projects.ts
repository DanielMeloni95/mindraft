import "server-only";

import type { Supabase } from "@/lib/supabase/server";
import type {
  DecisionRow,
  DocumentRow,
  GoalRow,
  MilestoneRow,
  ProjectRow,
  ProjectSectionRow,
  ProjectStatus,
  ResourceRow,
  RiskRow,
  TaskRow,
} from "@/types/database";

export type ProjectListItem = ProjectRow & {
  openTasks: number;
  totalTasks: number;
  openDecisions: number;
};

export async function listProjects(
  supabase: Supabase,
  workspaceId: string,
  options: {
    statuses?: ProjectStatus[] | null;
    search?: string | null;
    favoritesOnly?: boolean;
    includeArchived?: boolean;
    limit?: number;
    parentProjectId?: string | null;
    subprojectsOnly?: boolean;
    rootOnly?: boolean;
    excludeTools?: boolean;
  } = {},
): Promise<ProjectListItem[]> {
  let query = supabase
    .from("projects")
    .select("*")
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .order("last_activity_at", { ascending: false })
    .limit(Math.min(options.limit ?? 60, 200));

  if (options.statuses && options.statuses.length > 0) {
    query = query.in("status", options.statuses);
  } else if (!options.includeArchived) {
    query = query.neq("status", "archived");
  }
  if (options.favoritesOnly) query = query.eq("is_favorite", true);
  if (options.parentProjectId) query = query.eq("parent_project_id", options.parentProjectId);
  if (options.subprojectsOnly) query = query.not("parent_project_id", "is", null);
  if (options.rootOnly) query = query.is("parent_project_id", null);
  if (options.search && options.search.trim().length > 1) {
    query = query.ilike("name", `%${options.search.trim()}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Progetti non disponibili: ${error.message}`);

  let projects = (data ?? []) as ProjectRow[];
  if (options.excludeTools && projects.length) {
    const { data: toolNodes, error: toolError } = await supabase.from("canvas_nodes")
      .select("entity_id")
      .eq("workspace_id", workspaceId)
      .eq("entity_type", "project")
      .contains("data", { variant: "tool" });
    if (toolError) throw new Error(`Classificazione progetti non disponibile: ${toolError.message}`);
    const toolIds = new Set((toolNodes ?? []).map((node) => node.entity_id).filter(Boolean));
    projects = projects.filter((project) => !toolIds.has(project.id));
  }
  if (projects.length === 0) return [];

  const ids = projects.map((p) => p.id);

  const [{ data: tasks }, { data: decisions }] = await Promise.all([
    supabase
      .from("tasks")
      .select("project_id, status")
      .in("project_id", ids)
      .is("deleted_at", null),
    supabase
      .from("decisions")
      .select("project_id, status")
      .in("project_id", ids)
      .is("deleted_at", null),
  ]);

  return projects.map((project) => {
    const projectTasks = (tasks ?? []).filter((t) => t.project_id === project.id);
    return {
      ...project,
      totalTasks: projectTasks.length,
      openTasks: projectTasks.filter((t) => t.status !== "done").length,
      openDecisions: (decisions ?? []).filter(
        (d) => d.project_id === project.id && d.status === "proposed",
      ).length,
    };
  });
}

export type ProjectDetail = {
  project: ProjectRow;
  sections: ProjectSectionRow[];
  goals: GoalRow[];
  milestones: MilestoneRow[];
  tasks: TaskRow[];
  decisions: DecisionRow[];
  risks: RiskRow[];
  resources: ResourceRow[];
  document: Pick<DocumentRow, "id" | "title" | "revision" | "updated_at"> | null;
  sourceIdea: { id: string; title: string } | null;
  canvasId: string | null;
};

export async function getProject(
  supabase: Supabase,
  workspaceId: string,
  projectId: string,
): Promise<ProjectDetail | null> {
  const { data: project, error } = await supabase
    .from("projects")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("id", projectId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw new Error(`Progetto non disponibile: ${error.message}`);
  if (!project) return null;

  const [
    { data: sections },
    { data: goals },
    { data: milestones },
    { data: tasks },
    { data: decisions },
    { data: risks },
    { data: resources },
    { data: document },
    { data: canvas },
  ] = await Promise.all([
    supabase.from("project_sections").select("*").eq("project_id", projectId).order("position"),
    supabase.from("goals").select("*").eq("project_id", projectId).is("deleted_at", null).order("position"),
    supabase.from("milestones").select("*").eq("project_id", projectId).is("deleted_at", null).order("position"),
    supabase.from("tasks").select("*").eq("project_id", projectId).is("deleted_at", null).order("position"),
    supabase.from("decisions").select("*").eq("project_id", projectId).is("deleted_at", null).order("created_at", { ascending: false }),
    supabase.from("risks").select("*").eq("project_id", projectId).is("deleted_at", null).order("created_at", { ascending: false }),
    supabase.from("resources").select("*").eq("project_id", projectId).is("deleted_at", null).order("created_at", { ascending: false }),
    supabase.from("documents").select("id, title, revision, updated_at").eq("project_id", projectId).eq("kind", "document").is("deleted_at", null).maybeSingle(),
    supabase.from("canvases").select("id").eq("project_id", projectId).is("deleted_at", null).maybeSingle(),
  ]);

  let sourceIdea: { id: string; title: string } | null = null;
  if (project.source_idea_id) {
    const { data } = await supabase
      .from("ideas")
      .select("id, title")
      .eq("id", project.source_idea_id)
      .maybeSingle();
    sourceIdea = data ?? null;
  }

  return {
    project: project as ProjectRow,
    sections: (sections ?? []) as ProjectSectionRow[],
    goals: (goals ?? []) as GoalRow[],
    milestones: (milestones ?? []) as MilestoneRow[],
    tasks: (tasks ?? []) as TaskRow[],
    decisions: (decisions ?? []) as DecisionRow[],
    risks: (risks ?? []) as RiskRow[],
    resources: (resources ?? []) as ResourceRow[],
    document: document ?? null,
    sourceIdea,
    canvasId: canvas?.id ?? null,
  };
}

export async function listToolProjects(supabase: Supabase, workspaceId: string): Promise<ProjectRow[]> {
  const { data: nodes, error: nodeError } = await supabase.from("canvas_nodes")
    .select("entity_id")
    .eq("workspace_id", workspaceId)
    .eq("entity_type", "project")
    .contains("data", { variant: "tool" });
  if (nodeError) throw new Error(`Strumenti non disponibili: ${nodeError.message}`);
  const ids = [...new Set((nodes ?? []).map((node) => node.entity_id).filter((id): id is string => Boolean(id)))];
  if (!ids.length) return [];
  const { data, error } = await supabase.from("projects").select("*")
    .eq("workspace_id", workspaceId).in("id", ids).is("deleted_at", null)
    .order("last_activity_at", { ascending: false });
  if (error) throw new Error(`Strumenti non disponibili: ${error.message}`);
  return (data ?? []) as ProjectRow[];
}

export async function getProjectHeader(
  supabase: Supabase,
  workspaceId: string,
  projectId: string,
): Promise<Pick<ProjectRow, "id" | "name" | "emoji" | "color" | "short_description" | "website_url" | "status" | "health" | "progress" | "next_step" | "parent_project_id" | "context_scope"> | null> {
  const { data } = await supabase
    .from("projects")
    .select("id, name, emoji, color, short_description, website_url, status, health, progress, next_step, parent_project_id, context_scope")
    .eq("workspace_id", workspaceId)
    .eq("id", projectId)
    .is("deleted_at", null)
    .maybeSingle();
  return data ?? null;
}

export async function listProjectOptions(
  supabase: Supabase,
  workspaceId: string,
): Promise<Array<{ id: string; name: string; emoji: string | null }>> {
  const { data } = await supabase
    .from("projects")
    .select("id, name, emoji")
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .neq("status", "archived")
    .order("last_activity_at", { ascending: false })
    .limit(100);
  return data ?? [];
}

export async function activityFor(
  supabase: Supabase,
  workspaceId: string,
  entityId: string,
  limit = 25,
) {
  const { data } = await supabase
    .from("activity_log")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("entity_id", entityId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}
