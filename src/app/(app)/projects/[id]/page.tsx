import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, CheckSquare, Lightbulb, Scale, Target } from "lucide-react";

import { NextStepCard } from "@/components/ai/next-step-card";
import { ProjectSummaryCard } from "@/components/projects/project-summary-card";
import { NextStepEditor } from "@/components/projects/next-step-editor";
import { ProjectDetailsForm } from "@/components/projects/project-details-form";
import { RelativeTime } from "@/components/common/relative-time";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SEVERITY_MAP, TASK_STATUS_MAP } from "@/lib/domain/constants";
import { activityFor, getProject } from "@/server/queries/projects";
import { requireSession } from "@/server/session";

export const metadata = { title: "Overview" };

export default async function ProjectOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;

  const detail = await getProject(session.supabase, session.workspace.id, id);
  if (!detail) notFound();

  const openTasks = detail.tasks.filter((task) => task.status !== "done");
  const openDecisions = detail.decisions.filter((d) => d.status === "proposed");
  const openRisks = detail.risks.filter((risk) => risk.is_open);
  const activity = await activityFor(session.supabase, session.workspace.id, id, 6);

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-5">
        <Card>
          <CardHeader>
            <CardTitle>Prossimo passo</CardTitle>
          </CardHeader>
          <CardContent>
            <NextStepEditor projectId={id} value={detail.project.next_step} />
          </CardContent>
        </Card>

        {detail.project.vision && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="size-4 text-muted-foreground" aria-hidden /> Obiettivo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-[14px] leading-relaxed">{detail.project.vision}</p>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckSquare className="size-4 text-muted-foreground" aria-hidden />
                Attività aperte
              </CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/projects/${id}/tasks`}>Apri</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {openTasks.length === 0 ? (
                <p className="text-[13px] text-muted-foreground">Nessuna attività aperta.</p>
              ) : (
                <ul className="space-y-2">
                  {openTasks.slice(0, 5).map((task) => (
                    <li key={task.id} className="flex items-start gap-2 text-[13px]">
                      <span className="min-w-0 flex-1 truncate">{task.title}</span>
                      <StatusBadge descriptor={TASK_STATUS_MAP[task.status]} />
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Scale className="size-4 text-muted-foreground" aria-hidden />
                Decisioni da chiudere
              </CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/projects/${id}/decisions`}>Apri</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {openDecisions.length === 0 ? (
                <p className="text-[13px] text-muted-foreground">
                  Nessuna decisione in sospeso.
                </p>
              ) : (
                <ul className="space-y-2">
                  {openDecisions.slice(0, 5).map((decision) => (
                    <li key={decision.id} className="truncate text-[13px]">
                      {decision.title}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        {openRisks.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="size-4 text-warning" aria-hidden /> Rischi principali
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2.5">
                {openRisks.slice(0, 4).map((risk) => (
                  <li key={risk.id}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[13px] font-medium">{risk.title}</span>
                      <StatusBadge
                        descriptor={SEVERITY_MAP[risk.impact]}
                        title={`Impatto ${SEVERITY_MAP[risk.impact].label.toLowerCase()}`}
                      />
                    </div>
                    {risk.mitigation && (
                      <p className="mt-0.5 text-[12px] text-muted-foreground">
                        Mitigazione: {risk.mitigation}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        <ProjectDetailsForm project={detail.project} />
      </div>

      <div className="space-y-4">
        <ProjectSummaryCard projectId={id} />
        <NextStepCard projectId={id} />

        {detail.sourceIdea && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="size-4 text-muted-foreground" aria-hidden />
                Idea di origine
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Link
                href={`/ideas/${detail.sourceIdea.id}`}
                className="text-[13px] font-medium hover:underline"
              >
                {detail.sourceIdea.title}
              </Link>
              <p className="mt-1 text-[12px] text-muted-foreground">
                Il testo che hai scritto all&apos;inizio è ancora lì, invariato.
              </p>
            </CardContent>
          </Card>
        )}

        {detail.goals.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Risultati misurabili</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2.5">
                {detail.goals.map((goal) => (
                  <li key={goal.id} className="text-[13px]">
                    <span className="block font-medium">{goal.title}</span>
                    {goal.metric && (
                      <span className="block text-[12px] text-muted-foreground">
                        {goal.current_value ?? "—"} / {goal.target_value ?? "—"} {goal.metric}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Ultimi aggiornamenti</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/projects/${id}/history`}>Tutto</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {activity.length === 0 ? (
              <EmptyState
                title="Ancora nessuna attività"
                description="Le modifiche importanti compaiono qui."
                className="border-0 bg-transparent px-0 py-2"
              />
            ) : (
              <ul className="space-y-2">
                {activity.map((entry) => (
                  <li key={entry.id} className="text-[12px]">
                    <span className="text-foreground">{entry.summary ?? entry.action}</span>
                    <RelativeTime
                      value={entry.created_at}
                      className="ml-1.5 text-subtle-foreground"
                    />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
