import { type NextRequest, NextResponse } from "next/server";

import { projectToAgenticMarkdown } from "@/lib/domain/agentic-document";
import { getProject } from "@/server/queries/projects";
import { requireSession } from "@/server/session";
import type { CanvasNodeRow } from "@/types/database";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;
  const detail = await getProject(session.supabase, session.workspace.id, id);
  if (!detail?.document) return new NextResponse("Progetto non trovato", { status: 404 });
  const [{ data: document }, { data: nodes }, { data: children }] = await Promise.all([
    session.supabase.from("documents").select("id, content, revision").eq("project_id", id).eq("kind", "agentic").is("deleted_at", null).maybeSingle(),
    detail.canvasId
      ? session.supabase.from("canvas_nodes").select("*").eq("canvas_id", detail.canvasId).order("created_at")
      : Promise.resolve({ data: [] }),
    session.supabase.from("projects").select("id, name, status, progress").eq("parent_project_id", id).is("deleted_at", null),
  ]);
  const markdown = projectToAgenticMarkdown({
    project: detail.project,
    documentId: document?.id ?? detail.document.id,
    documentRevision: document?.revision ?? detail.document.revision,
    content: (document?.content ?? { type: "doc", content: [] }) as never,
    goals: detail.goals,
    milestones: detail.milestones,
    tasks: detail.tasks,
    decisions: detail.decisions,
    risks: detail.risks,
    resources: detail.resources,
    canvasNodes: (nodes ?? []) as CanvasNodeRow[],
    children: children ?? [],
  });
  const slug = detail.project.name.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").toLowerCase();
  return new NextResponse(markdown, { headers: {
    "Content-Type": "text/markdown; charset=utf-8",
    "Content-Disposition": `attachment; filename="${slug || "progetto"}-agentico.md"`,
    "Cache-Control": "no-store",
  }});
}
