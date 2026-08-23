"use server";

import { revalidatePath } from "next/cache";

import {
  canvasEdgeSchema,
  canvasNodeCreateSchema,
  canvasNodeUpdateSchema,
  canvasPositionsSchema,
  uuid,
} from "@/lib/validation/schemas";
import { fail, guard, ok, parseInput, type ActionResult } from "@/server/action-result";
import { requireWriteSession } from "@/server/session";
import type { CanvasNodeType, EntityType, Json } from "@/types/database";

async function assertCanvas(
  session: Awaited<ReturnType<typeof requireWriteSession>>,
  canvasId: string,
): Promise<{ projectId: string | null } | null> {
  const { data } = await session.supabase
    .from("canvases")
    .select("id, project_id")
    .eq("id", canvasId)
    .eq("workspace_id", session.workspace.id)
    .is("deleted_at", null)
    .maybeSingle();
  return data ? { projectId: data.project_id } : null;
}

export async function createCanvasNodeAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return guard(async () => {
    const parsed = parseInput(canvasNodeCreateSchema, input);
    if (!parsed.ok) return parsed.result;

    const session = await requireWriteSession();
    const canvas = await assertCanvas(session, parsed.data.canvasId);
    if (!canvas) return fail("Mappa non trovata.");

    const { data, error } = await session.supabase
      .from("canvas_nodes")
      .insert({
        workspace_id: session.workspace.id,
        canvas_id: parsed.data.canvasId,
        type: parsed.data.type,
        label: parsed.data.label,
        body: parsed.data.body ?? null,
        position_x: parsed.data.positionX,
        position_y: parsed.data.positionY,
      })
      .select("id")
      .single();

    if (error || !data) return fail(`Nodo non creato: ${error?.message}`);
    return ok({ id: data.id });
  });
}

/**
 * Label edits propagate to the mirrored entity, so a node and a card are
 * two views of one object rather than two copies that drift apart.
 */
export async function updateCanvasNodeAction(
  input: unknown,
): Promise<ActionResult<undefined>> {
  return guard(async () => {
    const parsed = parseInput(canvasNodeUpdateSchema, input);
    if (!parsed.ok) return parsed.result;

    const session = await requireWriteSession();
    const d = parsed.data;

    const payload = {
      ...(d.label !== undefined ? { label: d.label } : {}),
      ...(d.body !== undefined ? { body: d.body } : {}),
      ...(d.type !== undefined ? { type: d.type } : {}),
      ...(d.positionX !== undefined ? { position_x: d.positionX } : {}),
      ...(d.positionY !== undefined ? { position_y: d.positionY } : {}),
      ...(d.color !== undefined ? { color: d.color } : {}),
    };

    if (Object.keys(payload).length === 0) return ok();

    const { data, error } = await session.supabase
      .from("canvas_nodes")
      .update(payload)
      .eq("id", d.id)
      .eq("workspace_id", session.workspace.id)
      .select("entity_type, entity_id, canvas_id")
      .maybeSingle();

    if (error) return fail(`Nodo non aggiornato: ${error.message}`);

    if (d.label !== undefined && data?.entity_type && data.entity_id) {
      await syncEntityLabel(session, data.entity_type, data.entity_id, d.label);
    }

    return ok();
  });
}

async function syncEntityLabel(
  session: Awaited<ReturnType<typeof requireWriteSession>>,
  entityType: EntityType,
  entityId: string,
  label: string,
): Promise<void> {
  const trimmed = label.trim();
  if (trimmed.length === 0) return;

  if (entityType === "idea") {
    await session.supabase
      .from("ideas")
      .update({ title: trimmed })
      .eq("id", entityId)
      .eq("workspace_id", session.workspace.id);
  } else if (entityType === "project") {
    await session.supabase
      .from("projects")
      .update({ name: trimmed })
      .eq("id", entityId)
      .eq("workspace_id", session.workspace.id);
  } else if (entityType === "task") {
    await session.supabase
      .from("tasks")
      .update({ title: trimmed })
      .eq("id", entityId)
      .eq("workspace_id", session.workspace.id);
  } else if (entityType === "decision") {
    await session.supabase
      .from("decisions")
      .update({ title: trimmed })
      .eq("id", entityId)
      .eq("workspace_id", session.workspace.id);
  } else if (entityType === "risk") {
    await session.supabase
      .from("risks")
      .update({ title: trimmed })
      .eq("id", entityId)
      .eq("workspace_id", session.workspace.id);
  }
}

/** One round-trip for a whole drag gesture. */
export async function saveCanvasLayoutAction(
  input: unknown,
): Promise<ActionResult<undefined>> {
  return guard(async () => {
    const parsed = parseInput(canvasPositionsSchema, input);
    if (!parsed.ok) return parsed.result;

    const session = await requireWriteSession();
    const canvas = await assertCanvas(session, parsed.data.canvasId);
    if (!canvas) return fail("Mappa non trovata.");

    const results = await Promise.all(
      parsed.data.nodes.map((node) =>
        session.supabase
          .from("canvas_nodes")
          .update({ position_x: node.positionX, position_y: node.positionY })
          .eq("id", node.id)
          .eq("canvas_id", parsed.data.canvasId)
          .eq("workspace_id", session.workspace.id),
      ),
    );

    const failed = results.find((r) => r.error);
    if (failed?.error) return fail(`Posizioni non salvate: ${failed.error.message}`);

    if (parsed.data.viewport) {
      await session.supabase
        .from("canvases")
        .update({ viewport: parsed.data.viewport as unknown as Json })
        .eq("id", parsed.data.canvasId)
        .eq("workspace_id", session.workspace.id);
    }

    return ok();
  });
}

