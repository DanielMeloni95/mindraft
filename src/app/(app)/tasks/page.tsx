import Link from "next/link";

import { PageHeader } from "@/components/common/page-header";
import { TaskBoard } from "@/components/tasks/task-board";
import { listTasks, taskCounts, type TaskView } from "@/server/queries/tasks";
import { requireSession } from "@/server/session";
import { cn } from "@/lib/utils";

export const metadata = { title: "Attività" };

const VIEWS: Array<{ value: TaskView; label: string }> = [
  { value: "board", label: "Kanban" },
  { value: "today", label: "Oggi e scadute" },
  { value: "upcoming", label: "Prossime" },
  { value: "list", label: "Lista" },
  { value: "done", label: "Completate" },
];

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const session = await requireSession();
  const params = await searchParams;
  const view = (VIEWS.find((v) => v.value === params.view)?.value ?? "board") as TaskView;

  const [tasks, counts] = await Promise.all([
    listTasks(session.supabase, session.workspace.id, { view }),
    taskCounts(session.supabase, session.workspace.id),
  ]);

  return (
    <>
      <PageHeader
        title="Attività"
        description={`${counts.open} aperte · ${counts.overdue} scadute · ${counts.today} in scadenza oggi`}
      />

      <nav className="mb-4 flex flex-wrap gap-1.5" aria-label="Vista delle attività">
        {VIEWS.map((option) => {
          const active = option.value === view;
          return (
            <Link
              key={option.value}
              href={option.value === "board" ? "/tasks" : `/tasks?view=${option.value}`}
              aria-current={active ? "true" : undefined}
              className={cn(
                "rounded-full border px-3 py-1 text-[12px] font-medium transition-colors",
                active
                  ? "border-primary bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-100"
                  : "border-border bg-surface text-muted-foreground hover:border-border-strong",
              )}
            >
              {option.label}
            </Link>
          );
        })}
      </nav>

      <TaskBoard tasks={tasks} canWrite={session.canWrite} />
    </>
  );
}
