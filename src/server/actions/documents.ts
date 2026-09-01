"use server";

import { revalidatePath } from "next/cache";

import { docToMarkdown, docToPlainText, isTipTapDoc, type TipTapNode } from "@/lib/domain/tiptap";
import {
  AGENTIC_CANVAS_BLUEPRINT,
  agenticDocSectionTitles,
  agenticSectionCluster,
  agenticSectionNode,
  buildAgenticStrategicMap,
  buildAgenticTemplateDoc,
  extractAgenticSectionTitles,
  pdfTextToAgenticDoc,
} from "@/lib/domain/agentic-template";
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

type GeneratedCounts = { goals: number; milestones: number; tasks: number; nodes: number };
type AgenticSyncCounts = { goals: number; milestones: number; tasks: number; decisions: number; risks: number; resources: number };

async function syncStrategicEntities(
  session: Awaited<ReturnType<typeof requireWriteSession>>,
  documentId: string,
  projectId: string,
  sourceText: string,
): Promise<AgenticSyncCounts> {
  const map = buildAgenticStrategicMap(sourceText);
  const goals = map.filter((node) => node.type === "goal").map((node) => node.label);
  const milestones = map.filter((node) => ["p0", "p1", "p2"].includes(node.key)).map((node) => node.label);
  const tasks = map.filter((node) => node.type === "task").map((node) => ({
    title: node.label,
    priority: node.parentKey === "p0" ? "urgent" as const
      : node.parentKey === "p1" ? "high" as const : "medium" as const,
  }));
  const decisions = map.filter((node) => node.type === "decision").map((node) => node.label);
  const risks = map.filter((node) => node.type === "risk").map((node) => node.label);
  const resources = map.filter((node) => node.type === "feature").map((node) => node.label);
  const [knownGoals, knownMilestones, knownTasks, knownDecisions, knownRisks, knownResources] = await Promise.all([
    session.supabase.from("goals").select("title").eq("project_id", projectId).is("deleted_at", null),
    session.supabase.from("milestones").select("title").eq("project_id", projectId).is("deleted_at", null),
    session.supabase.from("tasks").select("title").eq("project_id", projectId).is("deleted_at", null),
    session.supabase.from("decisions").select("title").eq("project_id", projectId).is("deleted_at", null),
    session.supabase.from("risks").select("title").eq("project_id", projectId).is("deleted_at", null),
    session.supabase.from("resources").select("title").eq("project_id", projectId).is("deleted_at", null),
  ]);
  const missing = <T extends { title: string }>(items: T[], rows: Array<{ title: string }> | null) => {
    const known = new Set((rows ?? []).map((row) => row.title.trim().toLocaleLowerCase("it")));
    return items.filter((item) => !known.has(item.title.trim().toLocaleLowerCase("it")));
  };
  const newGoals = missing(goals.map((title) => ({ title })), knownGoals.data);
  const newMilestones = missing(milestones.map((title) => ({ title })), knownMilestones.data);
  const newTasks = missing(tasks, knownTasks.data);
  const newDecisions = missing(decisions.map((title) => ({ title })), knownDecisions.data);
  const newRisks = missing(risks.map((title) => ({ title })), knownRisks.data);
  const newResources = missing(resources.map((title) => ({ title })), knownResources.data);
  const results = await Promise.all([
    newGoals.length ? session.supabase.from("goals").insert(newGoals.map(({ title }, position) => ({
      workspace_id: session.workspace.id, project_id: projectId, title, position,
      description: "Sincronizzato dal documento agentico.",
    }))) : Promise.resolve({ error: null }),
    newMilestones.length ? session.supabase.from("milestones").insert(newMilestones.map(({ title }, position) => ({
      workspace_id: session.workspace.id, project_id: projectId, title, position,
      phase: title, status: "planned" as const, is_estimate: true,
      description: "Priorità sincronizzata dal documento agentico.",
    }))) : Promise.resolve({ error: null }),
    newTasks.length ? session.supabase.from("tasks").insert(newTasks.map(({ title, priority }, position) => ({
      workspace_id: session.workspace.id, created_by: session.userId, project_id: projectId, title, priority,
      position, status: "todo" as const, origin_type: "document" as const, origin_id: documentId,
      description: "Sincronizzato dal documento agentico.",
    }))) : Promise.resolve({ error: null }),
    newDecisions.length ? session.supabase.from("decisions").insert(newDecisions.map(({ title }) => ({
      workspace_id: session.workspace.id, created_by: session.userId, project_id: projectId, title,
      status: "proposed" as const, context: "Decisione aperta importata dal documento agentico.",
    }))) : Promise.resolve({ error: null }),
    newRisks.length ? session.supabase.from("risks").insert(newRisks.map(({ title }) => ({
      workspace_id: session.workspace.id, project_id: projectId, title,
      description: "Controllo operativo importato dal documento agentico.",
      likelihood: "medium" as const, impact: "high" as const,
    }))) : Promise.resolve({ error: null }),
    newResources.length ? session.supabase.from("resources").insert(newResources.map(({ title }) => ({
      workspace_id: session.workspace.id, project_id: projectId, title, kind: "note" as const,
      notes: "Componente di sistema importato dal documento agentico.",
    }))) : Promise.resolve({ error: null }),
  ]);
  const failed = results.find((result) => result.error);
  if (failed?.error) throw new Error(`Entità del progetto non sincronizzate: ${failed.error.message}`);
  return { goals: newGoals.length, milestones: newMilestones.length, tasks: newTasks.length, decisions: newDecisions.length, risks: newRisks.length, resources: newResources.length };
}

