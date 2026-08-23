"use server";

import { revalidatePath } from "next/cache";

import { deriveTitle } from "@/lib/utils";
import {
  inboxUpdateSchema,
  quickCaptureSchema,
  uuid,
} from "@/lib/validation/schemas";
import { fail, guard, ok, parseInput, type ActionResult } from "@/server/action-result";
import { logActivity } from "@/server/activity";
import { attachTags } from "@/server/tags";
import { requireWriteSession } from "@/server/session";

/**
 * Capture is the fastest path in the product: one field, no required
 * metadata, immediate persistence. Everything else (title, category,
 * structure) is derived later and always reversible.
 */
export async function captureAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return guard(async () => {
    const parsed = parseInput(quickCaptureSchema, input);
    if (!parsed.ok) return parsed.result;

    const session = await requireWriteSession();
    const { content, url, projectId, tags } = parsed.data;

    const { data, error } = await session.supabase
      .from("inbox_items")
      .insert({
        workspace_id: session.workspace.id,
        created_by: session.userId,
        kind: url ? "url" : "text",
        content,
        url: url ?? null,
        project_id: projectId ?? null,
      })
      .select("id")
      .single();

    if (error || !data) return fail(`Non sono riuscito a salvare: ${error?.message}`);

    if (tags && tags.length > 0) {
      await attachTags(session.supabase, session.workspace.id, "inbox_item", data.id, tags);
    }

    await logActivity(session.supabase, {
      workspaceId: session.workspace.id,
      actorId: session.userId,
      action: "captured",
      entityType: "inbox_item",
      entityId: data.id,
      summary: deriveTitle(content),
    });

    revalidatePath("/inbox");
    revalidatePath("/home");
    return ok({ id: data.id });
  });
}

export async function updateInboxItemAction(
  input: unknown,
): Promise<ActionResult<undefined>> {
  return guard(async () => {
    const parsed = parseInput(inboxUpdateSchema, input);
    if (!parsed.ok) return parsed.result;

    const session = await requireWriteSession();
    const { id, content, status, projectId } = parsed.data;

    const { error } = await session.supabase
      .from("inbox_items")
      .update({
        ...(content !== undefined ? { content } : {}),
        ...(status !== undefined
          ? { status, processed_at: status === "processed" ? new Date().toISOString() : null }
          : {}),
        ...(projectId !== undefined ? { project_id: projectId } : {}),
      })
      .eq("id", id)
      .eq("workspace_id", session.workspace.id);

    if (error) return fail(`Aggiornamento non riuscito: ${error.message}`);

    revalidatePath("/inbox");
    return ok();
  });
}

/** Soft delete, so the toast can offer a real undo. */
export async function archiveInboxItemAction(
  id: string,
  restore = false,
): Promise<ActionResult<undefined>> {
  return guard(async () => {
    const parsed = parseInput(uuid, id);
    if (!parsed.ok) return parsed.result;

    const session = await requireWriteSession();
    const { error } = await session.supabase
      .from("inbox_items")
      .update({ deleted_at: restore ? null : new Date().toISOString() })
      .eq("id", parsed.data)
      .eq("workspace_id", session.workspace.id);

    if (error) return fail(`Operazione non riuscita: ${error.message}`);

    revalidatePath("/inbox");
    revalidatePath("/home");
    return ok();
  });
}

export async function setInboxStatusAction(
  id: string,
  status: "unprocessed" | "processed" | "archived",
): Promise<ActionResult<undefined>> {
  return updateInboxItemAction({ id, status });
}
