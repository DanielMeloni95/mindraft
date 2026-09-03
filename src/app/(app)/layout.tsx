import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell/app-shell";
import { countUnprocessed } from "@/server/queries/inbox";
import { listProjectOptions } from "@/server/queries/projects";
import { taskCounts } from "@/server/queries/tasks";
import { requireSession } from "@/server/session";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();

  // First run: the shell would be empty and confusing, so we send the
  // user through onboarding instead — it is skippable.
  if (!session.profile?.onboarding_completed_at) {
    redirect("/onboarding");
  }

  const [inbox, tasks, projects, notifications] = await Promise.all([
    countUnprocessed(session.supabase, session.workspace.id),
    taskCounts(session.supabase, session.workspace.id),
    listProjectOptions(session.supabase, session.workspace.id),
    session.supabase.from("notifications").select("id", { count: "exact", head: true }).eq("workspace_id", session.workspace.id).eq("user_id", session.userId).is("read_at", null),
  ]);

  return (
    <AppShell
      session={session}
      counts={{ inbox, tasks: tasks.overdue + tasks.today }}
      projects={projects}
      notificationCount={notifications.count ?? 0}
    >
      {children}
    </AppShell>
  );
}