async function syncPdfSectionsToCanvas(
  session: Awaited<ReturnType<typeof requireWriteSession>>,
  projectId: string,
  projectName: string,
  sections: string[],
): Promise<number> {
  const { data: canvas } = await session.supabase.from("canvases").select("id")
    .eq("project_id", projectId).is("deleted_at", null).maybeSingle();
  if (!canvas || !sections.length) return 0;
  const { data: current } = await session.supabase.from("canvas_nodes")
    .select("id, label, entity_type, entity_id, data").eq("canvas_id", canvas.id);
  let root = (current ?? []).find((node) => node.entity_type === "project" && node.entity_id === projectId);
  if (!root) {
    const { data } = await session.supabase.from("canvas_nodes").insert({
      workspace_id: session.workspace.id,
      canvas_id: canvas.id,
      type: "project",
      label: projectName,
      position_x: 450,
      position_y: -220,
      entity_type: "project",
      entity_id: projectId,
      data: { icon: "📘", origin: "agentic_pdf" },
    }).select("id, label, entity_type, entity_id, data").single();
    root = data ?? undefined;
  }
  if (!root) throw new Error("Nodo principale del progetto non creato.");

  const grouped = sections.reduce<Array<{ cluster: ReturnType<typeof agenticSectionCluster>; sections: string[] }>>((result, title) => {
    const cluster = agenticSectionCluster(title);
    const group = result.find((item) => item.cluster.id === cluster.id);
    if (group) group.sections.push(title);
    else result.push({ cluster, sections: [title] });
    return result;
  }, []);
  await session.supabase.from("canvas_nodes").update({
    position_x: 0,
    position_y: Math.max(0, (sections.length - 1) * 72.5),
  }).eq("id", root.id);
  const clusterLabels = grouped.map((group) => group.cluster.label);
  const wanted = new Set([...sections, ...clusterLabels].map((title) => title.trim().toLocaleLowerCase("it")));
  const staleIds = (current ?? []).filter((node) => {
    const data = node.data && !Array.isArray(node.data) && typeof node.data === "object" ? node.data as Record<string, Json | undefined> : {};
    return (data.origin === "agentic_pdf" || data.origin === "agentic_pdf_cluster")
      && node.id !== root.id && !wanted.has(node.label.trim().toLocaleLowerCase("it"));
  }).map((node) => node.id);
  if (staleIds.length) {
    const { error } = await session.supabase.from("canvas_nodes").delete().in("id", staleIds);
    if (error) throw new Error(`Vecchi nodi PDF non rimossi: ${error.message}`);
  }
  const active = (current ?? []).filter((node) => !staleIds.includes(node.id));
  const known = new Map(active.map((node) => [node.label.trim().toLocaleLowerCase("it"), node.id]));
  const missingClusters = grouped.filter((group) => !known.has(group.cluster.label.toLocaleLowerCase("it")));
  if (missingClusters.length) {
    const { data: inserted, error } = await session.supabase.from("canvas_nodes").insert(missingClusters.map((group) => ({
      workspace_id: session.workspace.id,
      canvas_id: canvas.id,
      type: "group" as const,
      label: group.cluster.label,
      body: `${group.sections.length} sezioni`,
      position_x: 340,
      position_y: (() => {
        const groupIndex = grouped.findIndex((item) => item.cluster.id === group.cluster.id);
        const start = grouped.slice(0, groupIndex).reduce((sum, item) => sum + item.sections.length, 0);
        return (start + (group.sections.length - 1) / 2) * 145;
      })(),
      data: { icon: group.cluster.icon, origin: "agentic_pdf_cluster", cluster: group.cluster.id },
    }))).select("id, label");
    if (error) throw new Error(`Cluster PDF non creati: ${error.message}`);
    for (const node of inserted ?? []) known.set(node.label.trim().toLocaleLowerCase("it"), node.id);
  }
  const missingSections = sections.filter((title) => !known.has(title.trim().toLocaleLowerCase("it")));
  if (missingSections.length) {
    const { data: inserted, error } = await session.supabase.from("canvas_nodes").insert(missingSections.map((label) => {
      const style = agenticSectionNode(label);
      const groupIndex = grouped.findIndex((group) => group.cluster.id === agenticSectionCluster(label).id);
      const childIndex = grouped[groupIndex]?.sections.indexOf(label) ?? 0;
      const start = grouped.slice(0, groupIndex).reduce((sum, group) => sum + group.sections.length, 0);
      return {
        workspace_id: session.workspace.id,
        canvas_id: canvas.id,
        type: style.type,
        label,
        position_x: 680,
        position_y: (start + childIndex) * 145,
        data: { icon: style.icon, origin: "agentic_pdf", section: label },
      };
    })).select("id, label");
    if (error) throw new Error(`Nodi PDF non creati: ${error.message}`);
    for (const node of inserted ?? []) known.set(node.label.trim().toLocaleLowerCase("it"), node.id);
  }
  await Promise.all(grouped.flatMap((group, groupIndex) => {
    const clusterId = known.get(group.cluster.label.toLocaleLowerCase("it"));
    const start = grouped.slice(0, groupIndex).reduce((sum, item) => sum + item.sections.length, 0);
    const updates: Array<PromiseLike<unknown>> = [];
    if (clusterId) updates.push(session.supabase.from("canvas_nodes").update({
      position_x: 340,
      position_y: (start + (group.sections.length - 1) / 2) * 145,
      body: `${group.sections.length} sezioni`,
    }).eq("id", clusterId));
    group.sections.forEach((label, childIndex) => {
      const id = known.get(label.toLocaleLowerCase("it"));
      if (id) updates.push(session.supabase.from("canvas_nodes").update({
        position_x: 680,
        position_y: (start + childIndex) * 145,
      }).eq("id", id));
    });
    return updates;
  }));

  const clusterEdges = grouped.map((group) => known.get(group.cluster.label.toLocaleLowerCase("it")))
    .filter((id): id is string => Boolean(id)).map((nodeId) => ({
      workspace_id: session.workspace.id,
      canvas_id: canvas.id,
      source_node_id: nodeId,
      target_node_id: root.id,
      relation: "part_of" as const,
      source_handle: "left" as const,
      target_handle: "right" as const,
      label: "Area del progetto",
    }));
  const sectionEdges = grouped.flatMap((group) => {
    const clusterId = known.get(group.cluster.label.toLocaleLowerCase("it"));
    if (!clusterId) return [];
    return group.sections.map((title) => known.get(title.trim().toLocaleLowerCase("it")))
      .filter((id): id is string => Boolean(id)).map((nodeId) => ({
        workspace_id: session.workspace.id,
        canvas_id: canvas.id,
        source_node_id: nodeId,
        target_node_id: clusterId,
        relation: "part_of" as const,
        source_handle: "left" as const,
        target_handle: "right" as const,
        label: "Sezione di",
      }));
  });
  const edges = [...clusterEdges, ...sectionEdges];
  if (edges.length) {
    const { data: existingEdges, error: readError } = await session.supabase.from("canvas_edges")
      .select("id, source_node_id, target_node_id, relation").eq("canvas_id", canvas.id);
    if (readError) throw new Error(`Collegamenti non leggibili: ${readError.message}`);
    const desiredKeys = new Set(edges.map((edge) => `${edge.source_node_id}:${edge.target_node_id}:${edge.relation}`));
    const managedIds = new Set([
      ...sections.map((title) => known.get(title.toLocaleLowerCase("it"))),
      ...clusterLabels.map((label) => known.get(label.toLocaleLowerCase("it"))),
    ].filter((id): id is string => Boolean(id)));
    const obsoleteIds = (existingEdges ?? []).filter((edge) => edge.relation === "part_of"
      && managedIds.has(edge.source_node_id)
      && (edge.target_node_id === root.id || managedIds.has(edge.target_node_id))
      && !desiredKeys.has(`${edge.source_node_id}:${edge.target_node_id}:${edge.relation}`))
      .map((edge) => edge.id);
    if (obsoleteIds.length) {
      const { error: deleteError } = await session.supabase.from("canvas_edges").delete().in("id", obsoleteIds);
      if (deleteError) throw new Error(`Vecchia alberatura non rimossa: ${deleteError.message}`);
    }
    const existingKeys = new Set((existingEdges ?? []).map((edge) => `${edge.source_node_id}:${edge.target_node_id}:${edge.relation}`));
    await Promise.all((existingEdges ?? []).filter((edge) =>
      desiredKeys.has(`${edge.source_node_id}:${edge.target_node_id}:${edge.relation}`))
      .map((edge) => session.supabase.from("canvas_edges").update({
        source_handle: "left",
        target_handle: "right",
        label: edges.find((candidate) => candidate.source_node_id === edge.source_node_id
          && candidate.target_node_id === edge.target_node_id)?.label ?? "È parte di",
      }).eq("id", edge.id)));
    const missingEdges = edges.filter((edge) => !existingKeys.has(`${edge.source_node_id}:${edge.target_node_id}:${edge.relation}`));
    if (missingEdges.length) {
      const { error: edgeError } = await session.supabase.from("canvas_edges").insert(missingEdges);
      if (edgeError) throw new Error(`Collegamenti non creati: ${edgeError.message}`);
    }
  }
  return missingClusters.length + missingSections.length;
}

