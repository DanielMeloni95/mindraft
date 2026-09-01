import { docToMarkdown, type TipTapNode } from "@/lib/domain/tiptap";
import { agenticTemplateMarkdown } from "@/lib/domain/agentic-template";
import type { CanvasNodeRow, GoalRow, MilestoneRow, ProjectRow, TaskRow } from "@/types/database";

export type AgenticProjectSnapshot = {
  project: ProjectRow;
  content: TipTapNode;
  goals: GoalRow[];
  milestones: MilestoneRow[];
  tasks: TaskRow[];
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
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}
