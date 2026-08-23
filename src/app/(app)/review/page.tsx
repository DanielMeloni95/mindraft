import { PageHeader } from "@/components/common/page-header";
import { WeeklyReview } from "@/components/common/weekly-review";
import { getDashboardData } from "@/server/queries/dashboard";
import { requireSession } from "@/server/session";

export const metadata = { title: "Revisione settimanale" };

function startOfWeek(date = new Date()): string {
  const copy = new Date(date);
  const day = (copy.getDay() + 6) % 7; // Monday = 0
  copy.setDate(copy.getDate() - day);
  return copy.toISOString().slice(0, 10);
}

export default async function ReviewPage() {
  const session = await requireSession();
  const weekStart = startOfWeek();

  const [data, { data: existing }, { data: history }] = await Promise.all([
    getDashboardData(session.supabase, session.workspace.id, session.profile?.full_name ?? null),
    session.supabase
      .from("weekly_reviews")
      .select("id, summary, focus_items, completed_at")
      .eq("workspace_id", session.workspace.id)
      .eq("user_id", session.userId)
      .eq("week_start", weekStart)
      .maybeSingle(),
    session.supabase
      .from("weekly_reviews")
      .select("id, week_start, summary")
      .eq("workspace_id", session.workspace.id)
      .eq("user_id", session.userId)
      .order("week_start", { ascending: false })
      .limit(8),
  ]);

  return (
    <>
      <PageHeader
        title="Revisione settimanale"
        description="Sette domande, dieci minuti, tre focus per la settimana che arriva."
      />

      <WeeklyReview
        weekStart={weekStart}
        stats={{
          unprocessedInbox: data.unprocessedInbox,
          ideasCaptured: data.week.ideasCaptured,
          tasksCompleted: data.week.tasksCompleted,
          decisionsMade: data.week.decisionsMade,
          overdueTasks: data.dueTasks.filter(
            (task) => task.due_date !== null && task.due_date < new Date().toISOString().slice(0, 10),
          ).length,
          openDecisions: data.openDecisions.length,
          staleProjects: data.staleProjects.map((project) => project.name),
        }}
        existing={
          existing
            ? {
                summary: existing.summary,
                focusItems: Array.isArray(existing.focus_items)
                  ? (existing.focus_items as Array<{ title: string; done: boolean }>)
                  : [],
                completedAt: existing.completed_at,
              }
            : null
        }
        history={(history ?? []).map((row) => ({
          id: row.id,
          weekStart: row.week_start,
          summary: row.summary,
        }))}
      />
    </>
  );
}
