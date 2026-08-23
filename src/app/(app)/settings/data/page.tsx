import { PageHeader } from "@/components/common/page-header";
import { DataSettings } from "@/components/settings/data-settings";
import { requireSession } from "@/server/session";

export const metadata = { title: "Dati ed esportazione" };

export default async function DataPage() {
  await requireSession();

  return (
    <>
      <PageHeader
        title="Dati ed esportazione"
        description="I tuoi contenuti escono interi, con le relazioni intatte. Nessun lock-in."
      />
      <DataSettings />
    </>
  );
}
