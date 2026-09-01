import Link from "next/link";
import { FolderKanban } from "lucide-react";

import { NewProjectButton } from "@/components/projects/new-project-button";
import { PageHeader } from "@/components/common/page-header";
import { RelativeTime } from "@/components/common/relative-time";
import { StatusBadge } from "@/components/common/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import { PROJECT_HEALTH_MAP, PROJECT_STATUS_MAP, PROJECT_STATUSES } from "@/lib/domain/constants";
import { listProjects } from "@/server/queries/projects";
import { requireSession } from "@/server/session";
import type { ProjectStatus } from "@/types/database";

export const metadata = { title: "Progetti" };

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const session = await requireSession();
  const params = await searchParams;
  const statuses = (params.status ?? "").split(",").filter(Boolean) as ProjectStatus[];

  const projects = await listProjects(session.supabase, session.workspace.id, {
    statuses: statuses.length > 0 ? statuses : null,
    search: params.q ?? null,
    includeArchived: statuses.includes("archived"),
    rootOnly: true,
  });

  return (
    <>
      <PageHeader
        title="Progetti"
        description="Ogni progetto conserva il collegamento all'idea da cui è nato."
        actions={<NewProjectButton />}
      />

      <nav className="mb-4 flex flex-wrap gap-1.5" aria-label="Filtra per stato">
        <Link
          href="/projects"
          aria-current={statuses.length === 0 ? "true" : undefined}
          className={
            statuses.length === 0
              ? "rounded-full border border-primary bg-brand-50 px-3 py-1 text-[12px] font-medium text-brand-700 dark:bg-brand-900/40 dark:text-brand-100"
              : "rounded-full border border-border bg-surface px-3 py-1 text-[12px] font-medium text-muted-foreground hover:border-border-strong"
          }
        >
          Attivi
        </Link>
        {PROJECT_STATUSES.map((status) => {
          const active = statuses.includes(status.value);
          return (
            <Link
              key={status.value}
              href={`/projects?status=${status.value}`}
              aria-current={active ? "true" : undefined}
              className={
                active
                  ? "rounded-full border border-primary bg-brand-50 px-3 py-1 text-[12px] font-medium text-brand-700 dark:bg-brand-900/40 dark:text-brand-100"
                  : "rounded-full border border-border bg-surface px-3 py-1 text-[12px] font-medium text-muted-foreground hover:border-border-strong"
              }
            >
              {status.label}
            </Link>
          );
        })}
      </nav>

      {projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="Nessun progetto"
          description="Un progetto nasce meglio da un'idea già scritta: la trasformazione conserva il contesto."
          action={<NewProjectButton />}
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <li key={project.id} className="surface-card transition-shadow hover:shadow-raised">
              <Link href={`/projects/${project.id}`} className="block p-4">
                <div className="flex items-start gap-2.5">
                  <span className="text-xl" aria-hidden>
                    {project.emoji ?? "🧩"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-display text-[14px] font-semibold">
                      {project.name}
                    </h3>
                    {project.short_description && (
                      <p className="mt-0.5 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">
                        {project.short_description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <StatusBadge descriptor={PROJECT_STATUS_MAP[project.status]} />
                  {project.health !== "unknown" && (
                    <StatusBadge descriptor={PROJECT_HEALTH_MAP[project.health]} />
                  )}
                </div>

                {project.next_step && (
                  <p className="mt-2.5 line-clamp-1 text-[12px] text-muted-foreground">
                    Prossimo passo: {project.next_step}
                  </p>
                )}

                <div className="mt-3 flex items-center gap-2">
                  <Progress value={project.progress} className="flex-1" />
                  <span className="text-[11px] tabular-nums text-subtle-foreground">
                    {project.progress}%
                  </span>
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-border pt-2.5 text-[11px] text-subtle-foreground">
                  <span>
                    {project.openTasks} attività aperte
                    {project.openDecisions > 0 && ` · ${project.openDecisions} decisioni`}
                  </span>
                  <RelativeTime value={project.last_activity_at} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