async function syncStrategicMapToCanvas(
  session: Awaited<ReturnType<typeof requireWriteSession>>,
  projectId: string,
  projectName: string,
  sourceText: string,
): Promise<number> {
  if (!/editorial factory|golden sample|visual studio/i.test(sourceText)) {
    return syncPdfSectionsToCanvas(session, projectId, projectName, extractAgenticSectionTitles(sourceText));
  }
  const map = buildAgenticStrategicMap(sourceText);
  if (!map.length) return 0;
  const { data: canvas } = await session.supabase.from("canvases").select("id")
    .eq("project_id", projectId).is("deleted_at", null).maybeSingle();
  if (!canvas) return 0;
  const { data: current, error: currentError } = await session.supabase.from("canvas_nodes")
    .select("id, entity_type, entity_id, data").eq("canvas_id", canvas.id);
  if (currentError) throw new Error(`Canvas non leggibile: ${currentError.message}`);

  let root = (current ?? []).find((node) => node.entity_type === "project" && node.entity_id === projectId);
  if (!root) {
    const { data, error } = await session.supabase.from("canvas_nodes").insert({
      workspace_id: session.workspace.id,
      canvas_id: canvas.id,
      type: "project",
      label: projectName,
      body: "Agenti propongono · Persone decidono",
      position_x: 3200,
      position_y: 0,
      entity_type: "project",
      entity_id: projectId,
      color: "#2563eb",
      data: { icon: "🤖", origin: "agentic_strategy_root" },
    }).select("id, entity_type, entity_id, data").single();
    if (error) throw new Error(`Nodo principale non creato: ${error.message}`);
    root = data ?? undefined;
  } else {
    const { error } = await session.supabase.from("canvas_nodes").update({
      position_x: 3200,
      position_y: 0,
      body: "Agenti propongono · Persone decidono",
    }).eq("id", root.id);
    if (error) throw new Error(`Nodo principale non aggiornato: ${error.message}`);
  }
  if (!root) throw new Error("Nodo principale del progetto non disponibile.");

  const managedIds = (current ?? []).filter((node) => {
    const data = node.data && !Array.isArray(node.data) && typeof node.data === "object"
      ? node.data as Record<string, Json | undefined> : {};
    return node.id !== root?.id && typeof data.origin === "string"
      && ["agentic_pdf", "agentic_pdf_cluster", "agentic_strategy"].includes(data.origin);
  }).map((node) => node.id);
  if (managedIds.length) {
    const { error } = await session.supabase.from("canvas_nodes").delete().in("id", managedIds);
    if (error) throw new Error(`Vecchia mappa agentica non rimossa: ${error.message}`);
  }

  const { data: inserted, error: insertError } = await session.supabase.from("canvas_nodes").insert(map.map((node) => ({
    workspace_id: session.workspace.id,
    canvas_id: canvas.id,
    type: node.type,
    label: node.label,
    position_x: node.x,
    position_y: node.y,
    color: node.color,
    data: { icon: node.icon, origin: "agentic_strategy", strategy_key: node.key },
  }))).select("id, data");
  if (insertError) throw new Error(`Mappa strategica non creata: ${insertError.message}`);

  const ids = new Map<string, string>();
  for (const node of inserted ?? []) {
    const data = node.data && !Array.isArray(node.data) && typeof node.data === "object"
      ? node.data as Record<string, Json | undefined> : {};
    if (typeof data.strategy_key === "string") ids.set(data.strategy_key, node.id);
  }
  const edges = map.map((node) => {
    const sourceId = ids.get(node.key);
    const targetId = node.parentKey ? ids.get(node.parentKey) : root?.id;
    if (!sourceId || !targetId) return null;
    return {
      workspace_id: session.workspace.id,
      canvas_id: canvas.id,
      source_node_id: sourceId,
      target_node_id: targetId,
      relation: "part_of" as const,
      source_handle: "top" as const,
      target_handle: "bottom" as const,
      label: node.parentKey ? "" : "Area del progetto",
    };
  }).filter((edge): edge is NonNullable<typeof edge> => Boolean(edge));
  if (edges.length) {
    const { error } = await session.supabase.from("canvas_edges").insert(edges);
    if (error) throw new Error(`Alberatura strategica non creata: ${error.message}`);
  }
  return map.length;
}

