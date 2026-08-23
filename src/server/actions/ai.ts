"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  AI_ERROR_MESSAGES,
  AiError,
  describeProvider,
  runAiFeature,
} from "@/lib/ai";
import type {
  CompareIdeasResult,
  ExtractTasksResult,
  IdeaToProjectResult,
  NextStepResult,
  OrganizeNoteResult,
  QuestionsResult,
  SimilarIdeasResult,
  SummaryResult,
} from "@/lib/ai/schemas";
import { bulletList, parseSections, type ProposalSection } from "@/lib/domain/proposals";
import { sectionsToDoc, docToPlainText } from "@/lib/domain/tiptap";
import { uuid } from "@/lib/validation/schemas";
import { fail, guard, ok, parseInput, type ActionResult } from "@/server/action-result";
import { logActivity } from "@/server/activity";
import {
  buildIdeaContext,
  buildIdeasContext,
  buildProjectContext,
  buildWorkspaceContext,
} from "@/server/ai-context";
import { provisionProject } from "@/server/provision";
import { checkRateLimit } from "@/server/rate-limit";
import { requireWriteSession, type SessionContext } from "@/server/session";
import type { Json, ProjectRow } from "@/types/database";

const AI_RATE = { limit: 12, windowMs: 60_000 };

function aiFailure(error: unknown): ActionResult<never> {
  if (error instanceof AiError) {
    return fail(AI_ERROR_MESSAGES[error.code]);
  }
  return fail("L'assistente non ha risposto. Nulla è stato modificato.");
}

function gate(session: SessionContext, feature: string): ActionResult<never> | null {
  const check = checkRateLimit(`${session.userId}:${feature}`, AI_RATE);
  if (!check.allowed) {
    return fail(
      `Troppe richieste ravvicinate. Riprova fra ${check.retryAfterSeconds} secondi.`,
    );
  }
  return null;
}

/* ================================================================== */
/* Idea → Project                                                      */
/* ================================================================== */

export async function proposeIdeaToProjectAction(
  ideaId: string,
): Promise<ActionResult<{ proposalId: string }>> {
  return guard(async () => {
    const parsed = parseInput(uuid, ideaId);
    if (!parsed.ok) return parsed.result;

    const session = await requireWriteSession();
    const blocked = gate(session, "idea_to_project");
    if (blocked) return blocked;

    const context = await buildIdeaContext(session.supabase, session.workspace.id, parsed.data);
    if (!context?.idea) return fail("Idea non trovata.");

    let result: IdeaToProjectResult;
    let runId: string;
    try {
      const outcome = await runAiFeature(session.supabase, {
        feature: "idea_to_project",
        workspaceId: session.workspace.id,
        userId: session.userId,
        plan: session.plan,
        context,
        entityType: "idea",
        entityId: parsed.data,
      });
      result = outcome.data;
      runId = outcome.runId;
    } catch (error) {
      return aiFailure(error);
    }

    const idea = context.idea;
    const currentByKey: Record<string, string> = {
      problem: idea.problem ?? "",
      solution: idea.solution ?? "",
      users: idea.audience ?? "",
    };

    const sections: ProposalSection[] = [
      {
        key: "project_name",
        label: "Nome del progetto",
        current: idea.title,
        proposed: result.projectName,
        kind: "project_field",
        confidence: "medium",
        rationale: "Titolo di lavoro proposto per il progetto.",
      },
      ...result.sections.map<ProposalSection>((section) => ({
        key: section.key,
        label: section.label,
        current: currentByKey[section.key] ?? "",
        proposed: section.proposed,
        kind: "project_section",
        confidence: section.confidence,
        rationale: section.rationale,
      })),
    ];

    if (result.milestones.length > 0) {
      sections.push({
        key: "milestones",
        label: `Roadmap (${result.milestones.length} milestone, stime)`,
        current: "",
        proposed: bulletList(
          result.milestones.map(
            (m) => `${m.title} — da settimana ${m.weeksFromStart} per ${m.durationWeeks} sett. (stima)`,
          ),
        ),
        kind: "plan",
        confidence: "low",
        rationale: "Sequenza proposta: le date sono stime, non impegni.",
        data: result.milestones,
      });
    }

    if (result.tasks.length > 0) {
      sections.push({
        key: "tasks",
        label: `Attività iniziali (${result.tasks.length})`,
        current: "",
        proposed: bulletList(result.tasks.map((t) => t.title)),
        kind: "plan",
        confidence: "low",
        rationale: "Primi passi concreti derivati dall'MVP proposto.",
        data: result.tasks,
      });
    }

    if (result.risks.length > 0) {
      sections.push({
        key: "risks_list",
        label: `Rischi individuati (${result.risks.length})`,
        current: "",
        proposed: bulletList(result.risks.map((r) => `${r.title} — ${r.mitigation}`)),
        kind: "plan",
        confidence: "low",
        rationale: "Ipotesi non verificate che possono far deragliare il progetto.",
        data: result.risks,
      });
    }

    if (result.map.nodes.length > 0) {
      sections.push({
        key: "map",
        label: `Mappa (${result.map.nodes.length} nodi, ${result.map.edges.length} collegamenti)`,
        current: "",
        proposed: bulletList(result.map.nodes.map((n) => `${n.label} (${n.type})`)),
        kind: "map",
        confidence: "low",
        rationale: "Struttura visiva di partenza, modificabile nel canvas.",
        data: result.map,
      });
    }

    const { data: proposal, error } = await session.supabase
      .from("ai_proposals")
      .insert({
        workspace_id: session.workspace.id,
        run_id: runId,
        created_by: session.userId,
        feature: "idea_to_project",
        entity_type: "idea",
        entity_id: parsed.data,
        sections: sections as unknown as Json,
        assumptions: result.assumptions,
        questions: result.questions,
        citations: result.citations as unknown as Json,
      })
      .select("id")
      .single();

    if (error || !proposal) return fail(`Proposta non salvata: ${error?.message}`);

    revalidatePath(`/ideas/${parsed.data}`);
    return ok({ proposalId: proposal.id });
  });
}

