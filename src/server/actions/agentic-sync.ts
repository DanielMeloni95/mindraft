"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { buildAgenticMergePlan, type AgenticMergePlan, type CurrentAgenticEntity, type MergeOperation, type SyncEntityType } from "@/lib/domain/agentic-sync";
import { docToPlainText, textToDoc } from "@/lib/domain/tiptap";
import { fail, guard, ok, parseInput, type ActionResult } from "@/server/action-result";
import { requireWriteSession } from "@/server/session";
import type { Json } from "@/types/database";

const previewSchema = z.object({ documentId: z.string().uuid(), markdown: z.string().min(1).max(2_000_000) });
const applySchema = z.object({ importId: z.string().uuid(), acceptedKeys: z.array(z.string()).max(1000) });
const TABLES: Record<SyncEntityType, string> = { goal: "goals", milestone: "milestones", task: "tasks", decision: "decisions", risk: "risks", resource: "resources", canvas_node: "canvas_nodes" };

async function currentEntities(session: Awaited<ReturnType<typeof requireWriteSession>>, projectId: string): Promise<CurrentAgenticEntity[]> {
  const { data: canvas } = await session.supabase.from("canvases").select("id").eq("project_id", projectId).is("deleted_at", null).maybeSingle();
  const [goals, milestones, tasks, decisions, risks, resources, nodes] = await Promise.all([
    session.supabase.from("goals").select("id,title,description,is_achieved,revision,deleted_at").eq("project_id", projectId),
    session.supabase.from("milestones").select("id,title,description,status,revision,deleted_at").eq("project_id", projectId),
    session.supabase.from("tasks").select("id,title,description,status,priority,revision,deleted_at").eq("project_id", projectId),
    session.supabase.from("decisions").select("id,title,context,status,revision,deleted_at").eq("project_id", projectId),
    session.supabase.from("risks").select("id,title,description,is_open,revision,deleted_at").eq("project_id", projectId),
    session.supabase.from("resources").select("id,title,notes,kind,revision,deleted_at").eq("project_id", projectId),
    canvas ? session.supabase.from("canvas_nodes").select("id,label,body,type,revision").eq("canvas_id", canvas.id) : Promise.resolve({ data: [] }),
  ]);
  return [
    ...(goals.data ?? []).map((r) => ({ id:r.id, entity_type:"goal" as const, revision:r.revision, title:r.title, description:r.description ?? undefined, status:r.is_achieved?"achieved":"open", archived:Boolean(r.deleted_at) })),
    ...(milestones.data ?? []).map((r) => ({ id:r.id, entity_type:"milestone" as const, revision:r.revision, title:r.title, description:r.description ?? undefined, status:r.status, archived:Boolean(r.deleted_at) })),
    ...(tasks.data ?? []).map((r) => ({ id:r.id, entity_type:"task" as const, revision:r.revision, title:r.title, description:r.description ?? undefined, status:r.status, priority:r.priority, archived:Boolean(r.deleted_at) })),
    ...(decisions.data ?? []).map((r) => ({ id:r.id, entity_type:"decision" as const, revision:r.revision, title:r.title, description:r.context ?? undefined, status:r.status, archived:Boolean(r.deleted_at) })),
    ...(risks.data ?? []).map((r) => ({ id:r.id, entity_type:"risk" as const, revision:r.revision, title:r.title, description:r.description ?? undefined, status:r.is_open?"open":"closed", archived:Boolean(r.deleted_at) })),
    ...(resources.data ?? []).map((r) => ({ id:r.id, entity_type:"resource" as const, revision:r.revision, title:r.title, description:r.notes ?? undefined, status:r.kind, archived:Boolean(r.deleted_at) })),
    ...(nodes.data ?? []).map((r) => ({ id:r.id, entity_type:"canvas_node" as const, revision:r.revision, title:r.label, description:r.body ?? undefined, status:r.type })),
  ];
}