export async function syncAgenticCanvasAction(documentId: string): Promise<ActionResult<{ nodes: number; sections: number; entities: AgenticSyncCounts }>> {
  return guard(async () => {
    const parsed = parseInput(uuid, documentId);
    if (!parsed.ok) return parsed.result;
    const session = await requireWriteSession();
    const { data: document } = await session.supabase.from("documents")
      .select("project_id, kind, content, plain_text").eq("id", parsed.data).eq("workspace_id", session.workspace.id)
      .is("deleted_at", null).maybeSingle();
    if (!document?.project_id || document.kind !== "agentic") return fail("Documento agentico non trovato.");
    const { data: project } = await session.supabase.from("projects").select("name")
      .eq("id", document.project_id).eq("workspace_id", session.workspace.id).maybeSingle();
    if (!project) return fail("Progetto non trovato.");
    const sourceText = document.plain_text || docToPlainText(document.content as TipTapNode);
    const sections = agenticDocSectionTitles(document.content as TipTapNode);
    const nodes = await syncStrategicMapToCanvas(session, document.project_id, project.name, sourceText);
    if (!nodes) return fail("Nel documento non sono stati riconosciuti contenuti strategici.");
    const entities = await syncStrategicEntities(session, parsed.data, document.project_id, sourceText);
    revalidatePath(`/projects/${document.project_id}/canvas`);
    revalidatePath(`/projects/${document.project_id}`);
    revalidatePath(`/projects/${document.project_id}/tasks`);
    revalidatePath(`/projects/${document.project_id}/decisions`);
    return ok({ nodes, sections: sections.length, entities });
  });
}

