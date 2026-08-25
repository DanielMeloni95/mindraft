"use server";

import { revalidatePath } from "next/cache";

import { PLANS } from "@/lib/domain/plans";
import {
  projectCreateSchema,
  projectUpdateSchema,
  uuid,
} from "@/lib/validation/schemas";
import { fail, guard, ok, parseInput, type ActionResult } from "@/server/action-result";
import { logActivity, touchProject } from "@/server/activity";
import { provisionProject } from "@/server/provision";
import { requireWriteSession } from "@/server/session";

export async function createProjectAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return guard(async () => {
    const parsed = parseInput(projectCreateSchema, input);
    if (!parsed.ok) return parsed.result;

    const session = await requireWriteSession();
    const limit = PLANS[session.plan].limits.projects;

    if (limit >= 0) {
      const { count } = await session.supabase
        .from("projects")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", session.workspace.id)
        .is("deleted_at", null)
        .neq("status", "archived");

      if ((count ?? 0) >= limit) {
        return fail(
          `Il piano ${PLANS[session.plan].name} include ${limit} progetti attivi. Archiviane uno o passa a un piano superiore.`,
        );
      }
    }

    const { projectId } = await provisionProject(session, {
      name: parsed.data.name,
      shortDescription: parsed.data.shortDescription ?? null,
      emoji: parsed.data.emoji ?? null,
      color: parsed.data.color ?? null,
      sourceIdeaId: parsed.data.sourceIdeaId ?? null,
      status: parsed.data.status,
    });

    await logActivity(session.supabase, {
      workspaceId: session.workspace.id,
      actorId: session.userId,
      action: "created",
      entityType: "project",
      entityId: projectId,
      summary: parsed.data.name,
    });

    revalidatePath("/projects");
    revalidatePath("/home");
    return ok({ id: projectId });
  });
}

export async function updateProjectAction(
  input: unknown,
): Promise<ActionResult<undefined>> {
  return guard(async () => {
    const parsed = parseInput(projectUpdateSchema, input);
    if (!parsed.ok) return parsed.result;

    const session = await requireWriteSession();
    const { id, ...rest } = parsed.data;

    const payload = {
      last_activity_at: new Date().toISOString(),
      ...(rest.name !== undefined ? { name: rest.name } : {}),
      ...(rest.emoji !== undefined ? { emoji: rest.emoji } : {}),
      ...(rest.color !== undefined ? { color: rest.color } : {}),
      ...(rest.shortDescription !== undefined
        ? { short_description: rest.shortDescription }
        : {}),
      ...(rest.vision !== undefined ? { vision: rest.vision } : {}),
      ...(rest.problem !== undefined ? { problem: rest.problem } : {}),
      ...(rest.solution !== undefined ? { solution: rest.solution } : {}),
      ...(rest.audience !== undefined ? { audience: rest.audience } : {}),
      ...(rest.valueProposition !== undefined
        ? { value_proposition: rest.valueProposition }
        : {}),
      ...(rest.websiteUrl !== undefined ? { website_url: rest.websiteUrl } : {}),
      ...(rest.domain !== undefined ? { domain: rest.domain } : {}),
      ...(rest.scopeIn !== undefined ? { scope_in: rest.scopeIn } : {}),
      ...(rest.scopeOut !== undefined ? { scope_out: rest.scopeOut } : {}),
      ...(rest.status !== undefined ? { status: rest.status } : {}),
      ...(rest.health !== undefined ? { health: rest.health } : {}),
      ...(rest.progress !== undefined ? { progress: rest.progress } : {}),
      ...(rest.nextStep !== undefined ? { next_step: rest.nextStep } : {}),
      ...(rest.costEstimate !== undefined ? { cost_estimate: rest.costEstimate } : {}),
      ...(rest.stack !== undefined ? { stack: rest.stack } : {}),
      ...(rest.isFavorite !== undefined ? { is_favorite: rest.isFavorite } : {}),
    };

    const { error } = await session.supabase
      .from("projects")
      .update(payload)
      .eq("id", id)
      .eq("workspace_id", session.workspace.id);

    if (error) return fail(`Aggiornamento non riuscito: ${error.message}`);

    revalidatePath(`/projects/${id}`);
    revalidatePath("/projects");
    revalidatePath("/home");
    return ok();
  });
}

export async function updateProjectSectionAction(
  sectionId: string,
  content: string,
): Promise<ActionResult<undefined>> {
  return guard(async () => {
    const parsed = parseInput(uuid, sectionId);
    if (!parsed.ok) return parsed.result;

    const session = await requireWriteSession();
    const { data, error } = await session.supabase
      .from("project_sections")
      .update({ content: content.slice(0, 8000), origin: "user", approved_at: new Date().toISOString() })
      .eq("id", parsed.data)
      .eq("workspace_id", session.workspace.id)
      .select("project_id")
      .maybeSingle();

    if (error) return fail(`Sezione non salvata: ${error.message}`);
    if (data) {
      await touchProject(session.supabase, data.project_id);
      revalidatePath(`/projects/${data.project_id}`);
    }
    return ok();
  });
}

export async function archiveProjectAction(
  projectId: string,
  restore = false,
): Promise<ActionResult<undefined>> {
  return guard(async () => {
    const parsed = parseInput(uuid, projectId);
    if (!parsed.ok) return parsed.result;

    const session = await requireWriteSession();
    const { error } = await session.supabase
      .from("projects")
      .update({ deleted_at: restore ? null : new Date().toISOString() })
      .eq("id", parsed.data)
      .eq("workspace_id", session.workspace.id);

    if (error) return fail(`Operazione non riuscita: ${error.message}`);

    revalidatePath("/projects");
    revalidatePath("/home");
    return ok();
  });
}
