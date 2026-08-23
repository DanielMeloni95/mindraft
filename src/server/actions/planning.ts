"use server";

import { revalidatePath } from "next/cache";

import {
  decisionSchema,
  goalSchema,
  milestoneSchema,
  resourceSchema,
  riskSchema,
  uuid,
} from "@/lib/validation/schemas";
import { fail, guard, ok, parseInput, type ActionResult } from "@/server/action-result";
import { logActivity, touchProject } from "@/server/activity";
import { requireWriteSession } from "@/server/session";

/* --------------------------------------------------------- milestones */

export async function saveMilestoneAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return guard(async () => {
    const parsed = parseInput(milestoneSchema, input);
    if (!parsed.ok) return parsed.result;

    const session = await requireWriteSession();
    const d = parsed.data;

    if (d.startsOn && d.endsOn && d.endsOn < d.startsOn) {
      return fail("La data di fine non può precedere quella di inizio.", {
        endsOn: ["Deve essere successiva alla data di inizio"],
      });
    }

    const payload = {
      workspace_id: session.workspace.id,
      project_id: d.projectId,
      title: d.title,
      description: d.description ?? null,
      phase: d.phase ?? null,
      version_label: d.versionLabel ?? null,
      status: d.status ?? "planned",
      starts_on: d.startsOn ?? null,
      ends_on: d.endsOn ?? null,
      progress: d.progress ?? 0,
      is_estimate: d.isEstimate ?? true,
    };

    const query = d.id
      ? session.supabase.from("milestones").update(payload).eq("id", d.id).eq("workspace_id", session.workspace.id).select("id").single()
      : session.supabase.from("milestones").insert(payload).select("id").single();

    const { data, error } = await query;
    if (error || !data) return fail(`Milestone non salvata: ${error?.message}`);

    await touchProject(session.supabase, d.projectId);
    revalidatePath(`/projects/${d.projectId}/roadmap`);
    revalidatePath(`/projects/${d.projectId}`);
    return ok({ id: data.id });
  });
}

export async function moveMilestoneAction(
  id: string,
  startsOn: string | null,
  endsOn: string | null,
): Promise<ActionResult<undefined>> {
  return guard(async () => {
    const parsed = parseInput(uuid, id);
    if (!parsed.ok) return parsed.result;
    if (startsOn && endsOn && endsOn < startsOn) return fail("Intervallo non valido.");

    const session = await requireWriteSession();
    const { data, error } = await session.supabase
      .from("milestones")
      .update({ starts_on: startsOn, ends_on: endsOn })
      .eq("id", parsed.data)
      .eq("workspace_id", session.workspace.id)
      .select("project_id")
      .maybeSingle();

    if (error) return fail(`Spostamento non riuscito: ${error.message}`);
    if (data) revalidatePath(`/projects/${data.project_id}/roadmap`);
    return ok();
  });
}

export async function deleteMilestoneAction(id: string): Promise<ActionResult<undefined>> {
  return guard(async () => {
    const parsed = parseInput(uuid, id);
    if (!parsed.ok) return parsed.result;

    const session = await requireWriteSession();
    const { data, error } = await session.supabase
      .from("milestones")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", parsed.data)
      .eq("workspace_id", session.workspace.id)
      .select("project_id")
      .maybeSingle();

    if (error) return fail(`Eliminazione non riuscita: ${error.message}`);
    if (data) revalidatePath(`/projects/${data.project_id}/roadmap`);
    return ok();
  });
}

/* ---------------------------------------------------------- decisions */

export async function saveDecisionAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return guard(async () => {
    const parsed = parseInput(decisionSchema, input);
    if (!parsed.ok) return parsed.result;

    const session = await requireWriteSession();
    const d = parsed.data;

    const payload = {
      workspace_id: session.workspace.id,
      created_by: session.userId,
      project_id: d.projectId ?? null,
      title: d.title,
      context: d.context ?? null,
      alternatives: d.alternatives ?? null,
      rationale: d.rationale ?? null,
      consequences: d.consequences ?? null,
      status: d.status ?? "proposed",
      decided_on: d.decidedOn ?? null,
    };

    const { data, error } = d.id
      ? await session.supabase
          .from("decisions")
          .update(payload)
          .eq("id", d.id)
          .eq("workspace_id", session.workspace.id)
          .select("id")
          .single()
      : await session.supabase.from("decisions").insert(payload).select("id").single();

    if (error || !data) return fail(`Decisione non salvata: ${error?.message}`);

    await logActivity(session.supabase, {
      workspaceId: session.workspace.id,
      actorId: session.userId,
      action: d.id ? "updated" : "decided",
      entityType: "decision",
      entityId: data.id,
      summary: d.title,
    });

    if (d.projectId) {
      await touchProject(session.supabase, d.projectId);
      revalidatePath(`/projects/${d.projectId}/decisions`);
      revalidatePath(`/projects/${d.projectId}`);
    }
    revalidatePath("/home");
    return ok({ id: data.id });
  });
}

export async function deleteDecisionAction(id: string): Promise<ActionResult<undefined>> {
  return guard(async () => {
    const parsed = parseInput(uuid, id);
    if (!parsed.ok) return parsed.result;

    const session = await requireWriteSession();
    const { data, error } = await session.supabase
      .from("decisions")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", parsed.data)
      .eq("workspace_id", session.workspace.id)
      .select("project_id")
      .maybeSingle();

    if (error) return fail(`Eliminazione non riuscita: ${error.message}`);
    if (data?.project_id) revalidatePath(`/projects/${data.project_id}/decisions`);
    return ok();
  });
}