export async function importAgenticPdfAction(formData: FormData): Promise<ActionResult<{ pages: number; characters: number; nodes: number; entities: AgenticSyncCounts }>> {
  return guard(async () => {
    const parsedId = parseInput(uuid, formData.get("documentId"));
    if (!parsedId.ok) return parsedId.result;
    const file = formData.get("file");
    if (!(file instanceof File)) return fail("Seleziona un file PDF.");
    if (file.type !== "application/pdf" && !file.name.toLocaleLowerCase().endsWith(".pdf")) {
      return fail("Il file selezionato non è un PDF.");
    }
    if (file.size === 0) return fail("Il PDF è vuoto.");
    if (file.size > 15 * 1024 * 1024) return fail("Il PDF supera il limite di 15 MB.");

    const session = await requireWriteSession();
    const { data: document } = await session.supabase.from("documents")
      .select("id, project_id, kind").eq("id", parsedId.data).eq("workspace_id", session.workspace.id)
      .is("deleted_at", null).maybeSingle();
    if (!document?.project_id || document.kind !== "agentic") return fail("Documento agentico non trovato.");

    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()));
    const extracted = await extractText(pdf, { mergePages: true });
    const text = String(extracted.text ?? "").replace(/\u0000/g, "").trim().slice(0, 190_000);
    if (text.length < 20) return fail("Il PDF non contiene testo estraibile. Per i PDF scansionati serve prima l’OCR.");
    const content = pdfTextToAgenticDoc(text);
    await session.supabase.rpc("snapshot_document", {
      p_document_id: document.id,
      p_label: `Prima dell'importazione PDF`,
    });
    const { error } = await session.supabase.from("documents").update({
      content: content as unknown as Json,
      plain_text: docToPlainText(content),
    }).eq("id", document.id).eq("workspace_id", session.workspace.id);
    if (error) return fail(`PDF non importato: ${error.message}`);

    const { data: project } = await session.supabase.from("projects").select("name")
      .eq("id", document.project_id).eq("workspace_id", session.workspace.id).maybeSingle();
    const nodes = project ? await syncStrategicMapToCanvas(session, document.project_id, project.name, text) : 0;
    const entities = await syncStrategicEntities(session, document.id, document.project_id, text);

    await touchProject(session.supabase, document.project_id);
    revalidatePath(`/projects/${document.project_id}/agentic-document`);
    revalidatePath(`/projects/${document.project_id}/canvas`);
    revalidatePath(`/projects/${document.project_id}`);
    revalidatePath(`/projects/${document.project_id}/tasks`);
    revalidatePath(`/projects/${document.project_id}/decisions`);
    return ok({ pages: extracted.totalPages, characters: text.length, nodes, entities });
  });
}

