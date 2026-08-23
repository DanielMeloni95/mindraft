"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Download, History, ListPlus, Save } from "lucide-react";
import { toast } from "sonner";

import { ErrorBoundary } from "@/components/common/error-boundary";
import { RelativeTime } from "@/components/common/relative-time";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { extractTasksAction } from "@/server/actions/ai";
import { createTaskAction } from "@/server/actions/tasks";
import {
  restoreDocumentVersionAction,
  snapshotDocumentAction,
} from "@/server/actions/documents";
import type { JSONContent } from "@tiptap/react";
import type { ExtractTasksResult } from "@/lib/ai/schemas";
import { docToMarkdown, docToPlainText, type TipTapNode } from "@/lib/domain/tiptap";

export type JsonDoc = JSONContent;

// The editor bundle is large and irrelevant until the tab is open.
const RichTextEditor = dynamic(
  () => import("./rich-text-editor").then((module) => module.RichTextEditor),
  {
    ssr: false,
    loading: () => (
      <div className="surface-card space-y-3 p-6" role="status" aria-live="polite">
        <span className="sr-only">Caricamento dell&apos;editor</span>
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
        <Skeleton className="h-3 w-4/6" />
      </div>
    ),
  },
);

export function DocumentWorkspace({
  documentId,
  projectId,
  title,
  initialContent,
  initialRevision,
  versions,
  canWrite,
}: {
  documentId: string;
  projectId: string;
  title: string;
  initialContent: JsonDoc;
  initialRevision: number;
  versions: Array<{ id: string; revision: number; label: string | null; created_at: string }>;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const [extracted, setExtracted] = React.useState<
    (ExtractTasksResult & { provider: string }) | null
  >(null);
  const [pending, startTransition] = React.useTransition();

  const exportMarkdown = () => {
    const markdown = `# ${title}\n\n${docToMarkdown(initialContent as TipTapNode)}`;
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${title.replace(/[^\p{L}\p{N}]+/gu, "-").toLowerCase()}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="min-w-0 flex-1 truncate font-display text-sm font-semibold">{title}</h2>

        {canWrite && (
          <Button
            variant="secondary"
            size="sm"
            loading={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await extractTasksAction({
                  text: docToPlainText(initialContent as TipTapNode),
                  projectId,
                });
                if (!result.ok) {
                  toast.error(result.error);
                  return;
                }
                setExtracted(result.data);
              })
            }
          >
            <ListPlus /> Estrai attività
          </Button>
        )}

        {canWrite && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              startTransition(async () => {
                const result = await snapshotDocumentAction(documentId, "Versione manuale");
                if (!result.ok) {
                  toast.error(result.error);
                  return;
                }
                toast.success(
                  result.data.created
                    ? "Versione salvata"
                    : "Nessuna modifica da versionare",
                );
                router.refresh();
              })
            }
          >
            <Save /> Salva versione
          </Button>
        )}

        <Button variant="secondary" size="sm" onClick={() => setHistoryOpen(true)}>
          <History /> Versioni ({versions.length})
        </Button>

        <Button variant="ghost" size="sm" onClick={exportMarkdown}>
          <Download /> Markdown
        </Button>
      </div>

      <ErrorBoundary fallbackMessage="L'editor non si è avviato. Ricarica la pagina: il documento è al sicuro sul server.">
        <RichTextEditor
          documentId={documentId}
          initialContent={initialContent}
          initialRevision={initialRevision}
          readOnly={!canWrite}
        />
      </ErrorBoundary>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cronologia del documento</DialogTitle>
            <DialogDescription>
              Le versioni sono istantanee, non ogni battuta: ne nasce una quando il
              contenuto cambia davvero.
            </DialogDescription>
          </DialogHeader>

          {versions.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">
              Ancora nessuna versione salvata.
            </p>
          ) : (
            <ul className="space-y-2">
              {versions.map((version) => (
                <li
                  key={version.id}
                  className="flex items-center gap-3 rounded-[var(--radius-md)] border border-border p-2.5"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium">
                      {version.label ?? `Revisione ${version.revision}`}
                    </span>
                    <RelativeTime
                      value={version.created_at}
                      className="text-[11px] text-subtle-foreground"
                    />
                  </span>
                  {canWrite && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        startTransition(async () => {
                          const result = await restoreDocumentVersionAction(version.id);
                          if (!result.ok) {
                            toast.error(result.error);
                            return;
                          }
                          setHistoryOpen(false);
                          toast.success("Versione ripristinata");
                          router.refresh();
                        })
                      }
                    >
                      Ripristina
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={extracted !== null} onOpenChange={() => setExtracted(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Attività proposte</DialogTitle>
            <DialogDescription>
              Niente viene creato finché non confermi. Le scadenze non sono state dedotte.
            </DialogDescription>
          </DialogHeader>

          {extracted && extracted.tasks.length === 0 && (
            <p className="text-[13px] text-muted-foreground">
              Non ho trovato azioni abbastanza concrete in questo documento.
            </p>
          )}

          {extracted && extracted.tasks.length > 0 && (
            <>
              <ul className="space-y-1.5">
                {extracted.tasks.map((task, index) => (
                  <li key={index} className="rounded-[var(--radius-md)] bg-surface-muted p-2 text-[13px]">
                    {task.title}
                  </li>
                ))}
              </ul>
              <Button
                variant="primary"
                className="mt-4 w-full"
                loading={pending}
                onClick={() =>
                  startTransition(async () => {
                    let created = 0;
                    for (const task of extracted.tasks) {
                      const result = await createTaskAction({
                        title: task.title,
                        description: task.description || undefined,
                        priority: task.priority,
                        projectId,
                      });
                      if (result.ok) created += 1;
                    }
                    setExtracted(null);
                    toast.success(`${created} attività create`);
                    router.refresh();
                  })
                }
              >
                Crea {extracted.tasks.length} attività
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
