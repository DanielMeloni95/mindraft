import { Archive } from "lucide-react";

import { PageHeader } from "@/components/common/page-header";
import { ArchiveList } from "@/components/common/archive-list";
import { EmptyState } from "@/components/ui/empty-state";
import { requireSession } from "@/server/session";

export const metadata = { title: "Archivio" };

export default async function ArchivePage() {
  const session = await requireSession();

  const [{ data: ideas }, { data: projects }, { data: inbox }, { data: canvases }] = await Promise.all([
    session.supabase
      .from("ideas")
      .select("id, title, updated_at")
      .eq("workspace_id", session.workspace.id)
      .not("deleted_at", "is", null)
      .order("updated_at", { ascending: false })
      .limit(50),
    session.supabase
      .from("projects")
      .select("id, name, updated_at")
      .eq("workspace_id", session.workspace.id)
      .not("deleted_at", "is", null)
      .order("updated_at", { ascending: false })
      .limit(50),
    session.supabase
      .from("inbox_items")
      .select("id, content, updated_at")
      .eq("workspace_id", session.workspace.id)
      .not("deleted_at", "is", null)
      .order("updated_at", { ascending: false })
      .limit(50),
    session.supabase
      .from("canvases")
      .select("id, title, updated_at")
      .eq("workspace_id", session.workspace.id)
      .not("deleted_at", "is", null)
      .order("updated_at", { ascending: false })
      .limit(50),
  ]);

  const items = [
    ...(ideas ?? []).map((row) => ({
      id: row.id,
      kind: "idea" as const,
      label: row.title,
      updatedAt: row.updated_at,
    })),
    ...(projects ?? []).map((row) => ({
      id: row.id,
      kind: "project" as const,
      label: row.name,
      updatedAt: row.updated_at,
    })),
    ...(inbox ?? []).map((row) => ({
      id: row.id,
      kind: "inbox" as const,
      label: row.content.slice(0, 90),
      updatedAt: row.updated_at,
    })),
    ...(canvases ?? []).map((row) => ({
      id: row.id,
      kind: "canvas" as const,
      label: row.title,
      updatedAt: row.updated_at,
    })),
  ].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return (
    <>
      <PageHeader
        title="Archivio"
        description="Niente viene distrutto subito: da qui puoi rimettere tutto al suo posto."
      />

      {items.length === 0 ? (
        <EmptyState
          icon={Archive}
          title="Archivio vuoto"
          description="Quando elimini qualcosa finisce qui, e resta recuperabile."
        />
      ) : (
        <ArchiveList items={items} />
      )}
    </>
  );
}
