"use server";

import { revalidatePath } from "next/cache";

import { deriveTitle } from "@/lib/utils";
import { defaultScoresForIdea } from "@/lib/domain/scoring";
import {
  entityRelationSchema,
  ideaCreateSchema,
  ideaScoreSchema,
  ideaUpdateSchema,
  uuid,
} from "@/lib/validation/schemas";
import { fail, guard, ok, parseInput, type ActionResult } from "@/server/action-result";
import { logActivity } from "@/server/activity";
import { requireWriteSession } from "@/server/session";
import { attachTags } from "@/server/tags";
import { PLANS } from "@/lib/domain/plans";

export async function createIdeaAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return guard(async () => {
    const parsed = parseInput(ideaCreateSchema, input);
    if (!parsed.ok) return parsed.result;

    const session = await requireWriteSession();
    const limit = PLANS[session.plan].limits.ideas;

    if (limit >= 0) {
      const { count } = await session.supabase
        .from("ideas")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", session.workspace.id)
        .is("deleted_at", null);
      if ((count ?? 0) >= limit) {
        return fail(
          `Il piano ${PLANS[session.plan].name} arriva a ${limit} idee. Archivia quelle chiuse o passa a un piano superiore.`,
        );
      }
    }

    const { title, originalContent, category, status, sourceInboxItemId, projectId } = parsed.data;

    const { data, error } = await session.supabase
      .from("ideas")
      .insert({
        workspace_id: session.workspace.id,
        created_by: session.userId,
        title: title ?? deriveTitle(originalContent),
        original_content: originalContent,
        category: category ?? null,
        status: status ?? "to_explore",
        source_inbox_item_id: sourceInboxItemId ?? null,
        project_id: projectId ?? null,
      })
      .select("id")
      .single();

    if (error || !data) return fail(`Non sono riuscito a creare l'idea: ${error?.message}`);

    if (sourceInboxItemId) {
      await session.supabase
        .from("inbox_items")
        .update({
          status: "processed",
          processed_at: new Date().toISOString(),
          idea_id: data.id,
        })
        .eq("id", sourceInboxItemId)
        .eq("workspace_id", session.workspace.id);
    }

    await logActivity(session.supabase, {
      workspaceId: session.workspace.id,
      actorId: session.userId,
      action: "created",
      entityType: "idea",
      entityId: data.id,
      summary: title ?? deriveTitle(originalContent),
    });

    revalidatePath("/ideas");
    revalidatePath("/inbox");
    revalidatePath("/home");
    return ok({ id: data.id });
  });
}

export async function updateIdeaAction(
  input: unknown,
): Promise<ActionResult<undefined>> {
  return guard(async () => {
    const parsed = parseInput(ideaUpdateSchema, input);
    if (!parsed.ok) return parsed.result;

    const session = await requireWriteSession();
    const { id, ...rest } = parsed.data;

    // original_content is deliberately absent from the schema: the
    // capture is immutable, and the database enforces it too.
    const payload = {
      ...(rest.title !== undefined ? { title: rest.title } : {}),
      ...(rest.summary !== undefined ? { summary: rest.summary } : {}),
      ...(rest.problem !== undefined ? { problem: rest.problem } : {}),
      ...(rest.solution !== undefined ? { solution: rest.solution } : {}),
      ...(rest.audience !== undefined ? { audience: rest.audience } : {}),
      ...(rest.expectedValue !== undefined ? { expected_value: rest.expectedValue } : {}),
      ...(rest.personalMotivation !== undefined
        ? { personal_motivation: rest.personalMotivation }
        : {}),
      ...(rest.category !== undefined ? { category: rest.category } : {}),
      ...(rest.status !== undefined ? { status: rest.status } : {}),
      ...(rest.maturity !== undefined ? { maturity: rest.maturity } : {}),
      ...(rest.isFavorite !== undefined ? { is_favorite: rest.isFavorite } : {}),
    };

    if (Object.keys(payload).length === 0) return ok();

    const { error } = await session.supabase
      .from("ideas")
      .update(payload)
      .eq("id", id)
      .eq("workspace_id", session.workspace.id);

    if (error) return fail(`Aggiornamento non riuscito: ${error.message}`);

    revalidatePath(`/ideas/${id}`);
    revalidatePath("/ideas");
    return ok();
  });
}