const applySchema = z.object({
  proposalId: uuid,
  acceptedKeys: z.array(z.string().min(1).max(60)).max(40),
});

/**
 * Applies only the sections the user ticked.
 *
 * Everything written here is recorded in undo_payload first, so
 * "annulla" restores the previous state instead of leaving the user with
 * a half-transformed idea.
 */
export async function applyIdeaToProjectAction(
  input: unknown,
): Promise<ActionResult<{ projectId: string }>> {
  return guard(async () => {
    const parsed = parseInput(applySchema, input);
    if (!parsed.ok) return parsed.result;

    const session = await requireWriteSession();
    const { proposalId, acceptedKeys } = parsed.data;

    const { data: proposal } = await session.supabase
      .from("ai_proposals")
      .select("*")
      .eq("id", proposalId)
      .eq("workspace_id", session.workspace.id)
      .maybeSingle();

    if (!proposal) return fail("Proposta non trovata.");
    if (proposal.status !== "pending") return fail("Questa proposta è già stata gestita.");
    if (proposal.feature !== "idea_to_project") return fail("Tipo di proposta non gestito qui.");

    const sections = parseSections(proposal.sections);
    const accepted = new Set(acceptedKeys);
    const chosen = sections.filter((s) => accepted.has(s.key));

    if (chosen.length === 0) {
      return fail("Non hai selezionato nessuna sezione da applicare.");
    }

    const { data: idea } = await session.supabase
      .from("ideas")
      .select("id, title, status, project_id, summary")
      .eq("id", proposal.entity_id)
      .eq("workspace_id", session.workspace.id)
      .maybeSingle();

    if (!idea) return fail("Idea non trovata.");
    if (idea.project_id) return fail("Questa idea è già collegata a un progetto.");

    const nameSection = chosen.find((s) => s.key === "project_name");
    const projectName = (nameSection?.proposed ?? idea.title).slice(0, 200);

    const { projectId, documentId, canvasId } = await provisionProject(session, {
      name: projectName,
      sourceIdeaId: idea.id,
      status: "exploration",
    });

    // ---- project columns fed by approved sections -------------------
    const projectPatch: Partial<ProjectRow> = {};
    for (const section of chosen) {
      if (section.key === "vision") projectPatch.vision = section.proposed;
      else if (section.key === "problem") projectPatch.problem = section.proposed;
      else if (section.key === "solution") projectPatch.solution = section.proposed;
      else if (section.key === "users") projectPatch.audience = section.proposed;
      else if (section.key === "value") projectPatch.value_proposition = section.proposed;
    }
    const nextSection = chosen.find((s) => s.key === "next");
    if (nextSection) {
      projectPatch.next_step = nextSection.proposed.split("\n")[0].replace(/^[•\-\s]+/, "").slice(0, 500);
    }
    if (Object.keys(projectPatch).length > 0) {
      await session.supabase.from("projects").update(projectPatch).eq("id", projectId);
    }

    // ---- narrative sections -----------------------------------------
    const textSections = chosen.filter((s) => s.kind === "project_section");
    if (textSections.length > 0) {
      await Promise.all(
        textSections.map((section) =>
          session.supabase
            .from("project_sections")
            .upsert(
              {
                workspace_id: session.workspace.id,
                project_id: projectId,
                key: section.key,
                title: section.label,
                content: section.proposed,
                origin: "ai",
                approved_at: new Date().toISOString(),
              },
              { onConflict: "project_id,key" },
            ),
        ),
      );

      const doc = sectionsToDoc(
        textSections.map((s) => ({ title: s.label, content: s.proposed })),
      );
      await session.supabase
        .from("documents")
        .update({ content: doc as unknown as Json, plain_text: docToPlainText(doc) })
        .eq("id", documentId);
      await session.supabase.rpc("snapshot_document", {
        p_document_id: documentId,
        p_label: "Generato da Idea-to-Project",
      });
    }

    // ---- roadmap ------------------------------------------------------
    const milestoneIdByTitle = new Map<string, string>();
    const milestoneSection = chosen.find((s) => s.key === "milestones");
    if (milestoneSection && Array.isArray(milestoneSection.data)) {
      const milestones = milestoneSection.data as IdeaToProjectResult["milestones"];
      const start = new Date();
      const rows = milestones.map((m, index) => {
        const startsOn = new Date(start.getTime() + m.weeksFromStart * 7 * 86_400_000);
        const endsOn = new Date(startsOn.getTime() + m.durationWeeks * 7 * 86_400_000);
        return {
          workspace_id: session.workspace.id,
          project_id: projectId,
          title: m.title.slice(0, 200),
          description: m.description || null,
          status: "planned" as const,
          starts_on: startsOn.toISOString().slice(0, 10),
          ends_on: endsOn.toISOString().slice(0, 10),
          is_estimate: true,
          position: index,
        };
      });
      const { data: created } = await session.supabase
        .from("milestones")
        .insert(rows)
        .select("id, title");
      for (const row of created ?? []) milestoneIdByTitle.set(row.title, row.id);
    }

    // ---- tasks --------------------------------------------------------
    const taskSection = chosen.find((s) => s.key === "tasks");
    if (taskSection && Array.isArray(taskSection.data)) {
      const tasks = taskSection.data as IdeaToProjectResult["tasks"];
      await session.supabase.from("tasks").insert(
        tasks.map((t, index) => ({
          workspace_id: session.workspace.id,
          created_by: session.userId,
          project_id: projectId,
          milestone_id: milestoneIdByTitle.get(t.milestoneTitle) ?? null,
          title: t.title.slice(0, 300),
          priority: t.priority,
          position: index,
          origin_type: "idea" as const,
          origin_id: idea.id,
        })),
      );
    }

    // ---- risks --------------------------------------------------------
    const riskSection = chosen.find((s) => s.key === "risks_list");
    if (riskSection && Array.isArray(riskSection.data)) {
      const risks = riskSection.data as IdeaToProjectResult["risks"];
      await session.supabase.from("risks").insert(
        risks.map((r) => ({
          workspace_id: session.workspace.id,
          project_id: projectId,
          title: r.title.slice(0, 300),
          likelihood: r.likelihood,
          impact: r.impact,
          mitigation: r.mitigation || null,
        })),
      );
    }

    // ---- canvas -------------------------------------------------------
    const mapSection = chosen.find((s) => s.key === "map");
    if (mapSection && mapSection.data) {
      const map = mapSection.data as IdeaToProjectResult["map"];
      const radius = 260;
      const rows = map.nodes.map((node, index) => {
        const angle = (index / Math.max(1, map.nodes.length)) * Math.PI * 2;
        return {
          workspace_id: session.workspace.id,
          canvas_id: canvasId,
          type: node.type,
          label: node.label.slice(0, 200),
          body: node.body || null,
          position_x: node.key === "project" ? 0 : Math.round(Math.cos(angle) * radius),
          position_y: node.key === "project" ? 0 : Math.round(Math.sin(angle) * radius),
          entity_type: node.key === "project" ? ("project" as const) : null,
          entity_id: node.key === "project" ? projectId : null,
        };
      });

      const { data: createdNodes } = await session.supabase
        .from("canvas_nodes")
        .insert(rows)
        .select("id, label");

      const idByLabel = new Map((createdNodes ?? []).map((n) => [n.label, n.id]));
      const keyToLabel = new Map(map.nodes.map((n) => [n.key, n.label.slice(0, 200)]));

      const edgeRows = map.edges
        .map((edge) => {
          const source = idByLabel.get(keyToLabel.get(edge.from) ?? "");
          const target = idByLabel.get(keyToLabel.get(edge.to) ?? "");
          if (!source || !target || source === target) return null;
          return {
            workspace_id: session.workspace.id,
            canvas_id: canvasId,
            source_node_id: source,
            target_node_id: target,
            relation: edge.relation,
            label: edge.label || null,
          };
        })
        .filter((row): row is NonNullable<typeof row> => row !== null);

      if (edgeRows.length > 0) {
        await session.supabase.from("canvas_edges").upsert(edgeRows, {
          onConflict: "canvas_id,source_node_id,target_node_id,relation",
          ignoreDuplicates: true,
        });
      }
    }

    // ---- link the idea, never touching original_content ---------------
    const summarySection = chosen.find((s) => s.key === "vision" || s.key === "solution");
    await session.supabase
      .from("ideas")
      .update({
        project_id: projectId,
        status: "converted",
        summary: idea.summary ?? summarySection?.proposed.slice(0, 500) ?? null,
      })
      .eq("id", idea.id);

    await session.supabase.from("entity_relations").upsert(
      {
        workspace_id: session.workspace.id,
        source_type: "project",
        source_id: projectId,
        target_type: "idea",
        target_id: idea.id,
        relation: "derives_from",
        created_by: session.userId,
      },
      { onConflict: "source_type,source_id,target_type,target_id,relation", ignoreDuplicates: true },
    );

    const rejected = sections.map((s) => s.key).filter((k) => !accepted.has(k));

    await session.supabase
      .from("ai_proposals")
      .update({
        status: rejected.length > 0 ? "partially_applied" : "applied",
        accepted_keys: acceptedKeys,
        rejected_keys: rejected,
        applied_at: new Date().toISOString(),
        undo_payload: {
          projectId,
          idea: {
            id: idea.id,
            status: idea.status,
            project_id: idea.project_id,
            summary: idea.summary,
          },
        } as unknown as Json,
      })
      .eq("id", proposalId);

    await logActivity(session.supabase, {
      workspaceId: session.workspace.id,
      actorId: session.userId,
      action: "converted",
      entityType: "project",
      entityId: projectId,
      summary: `Da idea: ${idea.title}`,
      metadata: { proposalId, acceptedKeys },
    });

    revalidatePath("/projects");
    revalidatePath("/ideas");
    revalidatePath(`/ideas/${idea.id}`);
    revalidatePath("/home");
    return ok({ projectId });
  });
}

