"use server";

import { revalidatePath } from "next/cache";

import { taskCreateSchema, taskUpdateSchema, uuid } from "@/lib/validation/schemas";
import { fail, guard, ok, parseInput, type ActionResult } from "@/server/action-result";
import { logActivity, touchProject } from "@/server/activity";
import { requireWriteSession } from "@/server/session";
import type { Json, TaskStatus } from "@/types/database";

export async function createTaskAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return guard(async () => {
    const parsed = parseInput(taskCreateSchema, input);
    if (!parsed.ok) return parsed.result;

    const session = await requireWriteSession();
    const d = parsed.data;

    const { data, error } = await session.supabase
      .from("tasks")
      .insert({
        workspace_id: session.workspace.id,
        created_by: session.userId,
        project_id: d.projectId ?? null,
        milestone_id: d.milestoneId ?? null,
        title: d.title,
        description: d.description ?? null,
        status: d.status ?? "todo",
        priority: d.priority ?? "medium",
        due_date: d.dueDate ?? null,
        estimate_minutes: d.estimateMinutes ?? null,
        origin_type: d.originType ?? null,
        origin_id: d.originId ?? null,
      })
      .select("id")
      .single();

    if (error || !data) return fail(`Attività non creata: ${error?.message}`);

    if (d.projectId) {
      await touchProject(session.supabase, d.projectId);
      revalidatePath(`/projects/${d.projectId}/tasks`);
    }
    revalidatePath("/tasks");
    revalidatePath("/home");
    return ok({ id: data.id });
  });
}

export async function updateTaskAction(
  input: unknown,
): Promise<ActionResult<undefined>> {
  return guard(async () => {
    const parsed = parseInput(taskUpdateSchema, input);
    if (!parsed.ok) return parsed.result;

    const session = await requireWriteSession();
    const { id, ...rest } = parsed.data;

    const payload = {
      ...(rest.title !== undefined ? { title: rest.title } : {}),
      ...(rest.description !== undefined ? { description: rest.description } : {}),
      ...(rest.status !== undefined ? { status: rest.status } : {}),
      ...(rest.priority !== undefined ? { priority: rest.priority } : {}),
      ...(rest.dueDate !== undefined ? { due_date: rest.dueDate ?? null } : {}),
      ...(rest.estimateMinutes !== undefined
        ? { estimate_minutes: rest.estimateMinutes }
        : {}),
      ...(rest.milestoneId !== undefined ? { milestone_id: rest.milestoneId } : {}),
      ...(rest.projectId !== undefined ? { project_id: rest.projectId } : {}),
      ...(rest.position !== undefined ? { position: rest.position } : {}),
      ...(rest.checklist !== undefined
        ? { checklist: rest.checklist as unknown as Json }
        : {}),
    };

    if (Object.keys(payload).length === 0) return ok();

    const { data, error } = await session.supabase
      .from("tasks")
      .update(payload)
      .eq("id", id)
      .eq("workspace_id", session.workspace.id)
      .select("project_id, title, status")
      .maybeSingle();

    if (error) return fail(`Aggiornamento non riuscito: ${error.message}`);

    if (data?.project_id) {
      await touchProject(session.supabase, data.project_id);
      revalidatePath(`/projects/${data.project_id}/tasks`);
      revalidatePath(`/projects/${data.project_id}`);
    }
    if (rest.status === "done" && data) {
      await logActivity(session.supabase, {
        workspaceId: session.workspace.id,
        actorId: session.userId,
        action: "completed",
        entityType: "task",
        entityId: id,
        summary: data.title,
      });
    }

    revalidatePath("/tasks");
    revalidatePath("/home");
    return ok();
  });
}

export async function setTaskStatusAction(
  id: string,
  status: TaskStatus,
): Promise<ActionResult<undefined>> {
  return updateTaskAction({ id, status });
}

/** Reorders a column after a drag; positions are rewritten in one pass. */
export async function reorderTasksAction(
  updates: Array<{ id: string; status: TaskStatus; position: number }>,
): Promise<ActionResult<undefined>> {
  return guard(async () => {
    const session = await requireWriteSession();
    if (updates.length === 0) return ok();
    if (updates.length > 200) return fail("Troppe attività in un'unica operazione.");

    for (const update of updates) {
      if (!/^[0-9a-f-]{36}$/i.test(update.id)) return fail("Identificativo non valido.");
    }

    const results = await Promise.all(
      updates.map((u) =>
        session.supabase
          .from("tasks")
          .update({ status: u.status, position: u.position })
          .eq("id", u.id)
          .eq("workspace_id", session.workspace.id),
      ),
    );

    const failed = results.find((r) => r.error);
    if (failed?.error) return fail(`Riordino non riuscito: ${failed.error.message}`);

    revalidatePath("/tasks");
    return ok();
  });
}

export async function deleteTaskAction(
  id: string,
  restore = false,
): Promise<ActionResult<undefined>> {
  return guard(async () => {
    const parsed = parseInput(uuid, id);
    if (!parsed.ok) return parsed.result;

    const session = await requireWriteSession();
    const { data, error } = await session.supabase
      .from("tasks")
      .update({ deleted_at: restore ? null : new Date().toISOString() })
      .eq("id", parsed.data)
      .eq("workspace_id", session.workspace.id)
      .select("project_id")
      .maybeSingle();

    if (error) return fail(`Operazione non riuscita: ${error.message}`);
    if (data?.project_id) revalidatePath(`/projects/${data.project_id}/tasks`);
    revalidatePath("/tasks");
    return ok();
  });
}
