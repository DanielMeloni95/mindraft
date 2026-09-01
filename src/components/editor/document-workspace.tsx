"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Download, FileText, History, ListPlus, Network, RefreshCw, RotateCcw, Save, Upload } from "lucide-react";
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
  generateFromAgenticDocumentAction,
  importAgenticPdfAction,
  regenerateAgenticTemplateAction,
  restoreDocumentVersionAction,
  saveDocumentAction,
  snapshotDocumentAction,
  syncAgenticCanvasAction,
} from "@/server/actions/documents";
import type { JSONContent } from "@tiptap/react";
import type { ExtractTasksResult } from "@/lib/ai/schemas";
import { docToPlainText, textToDoc, type TipTapNode } from "@/lib/domain/tiptap";

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
  agentic = false,
}: {
  documentId: string;
  projectId: string;
  title: string;
  initialContent: JsonDoc;
  initialRevision: number;
  versions: Array<{ id: string; revision: number; label: string | null; created_at: string }>;
  canWrite: boolean;
  agentic?: boolean;
}) {
  const router = useRouter();
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const [extracted, setExtracted] = React.useState<
    (ExtractTasksResult & { provider: string }) | null
  >(null);
  const [pending, startTransition] = React.useTransition();
  const importRef = React.useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <FileText className="size-4 text-primary" />
          <span className="truncate font-display text-sm font-semibold">{agentic ? "Documento agentico" : "Documento"} · {title}</span>
        </span>

        {canWrite && agentic && (
          <>
            <input
              ref={importRef}
              type="file"
              accept=".pdf,.md,.markdown,.txt,application/pdf,text/plain,text/markdown"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                startTransition(async () => {
                  if (file.type === "application/pdf" || file.name.toLocaleLowerCase().endsWith(".pdf")) {
                    const formData = new FormData();
                    formData.set("documentId", documentId);
                    formData.set("file", file);
                    const imported = await importAgenticPdfAction(formData);
                    if (!imported.ok) toast.error(imported.error);
                    else {
                      const synced = Object.values(imported.data.entities).reduce((sum, count) => sum + count, 0);
                      toast.success(`PDF importato: ${imported.data.pages} pagine, ${imported.data.nodes} nodi e ${synced} elementi di progetto sincronizzati`);
                      router.refresh();
                    }
                    event.target.value = "";
                    return;
                  }
                  const text = await file.text();
                  const content = textToDoc(text);
                  const result = await saveDocumentAction({
                    documentId,
                    content,
                    plainText: docToPlainText(content),
                    baseRevision: initialRevision,
                    snapshotLabel: `Importazione ${file.name}`,
                  });
                  if (!result.ok) toast.error(result.error);
                  else {
                    toast.success("Documento importato");
                    router.refresh();
                  }
                  event.target.value = "";
                });
              }}
            />
            <Button variant="secondary" size="sm" onClick={() => importRef.current?.click()} disabled={pending}>
              <Upload /> Importa PDF / testo
            </Button>
          </>
        )}

        {canWrite && agentic && (
          <Button
            variant="secondary"
            size="sm"
            loading={pending}
            onClick={() => startTransition(async () => {
              const result = await syncAgenticCanvasAction(documentId);
              if (!result.ok) {
                toast.error(result.error);
                return;
              }
              const synced = Object.values(result.data.entities).reduce((sum, count) => sum + count, 0);
              toast.success(`Progetto sincronizzato: ${result.data.sections} sezioni e ${synced} nuovi elementi`);
              router.refresh();
            })}
          >
            <Network /> Sincronizza progetto
          </Button>
        )}

        {canWrite && agentic && (
          <Button
            variant="secondary"
            size="sm"
            loading={pending}
            onClick={() => {
              if (!window.confirm("Rigenerare il template agentico? Il contenuto corrente verrà sostituito e salvato nella cronologia.")) return;
              startTransition(async () => {
                const result = await regenerateAgenticTemplateAction(documentId);
                if (!result.ok) {
                  toast.error(result.error);
                  return;
                }
                toast.success(`Template rigenerato e canvas sincronizzato${result.data.nodes ? `: ${result.data.nodes} nuovi nodi` : ""}`);
                router.refresh();
              });
            }}
          >
            <RotateCcw /> Rigenera template
          </Button>
        )}

        {canWrite && agentic && (
          <Button
            variant="primary"
            size="sm"
            loading={pending}
            onClick={() => startTransition(async () => {
              const result = await generateFromAgenticDocumentAction(documentId);
              if (!result.ok) {
                toast.error(result.error);
                return;
              }
              const { goals, milestones, tasks, nodes } = result.data;
              toast.success(`Generati ${goals} obiettivi, ${milestones} milestone, ${tasks} attività e ${nodes} nodi`);
              router.refresh();
            })}
          >
            <RefreshCw /> Aggiorna progetto
          </Button>
        )}

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

        {agentic && <Button variant="secondary" size="sm" asChild>
          <a href={`/api/projects/${projectId}/agentic-document`}><Download /> Scarica .md</a>
        </Button>}
      </div>

      <ErrorBoundary fallbackMessage="L'editor non si è avviato. Ricarica la pagina: il documento è al sicuro sul server.">
        <RichTextEditor
          key={`${documentId}-${initialRevision}`}
          documentId={documentId}
          initialContent={initialContent}
          initialRevision={initialRevision}
          readOnly={!canWrite}
          agentic={agentic}
        />
      </ErrorBoundary>

      {agentic && <p className="rounded-[var(--radius-md)] border border-border bg-surface-muted px-3 py-2 text-[12px] text-muted-foreground">
        Le modifiche vengono salvate automaticamente. “Rigenera template” ripristina la struttura canonica e sincronizza i nodi principali del canvas; la versione precedente resta nella cronologia. “Aggiorna progetto” materializza obiettivi, roadmap, attività e canvas descritti nel documento.
      </p>}

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
