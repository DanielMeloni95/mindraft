import "server-only";

import { PROJECT_TEMPLATE_SECTIONS } from "@/lib/domain/constants";
import { buildAgenticTemplateDoc, type AgenticEntityKind } from "@/lib/domain/agentic-template";
import { docToPlainText, EMPTY_DOC } from "@/lib/domain/tiptap";
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
    parentProjectId?: string | null;
    status?: ProjectStatus;
    entityKind?: AgenticEntityKind;
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
      parent_project_id: params.parentProjectId ?? null,
      status: params.status ?? "exploration",
    })
    .select("id")
    .single();

  if (error || !project) {
    throw new Error(`Progetto non creato: ${error?.message ?? "errore sconosciuto"}`);
  }

  const [{ data: document }, { data: canvas }, , { data: agenticDocument }] = await Promise.all([
    session.supabase
      .from("documents")
      .insert({
        workspace_id: session.workspace.id,
        created_by: session.userId,
        project_id: project.id,
        title: `${params.name} — documento di progetto`,
        kind: "document",
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
    session.supabase.from("documents").insert({
      workspace_id: session.workspace.id,
      created_by: session.userId,
      project_id: project.id,
      title: `${params.name} — documento agentico`,
      kind: "agentic",
      content: buildAgenticTemplateDoc(params.name, params.entityKind) as never,
      plain_text: docToPlainText(buildAgenticTemplateDoc(params.name, params.entityKind)),
    }).select("id").single(),
  ]);

  if (!document || !canvas || !agenticDocument) {
    throw new Error("Progetto creato ma incompleto: riprova.");
  }

  if (params.parentProjectId) {
    const { error: rootNodeError } = await session.supabase.from("canvas_nodes").insert({
      workspace_id: session.workspace.id,
      canvas_id: canvas.id,
      type: "project",
      label: params.name,
      position_x: 0,
      position_y: 0,
      entity_type: "project",
      entity_id: project.id,
      data: { icon: params.emoji ?? "🧩", variant: "subproject" },
    });
    if (rootNodeError) throw new Error(`Nodo principale non creato: ${rootNodeError.message}`);
  }

  return { projectId: project.id, documentId: document.id, canvasId: canvas.id };
}

/** Copies durable context without duplicating tasks or documents. */
export async function inheritProjectContext(
  session: SessionContext,
  parentProjectId: string,
  childProjectId: string,
): Promise<void> {
  const { data: parent } = await session.supabase.from("projects")
    .select("stack, audience, color")
    .eq("id", parentProjectId)
    .eq("workspace_id", session.workspace.id)
    .maybeSingle();
  if (!parent) throw new Error("Progetto padre non trovato.");

  await session.supabase.from("projects").update({
    stack: parent.stack,
    audience: parent.audience,
    color: parent.color,
  }).eq("id", childProjectId).eq("workspace_id", session.workspace.id);

  const [{ data: tags }, { data: relations }] = await Promise.all([
    session.supabase.from("entity_tags").select("tag_id")
      .eq("entity_type", "project").eq("entity_id", parentProjectId),
    session.supabase.from("entity_relations")
      .select("source_type, source_id, target_type, target_id, relation, note")
      .eq("workspace_id", session.workspace.id)
      .or(`and(source_type.eq.project,source_id.eq.${parentProjectId}),and(target_type.eq.project,target_id.eq.${parentProjectId})`),
  ]);
  if (tags?.length) await session.supabase.from("entity_tags").upsert(tags.map((tag) => ({
    workspace_id: session.workspace.id,
    tag_id: tag.tag_id,
    entity_type: "project" as const,
    entity_id: childProjectId,
  })), { onConflict: "tag_id,entity_type,entity_id" });

  const inherited = (relations ?? []).map((relation) => ({
    workspace_id: session.workspace.id,
    source_type: relation.source_type,
    source_id: relation.source_type === "project" && relation.source_id === parentProjectId ? childProjectId : relation.source_id,
    target_type: relation.target_type,
    target_id: relation.target_type === "project" && relation.target_id === parentProjectId ? childProjectId : relation.target_id,
    relation: relation.relation,
    note: relation.note,
    created_by: session.userId,
  }));
  inherited.push({
    workspace_id: session.workspace.id,
    source_type: "project",
    source_id: childProjectId,
    target_type: "project",
    target_id: parentProjectId,
    relation: "part_of",
    note: "Sottoprogetto",
    created_by: session.userId,
  });
  await session.supabase.from("entity_relations").upsert(inherited, {
    onConflict: "source_type,source_id,target_type,target_id,relation",
  });
}
