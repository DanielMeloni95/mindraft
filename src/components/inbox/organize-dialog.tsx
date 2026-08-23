"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { AiBadge, AssumptionList } from "@/components/ai/ai-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { OrganizeNoteResult } from "@/lib/ai/schemas";
import { createIdeaAction, updateIdeaAction } from "@/server/actions/ideas";
import type { InboxItemWithProject } from "@/server/queries/inbox";

/**
 * Preview before write. The original capture is shown untouched next to
 * the proposal, and the fields stay editable — the user always has the
 * last word.
 */
export function OrganizeDialog({
  open,
  onOpenChange,
  item,
  result,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: InboxItemWithProject;
  result: OrganizeNoteResult & { provider: string };
}) {
  const router = useRouter();
  const [title, setTitle] = React.useState(result.title);
  const [summary, setSummary] = React.useState(result.summary);
  const [category, setCategory] = React.useState(result.category);
  const [pending, startTransition] = React.useTransition();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Proposta di riordino <AiBadge provider={result.provider} />
          </DialogTitle>
          <DialogDescription>
            Il testo che hai scritto non viene toccato: quello che vedi qui sotto sono
            campi nuovi, e li puoi correggere prima di salvare.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-[var(--radius-md)] border border-border bg-surface-muted p-3">
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-subtle-foreground">
            Il tuo testo, invariato
          </span>
          <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-muted-foreground">
            {item.content}
          </p>
        </div>

        <div className="mt-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="organize-title">Titolo proposto</Label>
            <Input
              id="organize-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="organize-summary">Sintesi proposta</Label>
            <Textarea
              id="organize-summary"
              rows={3}
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="organize-category">Categoria</Label>
            <Input
              id="organize-category"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              placeholder="Prodotto, Contenuti, Studio…"
            />
          </div>

          {result.bulletPoints.length > 0 && (
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-subtle-foreground">
                Pensieri distinti riconosciuti
              </span>
              <ul className="mt-1 space-y-1">
                {result.bulletPoints.map((point, index) => (
                  <li key={index} className="text-[13px] leading-relaxed text-muted-foreground">
                    · {point}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <AssumptionList assumptions={result.assumptions} questions={result.questions} />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            Non ora
          </Button>
          <Button
            variant="primary"
            loading={pending}
            onClick={() =>
              startTransition(async () => {
                const created = await createIdeaAction({
                  title: title.trim() || undefined,
                  originalContent: item.content || item.url_title || "",
                  category: category.trim() || undefined,
                  sourceInboxItemId: item.id,
                });

                if (!created.ok) {
                  toast.error(created.error);
                  return;
                }

                if (summary.trim().length > 0) {
                  await updateIdeaAction({ id: created.data.id, summary: summary.trim() });
                }

                onOpenChange(false);
                toast.success("Idea creata con la struttura approvata");
                router.push(`/ideas/${created.data.id}`);
              })
            }
          >
            Crea l&apos;idea
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
