import { docToMarkdown, type TipTapNode } from "@/lib/domain/tiptap";
import { agenticTemplateMarkdown } from "@/lib/domain/agentic-template";
import { AGENTIC_SCHEMA_VERSION, managedAgenticBlock, type AgenticEntity } from "@/lib/domain/agentic-sync";
import type { CanvasNodeRow, DecisionRow, GoalRow, MilestoneRow, ProjectRow, ResourceRow, RiskRow, TaskRow } from "@/types/database";
import { toolKindLabel } from "@/lib/domain/tool-kinds";

export type AgenticProjectSnapshot = {
  project: ProjectRow;
  documentId: string;
  documentRevision: number;
  content: TipTapNode;
  goals: GoalRow[];
  milestones: MilestoneRow[];
  tasks: TaskRow[];
  decisions: DecisionRow[];
  risks: RiskRow[];
  resources: ResourceRow[];
  canvasNodes: CanvasNodeRow[];
  children?: Array<Pick<ProjectRow, "id" | "name" | "status" | "progress">>;
};

/** Builds the portable source of truth from the narrative plus live project entities. */
export function projectToAgenticMarkdown(snapshot: AgenticProjectSnapshot): string {
  const { project } = snapshot;
  const narrative = docToMarkdown(snapshot.content);
  const lines = [narrative || agenticTemplateMarkdown(project.name), "", "---", "", "## Appendice — Stato sincronizzato da Mindraft", "",
    `> Aggiornato: ${new Date().toISOString()}`,
    `> Stato: ${project.status} · Salute: ${project.health} · Avanzamento: ${project.progress}%`,
  ];
  if (project.next_step) lines.push(`> Prossimo passo: ${project.next_step}`);
  if (project.scope_in) lines.push(`> Ambito: ${project.scope_in}`);
  if (project.tool_kind) lines.push(`> Tipo strumento: ${toolKindLabel(project.tool_kind)}`);
  if (project.vision || project.problem || project.solution) {
    lines.push("", "### Sintesi corrente", "");
    if (project.vision) lines.push(`- Visione: ${project.vision}`);
    if (project.problem) lines.push(`- Problema: ${project.problem}`);
    if (project.solution) lines.push(`- Soluzione: ${project.solution}`);
  }
  lines.push("", "### Obiettivi", "");
  lines.push(...(snapshot.goals.length ? snapshot.goals.map((g) => `- [${g.is_achieved ? "x" : " "}] ${g.title}${g.target_value ? ` — target: ${g.target_value}` : ""}`) : ["_Nessun obiettivo._"]));
  lines.push("", "### Roadmap", "");
  lines.push(...(snapshot.milestones.length ? snapshot.milestones.map((m) => `- ${m.title} — ${m.status}${m.ends_on ? `, entro ${m.ends_on}` : ""}`) : ["_Nessuna milestone._"]));
  lines.push("", "### Attività", "");
  lines.push(...(snapshot.tasks.length ? snapshot.tasks.map((t) => `- [${t.status === "done" ? "x" : " "}] ${t.title} (${t.priority})`) : ["_Nessuna attività._"]));
  lines.push("", "### Canvas", "");
  lines.push(...(snapshot.canvasNodes.length ? snapshot.canvasNodes.map((n) => `- ${n.label} [${n.type}]${n.body ? ` — ${n.body}` : ""}`) : ["_Nessun nodo._"]));
  if (snapshot.children?.length) {
    lines.push("", "### Sottoprogetti", "", ...snapshot.children.map((p) => `- ${p.name} — ${p.status}, ${p.progress}%`));
  }
  const entities: AgenticEntity[] = [
    ...snapshot.goals.map((row) => ({ id: row.id, entity_type: "goal" as const, revision: row.revision, title: row.title, description: row.description ?? undefined, status: row.is_achieved ? "achieved" : "open" })),
    ...snapshot.milestones.map((row) => ({ id: row.id, entity_type: "milestone" as const, revision: row.revision, title: row.title, description: row.description ?? undefined, status: row.status })),
    ...snapshot.tasks.map((row) => ({ id: row.id, entity_type: "task" as const, revision: row.revision, title: row.title, description: row.description ?? undefined, status: row.status, priority: row.priority })),
    ...snapshot.decisions.map((row) => ({ id: row.id, entity_type: "decision" as const, revision: row.revision, title: row.title, description: row.context ?? undefined, status: row.status })),
    ...snapshot.risks.map((row) => ({ id: row.id, entity_type: "risk" as const, revision: row.revision, title: row.title, description: row.description ?? undefined, status: row.is_open ? "open" : "closed" })),
    ...snapshot.resources.map((row) => ({ id: row.id, entity_type: "resource" as const, revision: row.revision, title: row.title, description: row.notes ?? undefined, status: row.kind })),
    ...snapshot.canvasNodes.map((row) => ({ id: row.id, entity_type: "canvas_node" as const, revision: row.revision, title: row.label, description: row.body ?? undefined, status: row.type })),
  ];
  lines.push("", "## Stato sincronizzato", "", managedAgenticBlock({
    schema_version: AGENTIC_SCHEMA_VERSION,
    project_id: project.id,
    document_id: snapshot.documentId,
    document_revision: snapshot.documentRevision,
    exported_at: new Date().toISOString(),
  }, entities));
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}
