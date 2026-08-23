import "server-only";

import { PROJECT_TEMPLATE_SECTIONS } from "@/lib/domain/constants";
import { EMPTY_DOC } from "@/lib/domain/tiptap";
import type { SessionContext } from "@/server/session";
import type { ProjectStatus } from "@/types/database";

/**
 * Creates the project plus the three things that make it usable
 * immediately: the section skeleton, an empty document and a canvas.
 * Doing it here keeps every project consistent, instead of lazily
 * creating pieces the first time a tab is opened.
 */
export async function provisionProject(
  session: SessionContext,
  params: {
    name: string;
    shortDescription?: string | null;
    emoji?: string | null;
    color?: string | null;
    sourceIdeaId?: string | null;
    status?: ProjectStatus;
  },
): Promise<{ projectId: string; documentId: string; canvasId: string }> {
  const { data: project, error } = await session.supabase
    .from("projects")
    .insert({
      workspace_id: session.workspace.id,
      created_by: session.userId,
      name: params.name,
      short_description: params.shortDescription ?? null,
      emoji: params.emoji ?? "🧩",
      color: params.color ?? "#5B5CE2",
      source_idea_id: params.sourceIdeaId ?? null,
      status: params.status ?? "exploration",
    })
    .select("id")
    .single();

  if (error || !project) {
    throw new Error(`Progetto non creato: ${error?.message ?? "errore sconosciuto"}`);
  }

  const [{ data: document }, { data: canvas }] = await Promise.all([
    session.supabase
      .from("documents")
      .insert({
        workspace_id: session.workspace.id,
        created_by: session.userId,
        project_id: project.id,
        title: `${params.name} — documento di progetto`,
        content: EMPTY_DOC as never,
        plain_text: "",
      })
      .select("id")
      .single(),
    session.supabase
      .from("canvases")
      .insert({
        workspace_id: session.workspace.id,
        project_id: project.id,
        title: "Mappa del progetto",
      })
      .select("id")
      .single(),
    session.supabase.from("project_sections").insert(
      PROJECT_TEMPLATE_SECTIONS.map((section, index) => ({
        workspace_id: session.workspace.id,
        project_id: project.id,
        key: section.key,
        title: section.title,
        content: "",
        origin: "user" as const,
        position: index,
      })),
    ),
  ]);

  if (!document || !canvas) {
    throw new Error("Progetto creato ma incompleto: riprova.");
  }

  return { projectId: project.id, documentId: document.id, canvasId: canvas.id };
}