export async function setIdeaTagsAction(
  ideaId: string,
  tags: string[],
): Promise<ActionResult<undefined>> {
  return guard(async () => {
    const parsed = parseInput(uuid, ideaId);
    if (!parsed.ok) return parsed.result;

    const session = await requireWriteSession();
    await session.supabase
      .from("entity_tags")
      .delete()
      .eq("entity_type", "idea")
      .eq("entity_id", parsed.data)
      .eq("workspace_id", session.workspace.id);

    await attachTags(session.supabase, session.workspace.id, "idea", parsed.data, tags);

    revalidatePath(`/ideas/${ideaId}`);
    return ok();
  });
}

export async function saveIdeaScoresAction(
  input: unknown,
): Promise<ActionResult<undefined>> {
  return guard(async () => {
    const parsed = parseInput(ideaScoreSchema, input);
    if (!parsed.ok) return parsed.result;

    const session = await requireWriteSession();
    const { ideaId, scores } = parsed.data;

    if (scores.length === 0) {
      await session.supabase
        .from("idea_scores")
        .delete()
        .eq("idea_id", ideaId)
        .eq("workspace_id", session.workspace.id);
      revalidatePath(`/ideas/${ideaId}`);
      return ok();
    }

    const { error } = await session.supabase.from("idea_scores").upsert(
      scores.map((s) => ({
        workspace_id: session.workspace.id,
        idea_id: ideaId,
        criterion: s.criterion,
        value: s.value,
        weight: s.weight,
      })),
      { onConflict: "idea_id,criterion" },
    );

    if (error) return fail(`Valutazione non salvata: ${error.message}`);

    const keep = scores.map((s) => s.criterion);
    await session.supabase
      .from("idea_scores")
      .delete()
      .eq("idea_id", ideaId)
      .eq("workspace_id", session.workspace.id)
      .not("criterion", "in", `(${keep.map((k) => `"${k}"`).join(",")})`);

    revalidatePath(`/ideas/${ideaId}`);
    revalidatePath("/ideas");
    return ok();
  });
}

export async function seedIdeaScoresAction(
  ideaId: string,
): Promise<ActionResult<undefined>> {
  return guard(async () => {
    const parsed = parseInput(uuid, ideaId);
    if (!parsed.ok) return parsed.result;

    const session = await requireWriteSession();
    const { error } = await session.supabase
      .from("idea_scores")
      .upsert(defaultScoresForIdea(parsed.data, session.workspace.id), {
        onConflict: "idea_id,criterion",
        ignoreDuplicates: true,
      });

    if (error) return fail(`Non sono riuscito a preparare i criteri: ${error.message}`);
    revalidatePath(`/ideas/${ideaId}`);
    return ok();
  });
}

export async function archiveIdeaAction(
  ideaId: string,
  restore = false,
): Promise<ActionResult<undefined>> {
  return guard(async () => {
    const parsed = parseInput(uuid, ideaId);
    if (!parsed.ok) return parsed.result;

    const session = await requireWriteSession();
    const { error } = await session.supabase
      .from("ideas")
      .update({ deleted_at: restore ? null : new Date().toISOString() })
      .eq("id", parsed.data)
      .eq("workspace_id", session.workspace.id);

    if (error) return fail(`Operazione non riuscita: ${error.message}`);

    revalidatePath("/ideas");
    revalidatePath("/home");
    return ok();
  });
}

export async function createRelationAction(
  input: unknown,
): Promise<ActionResult<undefined>> {
  return guard(async () => {
    const parsed = parseInput(entityRelationSchema, input);
    if (!parsed.ok) return parsed.result;

    const session = await requireWriteSession();
    const { sourceType, sourceId, targetType, targetId, relation, note } = parsed.data;

    const { error } = await session.supabase.from("entity_relations").upsert(
      {
        workspace_id: session.workspace.id,
        source_type: sourceType,
        source_id: sourceId,
        target_type: targetType,
        target_id: targetId,
        relation,
        note: note ?? null,
        created_by: session.userId,
      },
      { onConflict: "source_type,source_id,target_type,target_id,relation", ignoreDuplicates: true },
    );

    if (error) return fail(`Collegamento non creato: ${error.message}`);

    revalidatePath(`/ideas/${sourceId}`);
    revalidatePath(`/ideas/${targetId}`);
    revalidatePath("/map");
    return ok();
  });
}

export async function deleteRelationAction(
  relationId: string,
): Promise<ActionResult<undefined>> {
  return guard(async () => {
    const parsed = parseInput(uuid, relationId);
    if (!parsed.ok) return parsed.result;

    const session = await requireWriteSession();
    const { error } = await session.supabase
      .from("entity_relations")
      .delete()
      .eq("id", parsed.data)
      .eq("workspace_id", session.workspace.id);

    if (error) return fail(`Collegamento non rimosso: ${error.message}`);
    revalidatePath("/map");
    return ok();
  });
}
