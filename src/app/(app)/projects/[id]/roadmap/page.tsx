import { notFound } from "next/navigation";

import { RoadmapTimeline } from "@/components/projects/roadmap-timeline";
import { getProject } from "@/server/queries/projects";
import { requireSession } from "@/server/session";

export const metadata = { title: "Roadmap" };

export default async function ProjectRoadmapPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;

  const detail = await getProject(session.supabase, session.workspace.id, id);
  if (!detail) notFound();

  return (
    <RoadmapTimeline
      projectId={id}
      milestones={detail.milestones}
      tasks={detail.tasks}
      canWrite={session.canWrite}
    />
  );
}