export async function undoProposalAction(
  proposalId: string,
): Promise<ActionResult<undefined>> {
  return guard(async () => {
    const parsed = parseInput(uuid, proposalId);
    if (!parsed.ok) return parsed.result;

    const session = await requireWriteSession();
    const { data: proposal } = await session.supabase
      .from("ai_proposals")
      .select("id, status, undo_payload, entity_id")
      .eq("id", parsed.data)
      .eq("workspace_id", session.workspace.id)
      .maybeSingle();

    if (!proposal) return fail("Proposta non trovata.");
    if (!proposal.undo_payload) return fail("Questa proposta non è annullabile.");

    const payload = proposal.undo_payload as {
      projectId?: string;
      idea?: { id: string; status: string; project_id: string | null; summary: string | null };
    };

    if (payload.idea) {
      await session.supabase
        .from("ideas")
        .update({
          status: payload.idea.status as never,
          project_id: payload.idea.project_id,
          summary: payload.idea.summary,
        })
        .eq("id", payload.idea.id)
        .eq("workspace_id", session.workspace.id);
    }

    if (payload.projectId) {
      // Soft delete: the project and everything under it stay recoverable.
      await session.supabase
        .from("projects")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", payload.projectId)
        .eq("workspace_id", session.workspace.id);
    }

    await session.supabase
      .from("ai_proposals")
      .update({ status: "rejected", undo_payload: null })
      .eq("id", parsed.data);

    revalidatePath("/projects");
    revalidatePath("/ideas");
    revalidatePath(`/ideas/${proposal.entity_id}`);
    return ok();
  });
}

