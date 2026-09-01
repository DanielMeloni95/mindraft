import "server-only";

import type { Supabase } from "@/lib/supabase/server";
import type { DocumentRow, DocumentVersionRow } from "@/types/database";

export async function getProjectDocument(
  supabase: Supabase,
  workspaceId: string,
  projectId: string,
  kind: "document" | "agentic" = "document",
): Promise<DocumentRow | null> {
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("project_id", projectId)
    .eq("kind", kind)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw new Error(`Documento non disponibile: ${error.message}`);
  return data ?? null;
}

export async function listDocumentVersions(
  supabase: Supabase,
  documentId: string,
  limit = 20,
): Promise<Array<Pick<DocumentVersionRow, "id" | "revision" | "label" | "created_at">>> {
  const { data } = await supabase
    .from("document_versions")
    .select("id, revision, label, created_at")
    .eq("document_id", documentId)
    .order("revision", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function getDocumentVersion(
  supabase: Supabase,
  versionId: string,
): Promise<DocumentVersionRow | null> {
  const { data } = await supabase
    .from("document_versions")
    .select("*")
    .eq("id", versionId)
    .maybeSingle();
  return data ?? null;
}
