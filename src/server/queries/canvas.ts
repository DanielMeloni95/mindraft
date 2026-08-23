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
    type: "idea" | "project" | "task" | "decision" | "risk";
    label: string;
    status: string | null;
    orphan: boolean;
  }>;
  edges: Array<{ id: string; source: string; target: string; relation: string }>;
};

export async function getGlobalGraph(
  supabase: Supabase,
  workspaceId: string,
): Promise<GraphData> {
  const [{ data: ideas }, { data: projects }, { data: decisions }, { data: relations }] =
    await Promise.all([
      supabase
        .from("ideas")
        .select("id, title, status, project_id")
        .eq("workspace_id", workspaceId)
        .is("deleted_at", null)
        .limit(300),
      supabase
        .from("projects")
        .select("id, name, status")
        .eq("workspace_id", workspaceId)
        .is("deleted_at", null)
        .limit(200),
      supabase
        .from("decisions")
        .select("id, title, status, project_id")
        .eq("workspace_id", workspaceId)
        .is("deleted_at", null)
        .limit(200),
      supabase
        .from("entity_relations")
        .select("id, source_type, source_id, target_type, target_id, relation")
        .eq("workspace_id", workspaceId)
        .limit(1000),
    ]);

  const nodes: GraphData["nodes"] = [];
  const edges: GraphData["edges"] = [];
  const connected = new Set<string>();

  for (const project of projects ?? []) {
    nodes.push({ id: project.id, type: "project", label: project.name, status: project.status, orphan: true });
  }
  for (const idea of ideas ?? []) {
    nodes.push({ id: idea.id, type: "idea", label: idea.title, status: idea.status, orphan: true });
    if (idea.project_id) {
      edges.push({
        id: `idea-project-${idea.id}`,
        source: idea.id,
        target: idea.project_id,
        relation: "derives_from",
      });
      connected.add(idea.id);
      connected.add(idea.project_id);
    }
  }
  for (const decision of decisions ?? []) {
    nodes.push({ id: decision.id, type: "decision", label: decision.title, status: decision.status, orphan: true });
    if (decision.project_id) {
      edges.push({
        id: `decision-project-${decision.id}`,
        source: decision.id,
        target: decision.project_id,
        relation: "part_of",
      });
      connected.add(decision.id);
      connected.add(decision.project_id);
    }
  }

  const known = new Set(nodes.map((n) => n.id));
  for (const relation of relations ?? []) {
    if (!known.has(relation.source_id) || !known.has(relation.target_id)) continue;
    edges.push({
      id: relation.id,
      source: relation.source_id,
      target: relation.target_id,
      relation: relation.relation,
    });
    connected.add(relation.source_id);
    connected.add(relation.target_id);
  }

  return {
    nodes: nodes.map((n) => ({ ...n, orphan: !connected.has(n.id) })),
    edges,
  };
}