export async function rejectProposalAction(
  proposalId: string,
): Promise<ActionResult<undefined>> {
  return guard(async () => {
    const parsed = parseInput(uuid, proposalId);
    if (!parsed.ok) return parsed.result;

    const session = await requireWriteSession();
    const { data, error } = await session.supabase
      .from("ai_proposals")
      .update({ status: "rejected" })
      .eq("id", parsed.data)
      .eq("workspace_id", session.workspace.id)
      .eq("status", "pending")
      .select("entity_id")
      .maybeSingle();

    if (error) return fail(`Operazione non riuscita: ${error.message}`);
    if (data) revalidatePath(`/ideas/${data.entity_id}`);
    return ok();
  });
}

/* ================================================================== */
/* Smaller assists                                                     */
/* ================================================================== */

export async function organizeCaptureAction(
  inboxItemId: string,
): Promise<ActionResult<OrganizeNoteResult & { provider: string }>> {
  return guard(async () => {
    const parsed = parseInput(uuid, inboxItemId);
    if (!parsed.ok) return parsed.result;

    const session = await requireWriteSession();
    const blocked = gate(session, "organize_note");
    if (blocked) return blocked;

    const { data: item } = await session.supabase
      .from("inbox_items")
      .select("id, content, url_title")
      .eq("id", parsed.data)
      .eq("workspace_id", session.workspace.id)
      .maybeSingle();

    if (!item) return fail("Elemento non trovato.");

    try {
      const outcome = await runAiFeature(session.supabase, {
        feature: "organize_note",
        workspaceId: session.workspace.id,
        userId: session.userId,
        plan: session.plan,
        context: {
          locale: "it",
          today: new Date().toISOString().slice(0, 10),
          text: [item.url_title, item.content].filter(Boolean).join("\n"),
        },
        entityType: "inbox_item",
        entityId: item.id,
      });
      return ok({ ...outcome.data, provider: outcome.provider });
    } catch (error) {
      return aiFailure(error);
    }
  });
}