/* -------------------------------------------------------------- risks */

export async function saveRiskAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return guard(async () => {
    const parsed = parseInput(riskSchema, input);
    if (!parsed.ok) return parsed.result;

    const session = await requireWriteSession();
    const d = parsed.data;

    const payload = {
      workspace_id: session.workspace.id,
      project_id: d.projectId,
      title: d.title,
      description: d.description ?? null,
      likelihood: d.likelihood ?? "medium",
      impact: d.impact ?? "medium",
      mitigation: d.mitigation ?? null,
      is_open: d.isOpen ?? true,
    };

    const { data, error } = d.id
      ? await session.supabase
          .from("risks")
          .update(payload)
          .eq("id", d.id)
          .eq("workspace_id", session.workspace.id)
          .select("id")
          .single()
      : await session.supabase.from("risks").insert(payload).select("id").single();

    if (error || !data) return fail(`Rischio non salvato: ${error?.message}`);

    revalidatePath(`/projects/${d.projectId}`);
    return ok({ id: data.id });
  });
}

export async function deleteRiskAction(id: string): Promise<ActionResult<undefined>> {
  return guard(async () => {
    const parsed = parseInput(uuid, id);
    if (!parsed.ok) return parsed.result;

    const session = await requireWriteSession();
    const { data, error } = await session.supabase
      .from("risks")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", parsed.data)
      .eq("workspace_id", session.workspace.id)
      .select("project_id")
      .maybeSingle();

    if (error) return fail(`Eliminazione non riuscita: ${error.message}`);
    if (data?.project_id) revalidatePath(`/projects/${data.project_id}`);
    return ok();
  });
}

/* -------------------------------------------------------------- goals */

export async function saveGoalAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return guard(async () => {
    const parsed = parseInput(goalSchema, input);
    if (!parsed.ok) return parsed.result;

    const session = await requireWriteSession();
    const d = parsed.data;

    const payload = {
      workspace_id: session.workspace.id,
      project_id: d.projectId,
      title: d.title,
      metric: d.metric ?? null,
      target_value: d.targetValue ?? null,
      current_value: d.currentValue ?? null,
      due_date: d.dueDate ?? null,
      is_achieved: d.isAchieved ?? false,
    };

    const { data, error } = d.id
      ? await session.supabase
          .from("goals")
          .update(payload)
          .eq("id", d.id)
          .eq("workspace_id", session.workspace.id)
          .select("id")
          .single()
      : await session.supabase.from("goals").insert(payload).select("id").single();

    if (error || !data) return fail(`Obiettivo non salvato: ${error?.message}`);

    revalidatePath(`/projects/${d.projectId}`);
    return ok({ id: data.id });
  });
}

export async function deleteGoalAction(id: string): Promise<ActionResult<undefined>> {
  return guard(async () => {
    const parsed = parseInput(uuid, id);
    if (!parsed.ok) return parsed.result;

    const session = await requireWriteSession();
    const { data, error } = await session.supabase
      .from("goals")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", parsed.data)
      .eq("workspace_id", session.workspace.id)
      .select("project_id")
      .maybeSingle();

    if (error) return fail(`Eliminazione non riuscita: ${error.message}`);
    if (data?.project_id) revalidatePath(`/projects/${data.project_id}`);
    return ok();
  });
}

/* ---------------------------------------------------------- resources */

export async function saveResourceAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return guard(async () => {
    const parsed = parseInput(resourceSchema, input);
    if (!parsed.ok) return parsed.result;

    const session = await requireWriteSession();
    const d = parsed.data;

    const payload = {
      workspace_id: session.workspace.id,
      project_id: d.projectId ?? null,
      idea_id: d.ideaId ?? null,
      title: d.title,
      url: d.url ?? null,
      kind: d.kind ?? "link",
      notes: d.notes ?? null,
    };

    const { data, error } = d.id
      ? await session.supabase
          .from("resources")
          .update(payload)
          .eq("id", d.id)
          .eq("workspace_id", session.workspace.id)
          .select("id")
          .single()
      : await session.supabase.from("resources").insert(payload).select("id").single();

    if (error || !data) return fail(`Risorsa non salvata: ${error?.message}`);

    if (d.projectId) revalidatePath(`/projects/${d.projectId}/resources`);
    if (d.ideaId) revalidatePath(`/ideas/${d.ideaId}`);
    return ok({ id: data.id });
  });
}

export async function deleteResourceAction(id: string): Promise<ActionResult<undefined>> {
  return guard(async () => {
    const parsed = parseInput(uuid, id);
    if (!parsed.ok) return parsed.result;

    const session = await requireWriteSession();
    const { data, error } = await session.supabase
      .from("resources")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", parsed.data)
      .eq("workspace_id", session.workspace.id)
      .select("project_id, idea_id")
      .maybeSingle();

    if (error) return fail(`Eliminazione non riuscita: ${error.message}`);
    if (data?.project_id) revalidatePath(`/projects/${data.project_id}/resources`);
    if (data?.idea_id) revalidatePath(`/ideas/${data.idea_id}`);
    return ok();
  });
}