export async function previewAgenticImportAction(input: unknown): Promise<ActionResult<{ importId: string; plan: AgenticMergePlan }>> {
  return guard(async () => {
    const parsed = parseInput(previewSchema, input); if (!parsed.ok) return parsed.result;
    const session = await requireWriteSession();
    const { data: document } = await session.supabase.from("documents").select("id,project_id,kind,revision")
      .eq("id", parsed.data.documentId).eq("workspace_id", session.workspace.id).maybeSingle();
    if (!document?.project_id || document.kind !== "agentic") return fail("Documento agentico non trovato.");
    const { data: imported } = await session.supabase.from("agentic_imports").select("content_hash").eq("document_id", document.id).eq("status", "applied");
    const plan = buildAgenticMergePlan(parsed.data.markdown, document.project_id, await currentEntities(session, document.project_id), new Set((imported ?? []).map((r) => r.content_hash)), document.revision);
    if (!plan.header) return fail(plan.errors.join(" ") || "Metadata gestiti mancanti.");
    const idempotencyKey = `${document.id}:${plan.header.document_revision}:${plan.sourceHash}`;
    const { data: row, error } = await session.supabase.from("agentic_imports").upsert({
      workspace_id: session.workspace.id, project_id: document.project_id, document_id: document.id,
      created_by: session.userId, schema_version: plan.header.schema_version,
      source_revision: plan.header.document_revision, content_hash: plan.sourceHash, idempotency_key: idempotencyKey,
      status: plan.operations.some((op) => op.outcome === "conflict") ? "conflict" : "proposed",
      merge_plan: plan as unknown as Json,
      source_content: parsed.data.markdown,
    }, { onConflict: "workspace_id,idempotency_key" }).select("id").single();
    if (error || !row) return fail(`Anteprima non registrata: ${error?.message ?? "errore sconosciuto"}`);
    return ok({ importId: row.id, plan });
  });
}

function patchFor(operation: MergeOperation): Record<string, unknown> {
  const item = operation.imported!;
  if (item.entity_type === "canvas_node") return { label:item.title, body:item.description ?? null };
  if (item.entity_type === "decision") return { title:item.title, context:item.description ?? null, ...(item.status ? { status:item.status } : {}) };
  if (item.entity_type === "resource") return { title:item.title, notes:item.description ?? null };
  if (item.entity_type === "risk") return { title:item.title, description:item.description ?? null, ...(item.status ? { is_open:item.status !== "closed" } : {}) };
  if (item.entity_type === "goal") return { title:item.title, description:item.description ?? null, ...(item.status ? { is_achieved:item.status === "achieved" } : {}) };
  return { title:item.title, description:item.description ?? null, ...(item.status ? { status:item.status } : {}), ...(item.entity_type === "task" && item.priority ? { priority:item.priority } : {}) };
}

