import Link from "next/link";
import { ArrowRight, Wrench } from "lucide-react";

import { PageHeader } from "@/components/common/page-header";
import { RelativeTime } from "@/components/common/relative-time";
import { StatusBadge } from "@/components/common/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import { PROJECT_STATUS_MAP } from "@/lib/domain/constants";
import { toolKindLabel } from "@/lib/domain/tool-kinds";
import { listProjectOptions, listToolProjects } from "@/server/queries/projects";
import { requireSession } from "@/server/session";

export const metadata = { title: "Strumenti" };

export default async function ToolsPage() {
  const session = await requireSession();
  const [tools, projects] = await Promise.all([
    listToolProjects(session.supabase, session.workspace.id),
    listProjectOptions(session.supabase, session.workspace.id),
  ]);
  const names = new Map(projects.map((project) => [project.id, project]));

  return <>
    <PageHeader title="Strumenti" description="Gli strumenti creati nei canvas, gestiti come progetti collegati al loro progetto di origine." />
    {!tools.length ? <EmptyState icon={Wrench} title="Nessuno strumento" description="Aggiungi un nodo Strumento nel canvas di un progetto per crearlo qui." /> :
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{tools.map((tool) => {
        const parent = tool.parent_project_id ? names.get(tool.parent_project_id) : null;
        return <article key={tool.id} className="surface-card p-4 transition hover:-translate-y-0.5 hover:shadow-raised">
          <div className="flex items-start gap-2.5"><span className="text-2xl">{tool.emoji ?? "🛠️"}</span>
            <div className="min-w-0 flex-1"><h2 className="truncate font-display text-sm font-semibold">{tool.name}</h2>
              {parent && <Link href={`/projects/${parent.id}/canvas`} className="text-[11px] text-muted-foreground hover:underline">Usato in {parent.name}</Link>}
            </div><span className="rounded-full border border-border bg-surface-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{toolKindLabel(tool.tool_kind ?? "tool")}</span><StatusBadge descriptor={PROJECT_STATUS_MAP[tool.status]} /></div>
          {tool.short_description && <p className="mt-3 line-clamp-2 text-[12px] text-muted-foreground">{tool.short_description}</p>}
          <div className="mt-3 flex items-center gap-2"><Progress value={tool.progress} className="flex-1" /><span className="text-xs">{tool.progress}%</span></div>
          <div className="mt-3 flex items-center justify-between border-t border-border pt-3"><RelativeTime value={tool.last_activity_at} className="text-[11px] text-subtle-foreground" />
            <Link href={`/projects/${tool.id}`} className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">Apri <ArrowRight className="size-3.5" /></Link></div>
        </article>;
      })}</div>}
  </>;
}
