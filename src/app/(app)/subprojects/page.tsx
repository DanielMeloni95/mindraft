import Link from "next/link";
import { ArrowRight, GitBranch } from "lucide-react";

import { PageHeader } from "@/components/common/page-header";
import { RelativeTime } from "@/components/common/relative-time";
import { StatusBadge } from "@/components/common/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import { PROJECT_STATUS_MAP } from "@/lib/domain/constants";
import { listProjectOptions, listProjects } from "@/server/queries/projects";
import { requireSession } from "@/server/session";

export const metadata = { title: "Sottoprogetti" };

export default async function AllSubprojectsPage() {
  const session = await requireSession();
  const [subprojects, projects] = await Promise.all([
    listProjects(session.supabase, session.workspace.id, { subprojectsOnly: true, excludeTools: true, limit: 200 }),
    listProjectOptions(session.supabase, session.workspace.id),
  ]);
  const names = new Map(projects.map((project) => [project.id, project]));

  return (
    <>
      <PageHeader title="Sottoprogetti" description="Tutti i progetti figli del workspace, organizzati con il relativo progetto padre." />
      {subprojects.length === 0 ? (
        <EmptyState icon={GitBranch} title="Nessun sottoprogetto" description="Puoi crearne uno dal canvas o dalla tab Sottoprogetti di un progetto." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {subprojects.map((project) => {
            const parent = project.parent_project_id ? names.get(project.parent_project_id) : null;
            return (
              <article key={project.id} className="surface-card p-4 transition hover:-translate-y-0.5 hover:shadow-raised">
                <div className="flex items-start gap-2.5">
                  <span className="text-2xl" aria-hidden>{project.emoji ?? "🧩"}</span>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate font-display text-sm font-semibold">{project.name}</h2>
                    {parent && <Link href={`/projects/${parent.id}/subprojects`} className="mt-0.5 block truncate text-[11px] text-muted-foreground hover:underline">Figlio di {parent.emoji ?? "📁"} {parent.name}</Link>}
                  </div>
                  <StatusBadge descriptor={PROJECT_STATUS_MAP[project.status]} />
                </div>
                {project.short_description && <p className="mt-3 line-clamp-2 text-[12px] text-muted-foreground">{project.short_description}</p>}
                <div className="mt-3 flex items-center gap-2"><Progress value={project.progress} className="flex-1" /><span className="text-xs">{project.progress}%</span></div>
                <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                  <RelativeTime value={project.last_activity_at} className="text-[11px] text-subtle-foreground" />
                  <Link href={`/projects/${project.id}`} className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">Apri <ArrowRight className="size-3.5" /></Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
