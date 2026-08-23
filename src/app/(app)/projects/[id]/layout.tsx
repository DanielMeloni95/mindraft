import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { ProjectTabs } from "@/components/projects/project-tabs";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { PROJECT_HEALTH_MAP, PROJECT_STATUS_MAP } from "@/lib/domain/constants";
import { getProjectHeader } from "@/server/queries/projects";
import { requireSession } from "@/server/session";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;

  const project = await getProjectHeader(session.supabase, session.workspace.id, id);
  if (!project) notFound();

  return (
    <>
      <div className="mb-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/projects">
            <ArrowLeft /> Progetti
          </Link>
        </Button>
      </div>

      <header className="mb-4">
        <div className="flex flex-wrap items-start gap-3">
          <span className="text-2xl" aria-hidden>
            {project.emoji ?? "🧩"}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-xl font-semibold tracking-tight sm:text-2xl">
              {project.name}
            </h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <StatusBadge descriptor={PROJECT_STATUS_MAP[project.status]} />
              {project.health !== "unknown" && (
                <StatusBadge descriptor={PROJECT_HEALTH_MAP[project.health]} />
              )}
              <span className="flex items-center gap-2">
                <Progress value={project.progress} className="w-24" />
                <span className="text-[11px] tabular-nums text-subtle-foreground">
                  {project.progress}%
                </span>
              </span>
            </div>
          </div>
        </div>
      </header>

      <ProjectTabs projectId={id} />

      <div className="mt-5">{children}</div>
    </>
  );
}