export async function suggestNextStepAction(
  projectId?: string,
): Promise<ActionResult<NextStepResult & { provider: string }>> {
  return guard(async () => {
    const session = await requireWriteSession();
    const blocked = gate(session, "next_step");
    if (blocked) return blocked;

    const context = projectId
      ? {
          locale: "it" as const,
          today: new Date().toISOString().slice(0, 10),
          project:
            (await buildProjectContext(session.supabase, session.workspace.id, projectId)) ??
            undefined,
        }
      : await buildWorkspaceContext(session.supabase, session.workspace.id);

    try {
      const outcome = await runAiFeature(session.supabase, {
        feature: "next_step",
        workspaceId: session.workspace.id,
        userId: session.userId,
        plan: session.plan,
        context,
        entityType: projectId ? "project" : undefined,
        entityId: projectId,
      });
      return ok({ ...outcome.data, provider: outcome.provider });
    } catch (error) {
      return aiFailure(error);
    }
  });
}

export async function summarizeProjectAction(
  projectId: string,
): Promise<ActionResult<SummaryResult & { provider: string }>> {
  return guard(async () => {
    const parsed = parseInput(uuid, projectId);
    if (!parsed.ok) return parsed.result;

    const session = await requireWriteSession();
    const blocked = gate(session, "project_summary");
    if (blocked) return blocked;

    const project = await buildProjectContext(session.supabase, session.workspace.id, parsed.data);
    if (!project) return fail("Progetto non trovato.");

    try {
      const outcome = await runAiFeature(session.supabase, {
        feature: "project_summary",
        workspaceId: session.workspace.id,
        userId: session.userId,
        plan: session.plan,
        context: { locale: "it", today: new Date().toISOString().slice(0, 10), project },
        entityType: "project",
        entityId: parsed.data,
      });
      return ok({ ...outcome.data, provider: outcome.provider });
    } catch (error) {
      return aiFailure(error);
    }
  });
}

export async function weeklySummaryAction(): Promise<
  ActionResult<SummaryResult & { provider: string }>
> {
  return guard(async () => {
    const session = await requireWriteSession();
    const blocked = gate(session, "weekly_summary");
    if (blocked) return blocked;

    const context = await buildWorkspaceContext(session.supabase, session.workspace.id);

    try {
      const outcome = await runAiFeature(session.supabase, {
        feature: "weekly_summary",
        workspaceId: session.workspace.id,
        userId: session.userId,
        plan: session.plan,
        context,
      });
      return ok({ ...outcome.data, provider: outcome.provider });
    } catch (error) {
      return aiFailure(error);
    }
  });
}

