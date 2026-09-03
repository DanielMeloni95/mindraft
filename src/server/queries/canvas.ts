import "server-only";

import type { Supabase } from "@/lib/supabase/server";
import type { CanvasEdgeRow, CanvasNodeRow, CanvasRow } from "@/types/database";

export type CanvasBundle = {
  canvas: CanvasRow;
  nodes: CanvasNodeRow[];
  edges: CanvasEdgeRow[];
};

export async function getCanvasBundle(
  supabase: Supabase,
  workspaceId: string,
  canvasId: string,
): Promise<CanvasBundle | null> {
  const { data: canvas } = await supabase
    .from("canvases")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("id", canvasId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!canvas) return null;

  const [{ data: nodes }, { data: edges }] = await Promise.all([
    supabase.from("canvas_nodes").select("*").eq("canvas_id", canvasId).order("created_at"),
    supabase.from("canvas_edges").select("*").eq("canvas_id", canvasId),
  ]);

  return {
    canvas: canvas as CanvasRow,
    nodes: (nodes ?? []) as CanvasNodeRow[],
    edges: (edges ?? []) as CanvasEdgeRow[],
  };
}

/**
 * The global map. Built from real entities and their typed relations —
 * not a decorative constellation: every node opens the thing it stands
 * for and every edge is a relation somebody actually recorded.
 */
export type GraphData = {
  nodes: Array<{
    id: string;
    type: "project";
    kind: "me" | "area" | "project" | "subproject" | "tool";
    level: number;
    label: string;
    color: string | null;
    status: string | null;
    orphan: boolean;
  }>;
  edges: Array<{ id: string; source: string; target: string; relation: string }>;
};

export async function getGlobalGraph(
  supabase: Supabase,
  workspaceId: string,
): Promise<GraphData> {
  const [{ data: projects }, { data: projectNodes }, { data: canvasEdges }] = await Promise.all([
    supabase.from("projects").select("id, name, status, parent_project_id, color, context_scope")
      .eq("workspace_id", workspaceId).is("deleted_at", null).limit(500),
    supabase.from("canvas_nodes").select("id, entity_id, data")
      .eq("workspace_id", workspaceId).eq("entity_type", "project"),
    supabase.from("canvas_edges").select("id, source_node_id, target_node_id, relation")
      .eq("workspace_id", workspaceId),
  ]);
  const toolIds = new Set((projectNodes ?? []).filter((node) => {
    const value = node.data && !Array.isArray(node.data) && typeof node.data === "object"
      ? node.data as Record<string, unknown> : {};
    return value.variant === "tool";
  }).map((node) => node.entity_id).filter((id): id is string => Boolean(id)));
  const rows = projects ?? [];
  const known = new Set(rows.map((project) => project.id));
  const topProject = (projectId: string) => {
    let current = rows.find((project) => project.id === projectId);
    const visited = new Set<string>();
    while (current?.parent_project_id && known.has(current.parent_project_id) && !visited.has(current.parent_project_id)) {
      visited.add(current.parent_project_id);
      current = rows.find((project) => project.id === current?.parent_project_id);
    }
    return current;
  };
  const areaName = (projectId: string) => topProject(projectId)?.context_scope?.trim() || "Senza ambito";
  const areaId = (name: string) => `area:${encodeURIComponent(name.toLocaleLowerCase("it"))}`;
  const areas = [...new Map(rows.map((project) => {
    const top = topProject(project.id);
    const name = areaName(project.id);
    return [name.toLocaleLowerCase("it"), { name, color: top?.color ?? null }];
  })).values()];
  const entityByCanvasNode = new Map((projectNodes ?? [])
    .filter((node) => node.entity_id && known.has(node.entity_id))
    .map((node) => [node.id, node.entity_id as string]));
  const projectEdges: GraphData["edges"] = [];
  const edgeKeys = new Set<string>();
  for (const edge of canvasEdges ?? []) {
    const storedSource = entityByCanvasNode.get(edge.source_node_id);
    const storedTarget = entityByCanvasNode.get(edge.target_node_id);
    if (!storedSource || !storedTarget || storedSource === storedTarget) continue;
    // A project canvas can reference shared entities, but the global conceptual
    // map must never merge two independent top-level project trees.
    if (topProject(storedSource)?.id !== topProject(storedTarget)?.id) continue;
    const source = edge.relation === "part_of" ? storedTarget : storedSource;
    const target = edge.relation === "part_of" ? storedSource : storedTarget;
    const key = `${source}:${target}:${edge.relation}`;
    if (edgeKeys.has(key)) continue;
    edgeKeys.add(key);
    projectEdges.push({ id: `canvas-${edge.id}`, source, target, relation: edge.relation });
  }
  const incoming = new Set(projectEdges.map((edge) => edge.target));
  for (const project of rows) {
    if (!project.parent_project_id || !known.has(project.parent_project_id) || incoming.has(project.id)) continue;
    const key = `${project.parent_project_id}:${project.id}:part_of`;
    if (!edgeKeys.has(key)) projectEdges.push({ id: `hierarchy-${project.id}`, source: project.parent_project_id, target: project.id, relation: "part_of" });
  }
  const parents = new Map<string, string[]>();
  for (const edge of projectEdges) parents.set(edge.target, [...(parents.get(edge.target) ?? []), edge.source]);
  const levelCache = new Map<string, number>();
  const levelOf = (projectId: string, visiting = new Set<string>()): number => {
    if (levelCache.has(projectId)) return levelCache.get(projectId)!;
    if (visiting.has(projectId)) return 2;
    visiting.add(projectId);
    const projectParents = (parents.get(projectId) ?? []).filter((id) => known.has(id));
    const level = projectParents.length ? Math.max(...projectParents.map((id) => levelOf(id, visiting))) + 1 : 2;
    visiting.delete(projectId);
    levelCache.set(projectId, level);
    return level;
  };
  const nodes: GraphData["nodes"] = [{
    id: "me", type: "project", kind: "me", level: 0, label: "Me", color: "#2563eb", status: null, orphan: false,
  }, ...areas.map((area) => ({
    id: areaId(area.name), type: "project" as const, kind: "area" as const, level: 1,
    label: area.name, color: area.color, status: null, orphan: false,
  })), ...rows.map((project) => ({
    id: project.id,
    type: "project" as const,
    kind: toolIds.has(project.id) ? "tool" as const
      : project.parent_project_id ? "subproject" as const : "project" as const,
    level: levelOf(project.id),
    label: project.name,
    color: project.color,
    status: project.status,
    orphan: false,
  }))];
  const edges: GraphData["edges"] = [
    ...areas.map((area) => ({ id: `hierarchy-${areaId(area.name)}`, source: "me", target: areaId(area.name), relation: "part_of" })),
    ...rows.filter((project) => !(parents.get(project.id) ?? []).some((id) => known.has(id))).map((project) => ({
      id: `area-project-${project.id}`, source: areaId(areaName(project.id)), target: project.id, relation: "part_of",
    })),
    ...projectEdges,
  ];
  return { nodes, edges };
}
