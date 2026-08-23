import { notFound } from "next/navigation";

import { CanvasClient } from "@/components/canvas/canvas-client";
import { EmptyState } from "@/components/ui/empty-state";
import { getCanvasBundle } from "@/server/queries/canvas";
import { getProject } from "@/server/queries/projects";
import { requireSession } from "@/server/session";

export const metadata = { title: "Canvas" };

export default async function ProjectCanvasPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;

  const project = await getProject(session.supabase, session.workspace.id, id);
  if (!project) notFound();

  if (!project.canvasId) {
    return (
      <EmptyState
        title="Mappa non disponibile"
        description="Questo progetto è stato creato prima dell'introduzione delle mappe. Creane uno nuovo o contatta il supporto."
      />
    );
  }

  const bundle = await getCanvasBundle(session.supabase, session.workspace.id, project.canvasId);
  if (!bundle) notFound();

  return (
    <div className="space-y-3">
      <p className="text-[13px] leading-relaxed text-muted-foreground">
        I nodi collegati a un elemento reale portano l&apos;icona di apertura: rinominarli
        rinomina anche l&apos;elemento. Gli altri si possono convertire dal menu «Nodo
        selezionato».
      </p>
      <CanvasClient
        canvasId={bundle.canvas.id}
        initialNodes={bundle.nodes}
        initialEdges={bundle.edges}
        canWrite={session.canWrite}
      />
    </div>
  );
}