export async function deleteCanvasNodeAction(
  nodeId: string,
): Promise<ActionResult<undefined>> {
  return guard(async () => {
    const parsed = parseInput(uuid, nodeId);
    if (!parsed.ok) return parsed.result;

    const session = await requireWriteSession();
    const { error } = await session.supabase
      .from("canvas_nodes")
      .delete()
      .eq("id", parsed.data)
      .eq("workspace_id", session.workspace.id);

    if (error) return fail(`Nodo non eliminato: ${error.message}`);
    return ok();
  });
}

export async function createCanvasEdgeAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return guard(async () => {
    const parsed = parseInput(canvasEdgeSchema, input);
    if (!parsed.ok) return parsed.result;

    const session = await requireWriteSession();
    const d = parsed.data;
    if (d.sourceNodeId === d.targetNodeId) return fail("Un nodo non può collegarsi a sé stesso.");

    const { data, error } = await session.supabase
      .from("canvas_edges")
      .upsert(
        {
          workspace_id: session.workspace.id,
          canvas_id: d.canvasId,
          source_node_id: d.sourceNodeId,
          target_node_id: d.targetNodeId,
          relation: d.relation ?? "relates_to",
          label: d.label ?? null,
        },
        { onConflict: "canvas_id,source_node_id,target_node_id,relation" },
      )
      .select("id")
      .single();

    if (error || !data) return fail(`Collegamento non creato: ${error?.message}`);
    return ok({ id: data.id });
  });
}

export async function updateCanvasEdgeAction(
  edgeId: string,
  relation: string,
  label: string | null,
): Promise<ActionResult<undefined>> {
  return guard(async () => {
    const parsed = parseInput(uuid, edgeId);
    if (!parsed.ok) return parsed.result;

    const session = await requireWriteSession();
    const { error } = await session.supabase
      .from("canvas_edges")
      .update({ relation: relation as never, label })
      .eq("id", parsed.data)
      .eq("workspace_id", session.workspace.id);

    if (error) return fail(`Collegamento non aggiornato: ${error.message}`);
    return ok();
  });
}

export async function deleteCanvasEdgeAction(
  edgeId: string,
): Promise<ActionResult<undefined>> {
  return guard(async () => {
    const parsed = parseInput(uuid, edgeId);
    if (!parsed.ok) return parsed.result;

    const session = await requireWriteSession();
    const { error } = await session.supabase
      .from("canvas_edges")
      .delete()
      .eq("id", parsed.data)
      .eq("workspace_id", session.workspace.id);

    if (error) return fail(`Collegamento non eliminato: ${error.message}`);
    return ok();
  });
}

/**
 * Turns a free node into a real entity and keeps the link, so the map
 * stops being a drawing and starts being the project.
 */
export async function promoteNodeAction(
  nodeId: string,
  target: "idea" | "task" | "decision" | "risk",
): Promise<ActionResult<{ entityId: string }>> {
  return guard(async () => {
    const parsed = parseInput(uuid, nodeId);
    if (!parsed.ok) return parsed.result;

    const session = await requireWriteSession();
    const { data: node } = await session.supabase
      .from("canvas_nodes")
      .select("id, label, body, canvas_id, entity_type, entity_id")
      .eq("id", parsed.data)
      .eq("workspace_id", session.workspace.id)
      .maybeSingle();

    if (!node) return fail("Nodo non trovato.");
    if (node.entity_type && node.entity_id) {
      return fail("Questo nodo rappresenta già un elemento reale.");
    }

    const label = node.label.trim() || "Senza titolo";
    const { data: canvas } = await session.supabase
      .from("canvases")
      .select("project_id")
      .eq("id", node.canvas_id)
      .maybeSingle();

    const projectId = canvas?.project_id ?? null;
    let entityId: string | null = null;
    let nodeType: CanvasNodeType = "note";

    if (target === "idea") {
      const { data } = await session.supabase
        .from("ideas")
        .insert({
          workspace_id: session.workspace.id,
          created_by: session.userId,
          title: label,
          original_content: node.body ?? label,
          status: "to_explore",
          project_id: projectId,
        })
        .select("id")
        .single();
      entityId = data?.id ?? null;
      nodeType = "idea";
    } else if (target === "task") {
      const { data } = await session.supabase
        .from("tasks")
        .insert({
          workspace_id: session.workspace.id,
          created_by: session.userId,
          project_id: projectId,
          title: label,
          description: node.body ?? null,
          origin_type: "canvas_node",
          origin_id: node.id,
        })
        .select("id")
        .single();
      entityId = data?.id ?? null;
      nodeType = "task";
    } else if (target === "decision") {
      const { data } = await session.supabase
        .from("decisions")
        .insert({
          workspace_id: session.workspace.id,
          created_by: session.userId,
          project_id: projectId,
          title: label,
          context: node.body ?? null,
        })
        .select("id")
        .single();
      entityId = data?.id ?? null;
      nodeType = "decision";
    } else {
      if (!projectId) return fail("I rischi vivono dentro un progetto.");
      const { data } = await session.supabase
        .from("risks")
        .insert({
          workspace_id: session.workspace.id,
          project_id: projectId,
          title: label,
          description: node.body ?? null,
        })
        .select("id")
        .single();
      entityId = data?.id ?? null;
      nodeType = "risk";
    }

    if (!entityId) return fail("Non sono riuscito a creare l'elemento.");

    await session.supabase
      .from("canvas_nodes")
      .update({ entity_type: target, entity_id: entityId, type: nodeType })
      .eq("id", node.id);

    if (projectId) revalidatePath(`/projects/${projectId}`);
    revalidatePath("/ideas");
    return ok({ entityId });
  });
}
