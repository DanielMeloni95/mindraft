import { NextResponse, type NextRequest } from "next/server";

import { docToMarkdown } from "@/lib/domain/tiptap";
import { checkRateLimit } from "@/server/rate-limit";
import { getSessionContext } from "@/server/session";

export const dynamic = "force-dynamic";

/**
 * Full export of the workspace the user is in.
 *
 * JSON keeps every relation (ids are preserved), Markdown is meant to be
 * read, CSV is meant to be opened in a spreadsheet. No lock-in: this is
 * the same data the app itself reads.
 */
export async function GET(request: NextRequest) {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const limiter = checkRateLimit(`${session.userId}:export`, {
    limit: 5,
    windowMs: 60_000,
  });
  if (!limiter.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(limiter.retryAfterSeconds) } },
    );
  }

  const format = request.nextUrl.searchParams.get("format") ?? "json";
  const workspaceId = session.workspace.id;
  const supabase = session.supabase;

  const [
    { data: ideas },
    { data: projects },
    { data: documents },
    { data: tasks },
    { data: decisions },
    { data: milestones },
    { data: risks },
    { data: resources },
    { data: relations },
    { data: canvases },
    { data: nodes },
    { data: edges },
    { data: scores },
    { data: reviews },
  ] = await Promise.all([
    supabase.from("ideas").select("*").eq("workspace_id", workspaceId),
    supabase.from("projects").select("*").eq("workspace_id", workspaceId),
    supabase.from("documents").select("*").eq("workspace_id", workspaceId),
    supabase.from("tasks").select("*").eq("workspace_id", workspaceId),
    supabase.from("decisions").select("*").eq("workspace_id", workspaceId),
    supabase.from("milestones").select("*").eq("workspace_id", workspaceId),
    supabase.from("risks").select("*").eq("workspace_id", workspaceId),
    supabase.from("resources").select("*").eq("workspace_id", workspaceId),
    supabase.from("entity_relations").select("*").eq("workspace_id", workspaceId),
    supabase.from("canvases").select("*").eq("workspace_id", workspaceId),
    supabase.from("canvas_nodes").select("*").eq("workspace_id", workspaceId),
    supabase.from("canvas_edges").select("*").eq("workspace_id", workspaceId),
    supabase.from("idea_scores").select("*").eq("workspace_id", workspaceId),
    supabase.from("weekly_reviews").select("*").eq("workspace_id", workspaceId),
  ]);

  const stamp = new Date().toISOString().slice(0, 10);
  const base = `mindraft-${session.workspace.slug}-${stamp}`;

  if (format === "json") {
    const payload = {
      exportedAt: new Date().toISOString(),
      workspace: {
        id: session.workspace.id,
        name: session.workspace.name,
        slug: session.workspace.slug,
      },
      ideas,
      ideaScores: scores,
      projects,
      documents,
      milestones,
      tasks,
      decisions,
      risks,
      resources,
      relations,
      canvases,
      canvasNodes: nodes,
      canvasEdges: edges,
      weeklyReviews: reviews,
    };

    return new NextResponse(JSON.stringify(payload, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${base}.json"`,
      },
    });
  }

  if (format === "csv") {
    const rows: string[][] = [
      ["tipo", "id", "titolo", "stato", "progetto", "aggiornato"],
      ...(ideas ?? []).map((idea) => [
        "idea",
        idea.id,
        idea.title,
        idea.status,
        idea.project_id ?? "",
        idea.updated_at,
      ]),
      ...(projects ?? []).map((project) => [
        "progetto",
        project.id,
        project.name,
        project.status,
        project.id,
        project.updated_at,
      ]),
      ...(tasks ?? []).map((task) => [
        "attività",
        task.id,
        task.title,
        task.status,
        task.project_id ?? "",
        task.updated_at,
      ]),
      ...(decisions ?? []).map((decision) => [
        "decisione",
        decision.id,
        decision.title,
        decision.status,
        decision.project_id ?? "",
        decision.updated_at,
      ]),
    ];

    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    return new NextResponse(`﻿${csv}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${base}.csv"`,
      },
    });
  }

  // Markdown
  const lines: string[] = [
    `# Mindraft — ${session.workspace.name}`,
    "",
    `Esportato il ${new Date().toLocaleDateString("it-IT")}.`,
    "",
    "## Idee",
    "",
  ];

  for (const idea of ideas ?? []) {
    lines.push(`### ${idea.title}`, "");
    lines.push(`- Stato: ${idea.status} · Maturità: ${idea.maturity}`);
    if (idea.category) lines.push(`- Categoria: ${idea.category}`);
    if (idea.project_id) lines.push(`- Progetto collegato: ${idea.project_id}`);
    lines.push("", "**Testo originale**", "", idea.original_content, "");
    if (idea.summary) lines.push("**Sintesi**", "", idea.summary, "");
    if (idea.problem) lines.push("**Problema**", "", idea.problem, "");
    if (idea.solution) lines.push("**Soluzione**", "", idea.solution, "");
  }

  lines.push("## Progetti", "");
  for (const project of projects ?? []) {
    lines.push(`### ${project.emoji ?? ""} ${project.name}`.trim(), "");
    lines.push(`- Stato: ${project.status} · Avanzamento: ${project.progress}%`);
    if (project.source_idea_id) lines.push(`- Nato dall'idea: ${project.source_idea_id}`);
    if (project.next_step) lines.push(`- Prossimo passo: ${project.next_step}`);
    lines.push("");
    if (project.vision) lines.push("**Visione**", "", project.vision, "");
    if (project.problem) lines.push("**Problema**", "", project.problem, "");
    if (project.solution) lines.push("**Soluzione**", "", project.solution, "");

    const document = (documents ?? []).find((doc) => doc.project_id === project.id);
    if (document) {
      lines.push("**Documento**", "", docToMarkdown(document.content), "");
    }

    const projectMilestones = (milestones ?? []).filter((m) => m.project_id === project.id);
    if (projectMilestones.length > 0) {
      lines.push("**Roadmap**", "");
      for (const milestone of projectMilestones) {
        lines.push(
          `- ${milestone.title} (${milestone.starts_on ?? "—"} → ${milestone.ends_on ?? "—"})${milestone.is_estimate ? " *stima*" : ""}`,
        );
      }
      lines.push("");
    }

    const projectTasks = (tasks ?? []).filter((task) => task.project_id === project.id);
    if (projectTasks.length > 0) {
      lines.push("**Attività**", "");
      for (const task of projectTasks) {
        lines.push(`- [${task.status === "done" ? "x" : " "}] ${task.title}`);
      }
      lines.push("");
    }

    const projectDecisions = (decisions ?? []).filter((d) => d.project_id === project.id);
    if (projectDecisions.length > 0) {
      lines.push("**Decisioni**", "");
      for (const decision of projectDecisions) {
        lines.push(`- ${decision.title} — ${decision.status}`);
        if (decision.rationale) lines.push(`  - Motivazione: ${decision.rationale}`);
      }
      lines.push("");
    }
  }

  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${base}.md"`,
    },
  });
}