export async function applyAgenticImportAction(input: unknown): Promise<ActionResult<{ applied: number }>> {
  return guard(async () => {
    const parsed = parseInput(applySchema, input); if (!parsed.ok) return parsed.result;
    const session = await requireWriteSession();
    const { data: stored } = await session.supabase.from("agentic_imports").select("*").eq("id", parsed.data.importId).eq("workspace_id", session.workspace.id).maybeSingle();
    if (!stored || !["proposed","conflict"].includes(stored.status)) return fail("Piano di importazione non disponibile.");
    const plan = stored.merge_plan as unknown as AgenticMergePlan;
    const accepted = new Set(parsed.data.acceptedKeys);
    const candidates = plan.operations.filter((op) => accepted.has(op.key) && ["create","update","archive"].includes(op.outcome));
    const fresh = await currentEntities(session, stored.project_id);
    const freshById = new Map(fresh.map((entity) => [entity.id, entity]));
    for (const op of candidates) {
      if (op.imported?.id && op.current && freshById.get(op.imported.id)?.revision !== op.current.revision) return fail(`Conflitto sopraggiunto su “${op.imported.title}”. Riapri l'anteprima.`);
    }
    const undo: Array<{ table:string; id:string; before:CurrentAgenticEntity|null }> = [];
    try {
      for (const op of candidates) {
        const item = op.imported!; const table = TABLES[item.entity_type];
        if (op.outcome === "create") {
          const base: Record<string, unknown> = { workspace_id:session.workspace.id, project_id:stored.project_id, ...patchFor(op) };
          if (item.entity_type === "task" || item.entity_type === "decision") base.created_by = session.userId;
          if (item.entity_type === "milestone") { base.status = item.status ?? "planned"; base.is_estimate = true; }
          if (item.entity_type === "task") { base.status = item.status ?? "todo"; base.priority = item.priority ?? "medium"; }
          if (item.entity_type === "decision") base.status = item.status ?? "proposed";
          if (item.entity_type === "resource") base.kind = "note";
          if (item.entity_type === "canvas_node") {
            const { data: canvas } = await session.supabase.from("canvases").select("id").eq("project_id", stored.project_id).maybeSingle();
            if (!canvas) throw new Error("Canvas non trovato.");
            delete base.project_id; base.canvas_id=canvas.id; base.type="text"; base.position_x=0; base.position_y=0; base.data={origin:"agentic_import"};
          }
          const { data, error } = await session.supabase.from(table as "tasks").insert(base as never).select("id").single();
          if (error || !data) throw new Error(error?.message ?? "Creazione fallita"); undo.push({table,id:data.id,before:null});
        } else {
          const id = item.id!; undo.push({table,id,before:freshById.get(id) ?? null});
          const payload = op.outcome === "archive" ? { deleted_at:new Date().toISOString() } : patchFor(op);
          const { error } = await session.supabase.from(table as "tasks").update(payload as never).eq("id", id).eq("workspace_id", session.workspace.id);
          if (error) throw new Error(error.message);
        }
      }
    } catch (error) {
      for (const entry of [...undo].reverse()) {
        if (!entry.before) await session.supabase.from(entry.table as "tasks").delete().eq("id", entry.id);
        else await session.supabase.from(entry.table as "tasks").update({ ...patchFor({ imported:entry.before, current:null, key:entry.id, outcome:"update", reason:"rollback" }), deleted_at:entry.before.archived ? new Date().toISOString() : null } as never).eq("id", entry.id);
      }
      await session.supabase.from("agentic_imports").update({ status:"failed", error_message:error instanceof Error?error.message:"Errore", undo_payload:undo as unknown as Json }).eq("id", stored.id);
      return fail("Importazione annullata: nessuna modifica parziale è stata conservata.");
    }
    await session.supabase.from("agentic_imports").update({ status:"applied", accepted_keys:[...accepted], undo_payload:undo as unknown as Json, applied_at:new Date().toISOString() }).eq("id", stored.id);
    const narrative = stored.source_content.split("<!-- mindraft:managed:start")[0].trim();
    if (narrative) {
      const content = textToDoc(narrative);
      await session.supabase.rpc("snapshot_document", { p_document_id:stored.document_id, p_label:"Prima dell'import agentico v1.1" });
      await session.supabase.from("documents").update({ content:content as unknown as Json, plain_text:docToPlainText(content) }).eq("id", stored.document_id).eq("workspace_id", session.workspace.id);
    }
    revalidatePath(`/projects/${stored.project_id}`); revalidatePath(`/projects/${stored.project_id}/agentic-document`);
    revalidatePath(`/projects/${stored.project_id}/tasks`); revalidatePath(`/projects/${stored.project_id}/canvas`);
    return ok({ applied:candidates.length });
  });
}

export async function rollbackAgenticImportAction(importId: string): Promise<ActionResult<{ restored: number }>> {
  return guard(async () => {
    const parsed = parseInput(z.string().uuid(), importId); if (!parsed.ok) return parsed.result;
    const session = await requireWriteSession();
    const { data: stored } = await session.supabase.from("agentic_imports").select("id,project_id,status,undo_payload")
      .eq("id", parsed.data).eq("workspace_id", session.workspace.id).maybeSingle();
    if (!stored || stored.status !== "applied" || !Array.isArray(stored.undo_payload)) return fail("Importazione non annullabile.");
    const entries = stored.undo_payload as unknown as Array<{ table:string; id:string; before:CurrentAgenticEntity|null }>;
    for (const entry of [...entries].reverse()) {
      const query = !entry.before
        ? session.supabase.from(entry.table as "tasks").delete().eq("id",entry.id).eq("workspace_id",session.workspace.id)
        : session.supabase.from(entry.table as "tasks").update({ ...patchFor({ imported:entry.before,current:null,key:entry.id,outcome:"update",reason:"rollback" }), deleted_at:entry.before.archived?new Date().toISOString():null } as never).eq("id",entry.id).eq("workspace_id",session.workspace.id);
      const { error } = await query; if (error) return fail(`Rollback incompleto: ${error.message}`);
    }
    await session.supabase.from("agentic_imports").update({ status:"rolled_back" }).eq("id",stored.id);
    revalidatePath(`/projects/${stored.project_id}`); revalidatePath(`/projects/${stored.project_id}/agentic-document`);
    return ok({ restored:entries.length });
  });
}
