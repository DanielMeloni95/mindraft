"use client";

import dynamic from "next/dynamic";

import { ErrorBoundary } from "@/components/common/error-boundary";
import { Skeleton } from "@/components/ui/skeleton";
import type { GraphData } from "@/server/queries/canvas";

const GlobalGraph = dynamic(
  () => import("./global-graph").then((module) => module.GlobalGraph),
  {
    ssr: false,
    loading: () => (
      <div className="surface-card h-[70vh] min-h-[420px] p-4" role="status" aria-live="polite">
        <span className="sr-only">Caricamento del grafo</span>
        <Skeleton className="h-full w-full" />
      </div>
    ),
  },
);

export function GlobalGraphClient({ data, workspaceId, canWrite }: { data: GraphData; workspaceId: string; canWrite: boolean }) {
  return (
    <ErrorBoundary fallbackMessage="Il grafo non si è aperto. I dati non sono stati toccati.">
      <GlobalGraph data={data} workspaceId={workspaceId} canWrite={canWrite} />
    </ErrorBoundary>
  );
}
