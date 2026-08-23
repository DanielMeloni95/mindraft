import { notFound } from "next/navigation";
import { History } from "lucide-react";

import { RelativeTime } from "@/components/common/relative-time";
import { EmptyState } from "@/components/ui/empty-state";
import { ENTITY_LABELS } from "@/lib/domain/constants";
import { activityFor, getProjectHeader } from "@/server/queries/projects";
import { requireSession } from "@/server/session";

export const metadata = { title: "Cronologia" };

export default async function ProjectHistoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;

  const project = await getProjectHeader(session.supabase, session.workspace.id, id);
  if (!project) notFound();

  const entries = await activityFor(session.supabase, session.workspace.id, id, 60);

  if (entries.length === 0) {
    return (
      <EmptyState
        icon={History}
        title="Nessuna attività registrata"
        description="Qui finiscono le modifiche importanti: creazioni, conversioni, decisioni."
      />
    );
  }

  return (
    <ol className="surface-card divide-y divide-border">
      {entries.map((entry) => (
        <li key={entry.id} className="flex items-start gap-3 p-3.5">
          <span className="mt-0.5 rounded-full bg-surface-muted px-2 py-0.5 text-[11px] text-muted-foreground">
            {ENTITY_LABELS[entry.entity_type]}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px]">{entry.summary ?? entry.action}</span>
            <RelativeTime
              value={entry.created_at}
              className="text-[11px] text-subtle-foreground"
            />
          </span>
        </li>
      ))}
    </ol>
  );
}
