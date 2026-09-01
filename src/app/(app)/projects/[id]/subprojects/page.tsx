import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, GitBranch, ListTodo, Scale } from "lucide-react";

import { NewProjectButton } from "@/components/projects/new-project-button";
import { RelativeTime } from "@/components/common/relative-time";
import { StatusBadge } from "@/components/common/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import { PROJECT_HEALTH_MAP, PROJECT_STATUS_MAP } from "@/lib/domain/constants";
import { getProjectHeader, listProjects } from "@/server/queries/projects";
import { requireSession } from "@/server/session";

export const metadata = { title: "Sottoprogetti" };

export default async function SubprojectsPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;
  const [parent, subprojects] = await Promise.all([
    getProjectHeader(session.supabase, session.workspace.id, id),
    listProjects(session.supabase, session.workspace.id, { parentProjectId: id, excludeTools: true, limit: 100 }),
  ]);
  if (!parent) notFound();

  const averageProgress = subprojects.length
    ? Math.round(subprojects.reduce((sum, project) => sum + project.progress, 0) / subprojects.length)
    : 0;
  const openTasks = subprojects.reduce((sum, project) => sum + project.openTasks, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold">Sottoprogetti</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Progetti autonomi che ereditano contesto e dipendenze da {parent.name}.
          </p>
        </div>
        {session.canWrite && <NewProjectButton parentProjectId={id} parentProjectName={parent.name} />}
      </div>

      {subprojects.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Card><CardContent className="p-4"><p className="text-[11px] uppercase tracking-wide text-muted-foreground">Sottoprogetti</p><p className="mt-1 text-2xl font-semibold">{subprojects.length}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-[11px] uppercase tracking-wide text-muted-foreground">Avanzamento medio</p><div className="mt-2 flex items-center gap-2"><Progress value={averageProgress} className="flex-1" /><span className="text-sm font-medium">{averageProgress}%</span></div></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-[11px] uppercase tracking-wide text-muted-foreground">Attività aperte</p><p className="mt-1 text-2xl font-semibold">{openTasks}</p></CardContent></Card>
        </div>
      )}

      {subprojects.length === 0 ? (
        <EmptyState
          icon={GitBranch}
          title="Nessun sottoprogetto"
          description="Dividi il progetto in aree autonome senza perdere relazioni, tag e dipendenze."
          action={session.canWrite ? <NewProjectButton parentProjectId={id} parentProjectName={parent.name} /> : undefined}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {subprojects.map((project) => (
            <Card key={project.id} className="group transition hover:-translate-y-0.5 hover:shadow-raised">
              <CardHeader>
                <div className="flex min-w-0 items-start gap-2.5">
                  <span className="text-2xl" aria-hidden>{project.emoji ?? "🧩"}</span>
                  <div className="min-w-0 flex-1">
                    <CardTitle className="truncate">{project.name}</CardTitle>
                    {project.short_description && <p className="mt-1 line-clamp-2 text-[12px] text-muted-foreground">{project.short_description}</p>}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  <StatusBadge descriptor={PROJECT_STATUS_MAP[project.status]} />
                  {project.health !== "unknown" && <StatusBadge descriptor={PROJECT_HEALTH_MAP[project.health]} />}
                </div>
                <div className="flex items-center gap-2"><Progress value={project.progress} className="flex-1" /><span className="text-xs tabular-nums">{project.progress}%</span></div>
                <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1"><ListTodo className="size-3.5" /> {project.openTasks} aperte</span>
                  <span className="flex items-center gap-1"><Scale className="size-3.5" /> {project.openDecisions} decisioni</span>
                </div>
                <div className="flex items-center justify-between border-t border-border pt-3">
                  <RelativeTime value={project.last_activity_at} className="text-[11px] text-subtle-foreground" />
                  <Link href={`/projects/${project.id}`} className="flex items-center gap-1 text-[12px] font-medium text-primary hover:underline">Apri <ArrowRight className="size-3.5" /></Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