export async function regenerateAgenticTemplateAction(documentId: string): Promise<ActionResult<{ nodes: number }>> {
  return guard(async () => {
    const parsed = parseInput(uuid, documentId);
    if (!parsed.ok) return parsed.result;
    const session = await requireWriteSession();
    const { data: document } = await session.supabase.from("documents")
      .select("id, project_id, kind").eq("id", parsed.data).eq("workspace_id", session.workspace.id)
      .is("deleted_at", null).maybeSingle();
    if (!document?.project_id || document.kind !== "agentic") return fail("Documento agentico non trovato.");
    const { data: project } = await session.supabase.from("projects").select("name, parent_project_id")
      .eq("id", document.project_id).eq("workspace_id", session.workspace.id).maybeSingle();
    if (!project) return fail("Progetto non trovato.");
    const { data: toolNode } = await session.supabase.from("canvas_nodes").select("id")
      .eq("workspace_id", session.workspace.id).eq("entity_type", "project").eq("entity_id", document.project_id)
      .contains("data", { variant: "tool" }).limit(1).maybeSingle();
    const kind = toolNode ? "tool" : project.parent_project_id ? "subproject" : "project";
    const content = buildAgenticTemplateDoc(project.name, kind);
    await session.supabase.rpc("snapshot_document", {
      p_document_id: document.id,
      p_label: "Prima della rigenerazione template",
    });
    const { error } = await session.supabase.from("documents").update({
      content: content as unknown as Json,
      plain_text: docToPlainText(content),
    }).eq("id", document.id).eq("workspace_id", session.workspace.id);
    if (error) return fail(`Template non rigenerato: ${error.message}`);

    let createdNodes = 0;
    const { data: canvas } = await session.supabase.from("canvases").select("id")
      .eq("project_id", document.project_id).is("deleted_at", null).maybeSingle();
    if (canvas) {
      const { data: existing } = await session.supabase.from("canvas_nodes").select("label").eq("canvas_id", canvas.id);
      const labels = new Set((existing ?? []).map((node) => node.label.trim().toLocaleLowerCase("it")));
      const missing = AGENTIC_CANVAS_BLUEPRINT.filter((node) => !labels.has(node.label.toLocaleLowerCase("it")));
      if (missing.length) {
        const { error: nodeError } = await session.supabase.from("canvas_nodes").insert(missing.map((node) => ({
          workspace_id: session.workspace.id,
          canvas_id: canvas.id,
          type: node.type,
          label: node.label,
          position_x: node.x,
          position_y: node.y,
          data: { icon: node.icon, origin: "agentic_template", section: node.section },
        })));
        if (nodeError) return fail(`Documento rigenerato, ma canvas non sincronizzato: ${nodeError.message}`);
        createdNodes = missing.length;
      }
    }
    await touchProject(session.supabase, document.project_id);
    revalidatePath(`/projects/${document.project_id}/agentic-document`);
    revalidatePath(`/projects/${document.project_id}/canvas`);
    return ok({ nodes: createdNodes });
  });
}