export async function missingQuestionsAction(
  ideaId: string,
): Promise<ActionResult<QuestionsResult & { provider: string }>> {
  return guard(async () => {
    const parsed = parseInput(uuid, ideaId);
    if (!parsed.ok) return parsed.result;

    const session = await requireWriteSession();
    const blocked = gate(session, "missing_questions");
    if (blocked) return blocked;

    const context = await buildIdeaContext(session.supabase, session.workspace.id, parsed.data);
    if (!context) return fail("Idea non trovata.");

    try {
      const outcome = await runAiFeature(session.supabase, {
        feature: "missing_questions",
        workspaceId: session.workspace.id,
        userId: session.userId,
        plan: session.plan,
        context,
        entityType: "idea",
        entityId: parsed.data,
      });
      return ok({ ...outcome.data, provider: outcome.provider });
    } catch (error) {
      return aiFailure(error);
    }
  });
}

export async function findSimilarIdeasAction(
  ideaId: string,
): Promise<ActionResult<SimilarIdeasResult & { provider: string; titles: Record<string, string> }>> {
  return guard(async () => {
    const parsed = parseInput(uuid, ideaId);
    if (!parsed.ok) return parsed.result;

    const session = await requireWriteSession();
    const blocked = gate(session, "similar_ideas");
    if (blocked) return blocked;

    const context = await buildIdeaContext(session.supabase, session.workspace.id, parsed.data);
    if (!context?.idea) return fail("Idea non trovata.");

    const { data: candidates } = await session.supabase
      .from("ideas")
      .select("id")
      .eq("workspace_id", session.workspace.id)
      .is("deleted_at", null)
      .neq("id", parsed.data)
      .limit(60);

    const others = await buildIdeasContext(
      session.supabase,
      session.workspace.id,
      (candidates ?? []).map((c) => c.id),
    );

    try {
      const outcome = await runAiFeature(session.supabase, {
        feature: "similar_ideas",
        workspaceId: session.workspace.id,
        userId: session.userId,
        plan: session.plan,
        context: { ...context, ideas: others },
        entityType: "idea",
        entityId: parsed.data,
      });
      return ok({
        ...outcome.data,
        provider: outcome.provider,
        titles: Object.fromEntries(others.map((o) => [o.id, o.title])),
      });
    } catch (error) {
      return aiFailure(error);
    }
  });
}

export async function compareIdeasAction(
  ideaIds: string[],
): Promise<ActionResult<CompareIdeasResult & { provider: string }>> {
  return guard(async () => {
    if (ideaIds.length < 2 || ideaIds.length > 5) {
      return fail("Seleziona da due a cinque idee.");
    }

    const session = await requireWriteSession();
    const blocked = gate(session, "compare_ideas");
    if (blocked) return blocked;

    const ideas = await buildIdeasContext(session.supabase, session.workspace.id, ideaIds);
    if (ideas.length < 2) return fail("Non trovo abbastanza idee da confrontare.");

    try {
      const outcome = await runAiFeature(session.supabase, {
        feature: "compare_ideas",
        workspaceId: session.workspace.id,
        userId: session.userId,
        plan: session.plan,
        context: { locale: "it", today: new Date().toISOString().slice(0, 10), ideas },
      });
      return ok({ ...outcome.data, provider: outcome.provider });
    } catch (error) {
      return aiFailure(error);
    }
  });
}

export async function extractTasksAction(
  input: { text: string; projectId?: string; ideaId?: string },
): Promise<ActionResult<ExtractTasksResult & { provider: string }>> {
  return guard(async () => {
    const session = await requireWriteSession();
    const blocked = gate(session, "extract_tasks");
    if (blocked) return blocked;

    const text = (input.text ?? "").slice(0, 8_000).trim();
    if (text.length < 10) return fail("Serve un testo un po' più lungo.");

    try {
      const outcome = await runAiFeature(session.supabase, {
        feature: "extract_tasks",
        workspaceId: session.workspace.id,
        userId: session.userId,
        plan: session.plan,
        context: { locale: "it", today: new Date().toISOString().slice(0, 10), text },
        entityType: input.projectId ? "project" : input.ideaId ? "idea" : undefined,
        entityId: input.projectId ?? input.ideaId,
      });
      return ok({ ...outcome.data, provider: outcome.provider });
    } catch (error) {
      return aiFailure(error);
    }
  });
}

export async function aiProviderInfoAction(): Promise<
  ActionResult<{ name: string; isMock: boolean }>
> {
  return guard(async () => ok(describeProvider()));
}
