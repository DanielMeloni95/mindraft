import { notFound } from "next/navigation";

import { TaskBoard } from "@/components/tasks/task-board";
import { getProject } from "@/server/queries/projects";
import { requireSession } from "@/server/session";

export const metadata = { title: "Attività" };

export default async function ProjectTasksPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;

  const detail = await getProject(session.supabase, session.workspace.id, id);
  if (!detail) notFound();

  return (
    <TaskBoard
      tasks={detail.tasks.map((task) => ({ ...task, project: null }))}
      projectId={id}
      milestones={detail.milestones.map((m) => ({ id: m.id, title: m.title }))}
      canWrite={session.canWrite}
    />
  );
}
