import { notFound } from "next/navigation";

import { DecisionLog } from "@/components/projects/decision-log";
import { getProject } from "@/server/queries/projects";
import { requireSession } from "@/server/session";

export const metadata = { title: "Decisioni" };

export default async function ProjectDecisionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;

  const detail = await getProject(session.supabase, session.workspace.id, id);
  if (!detail) notFound();

  return (
    <DecisionLog
      projectId={id}
      decisions={detail.decisions}
      canWrite={session.canWrite}
    />
  );
}
