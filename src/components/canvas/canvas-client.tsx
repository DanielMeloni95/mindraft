"use client";

import dynamic from "next/dynamic";

import { ErrorBoundary } from "@/components/common/error-boundary";
import { Skeleton } from "@/components/ui/skeleton";
import type { CanvasEdgeRow, CanvasNodeRow } from "@/types/database";

// React Flow is heavy and pointless on the server: loaded on demand.
const CanvasBoard = dynamic(
  () => import("./canvas-board").then((module) => module.CanvasBoard),
  {
    ssr: false,
    loading: () => (
      <div className="surface-card h-[70vh] min-h-[420px] p-4" role="status" aria-live="polite">
        <span className="sr-only">Caricamento della mappa</span>
        <Skeleton className="h-full w-full" />
      </div>
    ),
  },
);

export function CanvasClient(props: {
  canvasId: string;
  initialNodes: CanvasNodeRow[];
  initialEdges: CanvasEdgeRow[];
  canWrite: boolean;
}) {
  return (
    <ErrorBoundary fallbackMessage="La mappa non si è aperta. Ricarica la pagina: i nodi sono salvati sul server.">
      <CanvasBoard {...props} />
    </ErrorBoundary>
  );
}
