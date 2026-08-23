"use server";

import { revalidatePath } from "next/cache";

import { docToPlainText, isTipTapDoc } from "@/lib/domain/tiptap";
import { documentSaveSchema, uuid } from "@/lib/validation/schemas";
import { fail, guard, ok, parseInput, type ActionResult } from "@/server/action-result";
import { touchProject } from "@/server/activity";
import { requireWriteSession } from "@/server/session";
import type { Json } from "@/types/database";

export type SaveDocumentResult = {
  revision: number;
  savedAt: string;
  /** True when a version snapshot was written by this save. */
  snapshotted: boolean;
};

/**
 * Autosave endpoint.
 *
 * Two things make this safe to call every couple of seconds:
 * 1. the document row is updated in place (one UPDATE, no version row);
 * 2. snapshots are taken by snapshot_document(), which refuses to write
 *    unless the content actually changed and enough time has passed.
 *
 * baseRevision gives optimistic concurrency: if the same document was
 * saved elsewhere meanwhile, the caller is told instead of silently
 * winning the race.
 */
export async function saveDocumentAction(
  input: unknown,
): Promise<ActionResult<SaveDocumentResult>> {
  return guard(async () => {
    const parsed = parseInput(documentSaveSchema, input);
    if (!parsed.ok) return parsed.result;

    const session = await requireWriteSession();
    const { documentId, content, baseRevision, snapshotLabel } = parsed.data;

    if (!isTipTapDoc(content)) {
      return fail("Contenuto del documento non valido.");
    }

    const { data: current, error: readError } = await session.supabase
      .from("documents")
      .select("id, revision, project_id")
      .eq("id", documentId)
      .eq("workspace_id", session.workspace.id)
      .is("deleted_at", null)
      .maybeSingle();

    if (readError) return fail(`Documento non leggibile: ${readError.message}`);
    if (!current) return fail("Documento non trovato o non accessibile.");

    if (baseRevision !== undefined && baseRevision !== current.revision) {
      return fail(
        "Il documento è stato modificato altrove. Ricarica la pagina per non perdere l'altra versione.",
      );
    }

    const plainText = docToPlainText(content as Json);

    const { error } = await session.supabase
      .from("documents")
      .update({ content: content as Json, plain_text: plainText })
      .eq("id", documentId)
      .eq("workspace_id", session.workspace.id);

    if (error) return fail(`Salvataggio non riuscito: ${error.message}`);

    const { data: versionId } = await session.supabase.rpc("snapshot_document", {
      p_document_id: documentId,
      p_label: snapshotLabel ?? null,
    });

    if (current.project_id) {
      await touchProject(session.supabase, current.project_id);
    }

    const { data: after } = await session.supabase
      .from("documents")
      .select("revision, updated_at")
      .eq("id", documentId)
      .maybeSingle();

    return ok({
      revision: after?.revision ?? current.revision,
      savedAt: after?.updated_at ?? new Date().toISOString(),
      snapshotted: Boolean(versionId),
    });
  });
}

export async function snapshotDocumentAction(
  documentId: string,
  label: string,
): Promise<ActionResult<{ created: boolean }>> {
  return guard(async () => {
    const parsed = parseInput(uuid, documentId);
    if (!parsed.ok) return parsed.result;

    const session = await requireWriteSession();
    const { data, error } = await session.supabase.rpc("snapshot_document", {
      p_document_id: parsed.data,
      p_label: label.slice(0, 80) || "Versione manuale",
    });

    if (error) return fail(`Versione non creata: ${error.message}`);
    return ok({ created: Boolean(data) });
  });
}

export async function restoreDocumentVersionAction(
  versionId: string,
): Promise<ActionResult<undefined>> {
  return guard(async () => {
    const parsed = parseInput(uuid, versionId);
    if (!parsed.ok) return parsed.result;

    const session = await requireWriteSession();
    const { data: version } = await session.supabase
      .from("document_versions")
      .select("document_id, content, plain_text, revision")
      .eq("id", parsed.data)
      .eq("workspace_id", session.workspace.id)
      .maybeSingle();

    if (!version) return fail("Versione non trovata.");

    // Snapshot what is there now, so restoring is itself undoable.
    await session.supabase.rpc("snapshot_document", {
      p_document_id: version.document_id,
      p_label: "Prima del ripristino",
    });

    const { error } = await session.supabase
      .from("documents")
      .update({ content: version.content, plain_text: version.plain_text })
      .eq("id", version.document_id)
      .eq("workspace_id", session.workspace.id);

    if (error) return fail(`Ripristino non riuscito: ${error.message}`);

    const { data: doc } = await session.supabase
      .from("documents")
      .select("project_id")
      .eq("id", version.document_id)
      .maybeSingle();

    if (doc?.project_id) revalidatePath(`/projects/${doc.project_id}/document`);
    return ok();
  });
}