function agenticLists(markdown: string) {
  const result = { goals: [] as string[], milestones: [] as string[], tasks: [] as string[], canvas: [] as string[] };
  let active: keyof typeof result | null = null;
  for (const raw of markdown.split("\n")) {
    const heading = /^#{1,6}\s+(.+)$/.exec(raw.trim());
    if (heading) {
      const name = heading[1].toLocaleLowerCase("it");
      active = /obiettiv|goals?/.test(name) ? "goals"
        : /roadmap|milestone/.test(name) ? "milestones"
        : /attivit|task|azioni/.test(name) ? "tasks"
        : /canvas|mappa|nodi/.test(name) ? "canvas" : null;
      continue;
    }
    if (!active) continue;
    const item = /^\s*(?:[-*+] |\d+[.)]\s+)(?:\[[ xX]\]\s*)?(.+)$/.exec(raw);
    if (item?.[1]) result[active].push(item[1].trim().slice(0, 200));
  }
  return result;
}

/** Materialises the structured headings of the document without duplicating existing entities. */
export async function generateFromAgenticDocumentAction(documentId: string): Promise<ActionResult<GeneratedCounts>> {
  return guard(async () => {
    const parsed = parseInput(uuid, documentId);
    if (!parsed.ok) return parsed.result;
    const session = await requireWriteSession();
    const { data: document } = await session.supabase.from("documents")
      .select("id, project_id, content").eq("id", parsed.data)
      .eq("workspace_id", session.workspace.id).is("deleted_at", null).maybeSingle();
    if (!document?.project_id) return fail("Documento di progetto non trovato.");
    const lists = agenticLists(docToMarkdown(document.content));
    if (![...lists.goals, ...lists.milestones, ...lists.tasks, ...lists.canvas].length) {
      return fail("Aggiungi elenchi sotto Obiettivi, Roadmap, Attività o Canvas.");
    }
    const projectId = document.project_id;
    const [{ data: goals }, { data: milestones }, { data: tasks }, { data: canvas }] = await Promise.all([
      session.supabase.from("goals").select("title").eq("project_id", projectId).is("deleted_at", null),
      session.supabase.from("milestones").select("title").eq("project_id", projectId).is("deleted_at", null),
      session.supabase.from("tasks").select("title").eq("project_id", projectId).is("deleted_at", null),
      session.supabase.from("canvases").select("id").eq("project_id", projectId).is("deleted_at", null).maybeSingle(),
    ]);
    const missing = (items: string[], existing: Array<{ title: string }> | null) => {
      const known = new Set((existing ?? []).map((row) => row.title.trim().toLocaleLowerCase("it")));
      return [...new Set(items)].filter((title) => !known.has(title.toLocaleLowerCase("it")));
    };
    const newGoals = missing(lists.goals, goals);
    const newMilestones = missing(lists.milestones, milestones);
    const newTasks = missing(lists.tasks, tasks);
    let newNodes = lists.canvas;
    if (canvas) {
      const { data: nodes } = await session.supabase.from("canvas_nodes").select("label").eq("canvas_id", canvas.id);
      const known = new Set((nodes ?? []).map((n) => n.label.trim().toLocaleLowerCase("it")));
      newNodes = [...new Set(lists.canvas)].filter((label) => !known.has(label.toLocaleLowerCase("it")));
    }
    await Promise.all([
      newGoals.length ? session.supabase.from("goals").insert(newGoals.map((title, position) => ({ workspace_id: session.workspace.id, project_id: projectId, title, position }))) : Promise.resolve(),
      newMilestones.length ? session.supabase.from("milestones").insert(newMilestones.map((title, position) => ({ workspace_id: session.workspace.id, project_id: projectId, title, position, status: "planned" as const, is_estimate: true }))) : Promise.resolve(),
      newTasks.length ? session.supabase.from("tasks").insert(newTasks.map((title, position) => ({ workspace_id: session.workspace.id, created_by: session.userId, project_id: projectId, title, position, status: "todo" as const, priority: "medium" as const, origin_type: "document" as const, origin_id: document.id }))) : Promise.resolve(),
      canvas && newNodes.length ? session.supabase.from("canvas_nodes").insert(newNodes.map((label, index) => {
        const blueprint = AGENTIC_CANVAS_BLUEPRINT.find((node) => node.label.toLocaleLowerCase("it") === label.toLocaleLowerCase("it"));
        return {
          workspace_id: session.workspace.id,
          canvas_id: canvas.id,
          type: blueprint?.type ?? "text" as const,
          label,
          position_x: blueprint?.x ?? (index % 3) * 280,
          position_y: blueprint?.y ?? Math.floor(index / 3) * 180,
          data: blueprint
            ? { icon: blueprint.icon, origin: "agentic_document", section: blueprint.section }
            : { origin: "agentic_document" },
        };
      })) : Promise.resolve(),
    ]);
    await touchProject(session.supabase, projectId);
    revalidatePath(`/projects/${projectId}`);
    revalidatePath(`/projects/${projectId}/document`);
    revalidatePath(`/projects/${projectId}/canvas`);
    revalidatePath(`/projects/${projectId}/tasks`);
    return ok({ goals: newGoals.length, milestones: newMilestones.length, tasks: newTasks.length, nodes: canvas ? newNodes.length : 0 });
  });
}

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
