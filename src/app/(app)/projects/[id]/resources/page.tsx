import { notFound } from "next/navigation";

import { ResourceList } from "@/components/projects/resource-list";
import { getProject } from "@/server/queries/projects";
import { requireSession } from "@/server/session";

export const metadata = { title: "Risorse" };

export default async function ProjectResourcesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;

  const detail = await getProject(session.supabase, session.workspace.id, id);
  if (!detail) notFound();

  return (
    <ResourceList
      projectId={id}
      resources={detail.resources}
      risks={detail.risks}
      canWrite={session.canWrite}
    />
  );
}
