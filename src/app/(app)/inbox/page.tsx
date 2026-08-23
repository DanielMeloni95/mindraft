import { Inbox as InboxIcon } from "lucide-react";

import { QuickCapture } from "@/components/app-shell/quick-capture";
import { InboxList } from "@/components/inbox/inbox-list";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { listInboxItems } from "@/server/queries/inbox";
import { listProjectOptions } from "@/server/queries/projects";
import { requireSession } from "@/server/session";
import type { InboxStatus } from "@/types/database";

export const metadata = { title: "Inbox" };

const STATUSES: Array<{ value: InboxStatus | "all"; label: string }> = [
  { value: "unprocessed", label: "Da elaborare" },
  { value: "processed", label: "Elaborati" },
  { value: "archived", label: "Archiviati" },
  { value: "all", label: "Tutti" },
];

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const session = await requireSession();
  const params = await searchParams;

  const status = (STATUSES.find((s) => s.value === params.status)?.value ??
    "unprocessed") as InboxStatus | "all";

  const [{ items }, projects] = await Promise.all([
    listInboxItems(session.supabase, session.workspace.id, {
      status,
      search: params.q,
      limit: 50,
    }),
    listProjectOptions(session.supabase, session.workspace.id),
  ]);

  return (
    <>
      <PageHeader
        title="Inbox"
        description="Il punto più veloce del prodotto. Scrivi ora, sistema dopo."
      />

      <section className="surface-card mb-5 p-4" aria-label="Cattura rapida">
        <QuickCapture projects={projects} autoFocus />
      </section>

      <nav className="mb-4 flex flex-wrap gap-1.5" aria-label="Filtra per stato">
        {STATUSES.map((option) => {
          const active = option.value === status;
          const href =
            option.value === "unprocessed" ? "/inbox" : `/inbox?status=${option.value}`;
          return (
            <a
              key={option.value}
              href={href}
              aria-current={active ? "true" : undefined}
              className={
                active
                  ? "rounded-full border border-primary bg-brand-50 px-3 py-1 text-[12px] font-medium text-brand-700 dark:bg-brand-900/40 dark:text-brand-100"
                  : "rounded-full border border-border bg-surface px-3 py-1 text-[12px] font-medium text-muted-foreground hover:border-border-strong"
              }
            >
              {option.label}
            </a>
          );
        })}
      </nav>

      {items.length === 0 ? (
        <EmptyState
          icon={InboxIcon}
          title={
            status === "unprocessed"
              ? "Inbox pulita"
              : "Nessun elemento con questo filtro"
          }
          description={
            status === "unprocessed"
              ? "Quando ti viene in mente qualcosa, scrivilo qui sopra: bastano tre secondi."
              : "Prova a cambiare filtro."
          }
        />
      ) : (
        <InboxList items={items} projects={projects} />
      )}
    </>
  );
}
