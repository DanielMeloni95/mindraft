import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  CheckSquare,
  Inbox,
  Lightbulb,
  Scale,
  TimerReset,
} from "lucide-react";

import { PageHeader } from "@/components/common/page-header";
import { RelativeTime } from "@/components/common/relative-time";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import { QuickCapture } from "@/components/app-shell/quick-capture";
import { NextStepCard } from "@/components/ai/next-step-card";
import {
  IDEA_STATUS_MAP,
  PROJECT_HEALTH_MAP,
  PROJECT_STATUS_MAP,
} from "@/lib/domain/constants";
import { truncate } from "@/lib/utils";
import { getDashboardData } from "@/server/queries/dashboard";
import { listProjectOptions } from "@/server/queries/projects";
import { requireSession } from "@/server/session";

export const metadata = { title: "Home" };

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 6) return "Notte fonda";
  if (hour < 12) return "Buongiorno";
  if (hour < 18) return "Buon pomeriggio";
  return "Buonasera";
}

export default async function HomePage() {
  const session = await requireSession();
  const [data, projects] = await Promise.all([
    getDashboardData(
      session.supabase,
      session.workspace.id,
      session.profile?.full_name ?? null,
    ),
    listProjectOptions(session.supabase, session.workspace.id),
  ]);

  const firstName = data.greetingName?.split(" ")[0];

  return (
    <>
      <PageHeader
        title={firstName ? `${greeting()}, ${firstName}` : greeting()}
        description="Cosa richiede attenzione, dove ti eri fermato, qual è il prossimo passo."
      />

      <section className="surface-card mb-6 p-4" aria-label="Cattura rapida">
        <QuickCapture projects={projects} />
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Continua da qui</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href={data.continueFrom.href}>
                  Apri <ArrowRight />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              <p className="text-[15px] leading-relaxed text-foreground">
                {data.continueFrom.label}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Progetti attivi</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/projects">Tutti</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {data.activeProjects.length === 0 ? (
                <EmptyState
                  title="Nessun progetto attivo"
                  description="Un progetto nasce da un'idea. Comincia da lì."
                  action={
                    <Button variant="primary" size="sm" asChild>
                      <Link href="/ideas">Vai alle idee</Link>
                    </Button>
                  }
                />
              ) : (
                <ul className="divide-y divide-border">
                  {data.activeProjects.map((project) => (
                    <li key={project.id} className="py-3 first:pt-0 last:pb-0">
                      <Link
                        href={`/projects/${project.id}`}
                        className="group flex items-start gap-3 rounded-[var(--radius-md)] px-1 py-1 transition-colors hover:bg-surface-muted"
                      >
                        <span className="mt-0.5 text-lg" aria-hidden>
                          {project.emoji ?? "🧩"}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="truncate text-[14px] font-medium">
                              {project.name}
                            </span>
                            <StatusBadge descriptor={PROJECT_STATUS_MAP[project.status]} />
                            {project.health !== "unknown" && (
                              <StatusBadge descriptor={PROJECT_HEALTH_MAP[project.health]} />
                            )}
                          </span>
                          {project.next_step && (
                            <span className="mt-0.5 block truncate text-[13px] text-muted-foreground">
                              Prossimo passo: {project.next_step}
                            </span>
                          )}
                          <span className="mt-2 flex items-center gap-2">
                            <Progress value={project.progress} className="max-w-40" />
                            <span className="text-[11px] tabular-nums text-subtle-foreground">
                              {project.progress}%
                            </span>
                            <span className="text-[11px] text-subtle-foreground">
                              · aggiornato <RelativeTime value={project.last_activity_at} />
                            </span>
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Attività in scadenza</CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/tasks">Tutte</Link>
                </Button>
              </CardHeader>
              <CardContent>
                {data.dueTasks.length === 0 ? (
                  <p className="text-[13px] text-muted-foreground">
                    Niente in scadenza nei prossimi sette giorni.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {data.dueTasks.slice(0, 5).map((task) => {
                      const overdue =
                        task.due_date !== null &&
                        task.due_date < new Date().toISOString().slice(0, 10);
                      return (
                        <li key={task.id} className="flex items-start gap-2 text-[13px]">
                          <CheckSquare
                            className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
                            aria-hidden
                          />
                          <span className="min-w-0 flex-1 truncate">{task.title}</span>
                          <span
                            className={
                              overdue
                                ? "shrink-0 text-[11px] font-medium text-danger"
                                : "shrink-0 text-[11px] text-subtle-foreground"
                            }
                          >
                            {overdue ? "scaduta" : task.due_date}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Decisioni aperte</CardTitle>
              </CardHeader>
              <CardContent>
                {data.openDecisions.length === 0 ? (
                  <p className="text-[13px] text-muted-foreground">
                    Nessuna decisione in sospeso.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {data.openDecisions.map((decision) => (
                      <li key={decision.id} className="flex items-start gap-2 text-[13px]">
                        <Scale className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                        {decision.project_id ? (
                          <Link
                            href={`/projects/${decision.project_id}/decisions`}
                            className="min-w-0 flex-1 truncate hover:underline"
                          >
                            {decision.title}
                          </Link>
                        ) : (
                          <span className="min-w-0 flex-1 truncate">{decision.title}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="space-y-4">
          <NextStepCard />

          <Card>
            <CardHeader>
              <CardTitle>Inbox</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/inbox">Apri</Link>
              </Button>
            </CardHeader>
            <CardContent>
              <p className="flex items-baseline gap-2">
                <span className="font-display text-2xl font-semibold tabular-nums">
                  {data.unprocessedInbox}
                </span>
                <span className="text-[13px] text-muted-foreground">
                  {data.unprocessedInbox === 1 ? "elemento da elaborare" : "elementi da elaborare"}
                </span>
              </p>
              {data.unprocessedInbox === 0 && (
                <p className="mt-2 flex items-center gap-2 text-[13px] text-muted-foreground">
                  <Inbox className="size-3.5" aria-hidden /> Inbox pulita.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Idee recenti</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/ideas">Tutte</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {data.recentIdeas.length === 0 ? (
                <p className="text-[13px] text-muted-foreground">
                  Nessuna idea in attesa. Scrivi qualcosa qui sopra.
                </p>
              ) : (
                <ul className="space-y-2.5">
                  {data.recentIdeas.map((idea) => (
                    <li key={idea.id}>
                      <Link
                        href={`/ideas/${idea.id}`}
                        className="group flex items-start gap-2 text-[13px]"
                      >
                        <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium group-hover:underline">
                            {idea.title}
                          </span>
                          <span className="block truncate text-[12px] text-muted-foreground">
                            {truncate(idea.summary ?? idea.original_content, 70)}
                          </span>
                        </span>
                        <StatusBadge descriptor={IDEA_STATUS_MAP[idea.status]} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {data.staleProjects.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Fermi da un po&apos;</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {data.staleProjects.map((project) => (
                    <li key={project.id} className="flex items-start gap-2 text-[13px]">
                      <TimerReset className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden />
                      <Link
                        href={`/projects/${project.id}`}
                        className="min-w-0 flex-1 truncate hover:underline"
                      >
                        {project.emoji ? `${project.emoji} ` : ""}
                        {project.name}
                      </Link>
                      <RelativeTime
                        value={project.last_activity_at}
                        className="shrink-0 text-[11px] text-subtle-foreground"
                      />
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>La tua settimana</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/review">
                  <CalendarClock /> Revisione
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-3 gap-2 text-center">
                <Stat label="idee" value={data.week.ideasCaptured} />
                <Stat label="completate" value={data.week.tasksCompleted} />
                <Stat label="decisioni" value={data.week.decisionsMade} />
              </dl>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[var(--radius-md)] bg-surface-muted py-2">
      <dt className="sr-only">{label}</dt>
      <dd>
        <span className="block font-display text-lg font-semibold tabular-nums">{value}</span>
        <span className="block text-[11px] text-muted-foreground">{label}</span>
      </dd>
    </div>
  );
}
