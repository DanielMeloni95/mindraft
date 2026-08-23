import { Network } from "lucide-react";

import { GlobalGraphClient } from "@/components/canvas/global-graph-client";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { getGlobalGraph } from "@/server/queries/canvas";
import { requireSession } from "@/server/session";

export const metadata = { title: "Mappa globale" };

export default async function MapPage() {
  const session = await requireSession();
  const data = await getGlobalGraph(session.supabase, session.workspace.id);

  return (
    <>
      <PageHeader
        title="Mappa globale"
        description="Ogni nodo è un elemento vero e si apre. I filtri servono a trovare cluster, dipendenze e contenuti orfani."
      />

      {data.nodes.length === 0 ? (
        <EmptyState
          icon={Network}
          title="Non c'è ancora niente da mappare"
          description="La mappa si popola da sola man mano che catturi idee e le trasformi in progetti."
        />
      ) : (
        <GlobalGraphClient data={data} />
      )}
    </>
  );
}
