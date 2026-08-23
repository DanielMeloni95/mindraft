"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Star, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { SaveIndicator, type SaveState } from "@/components/common/save-indicator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { IDEA_MATURITIES, IDEA_STATUSES } from "@/lib/domain/constants";
import { archiveIdeaAction, updateIdeaAction } from "@/server/actions/ideas";
import type { IdeaDetail } from "@/server/queries/ideas";
import { cn } from "@/lib/utils";

const FIELDS = [
  { key: "summary", label: "Sintesi", rows: 2, hint: "Una o due frasi, come la racconteresti a voce." },
  { key: "problem", label: "Problema osservato", rows: 3, hint: "Cosa non funziona oggi." },
  { key: "solution", label: "Soluzione ipotizzata", rows: 3, hint: "Come pensi di risolverlo." },
  { key: "audience", label: "Pubblico potenziale", rows: 2, hint: "Chi ha questo problema." },
  { key: "expected_value", label: "Valore atteso", rows: 2, hint: "Cosa cambia se funziona." },
  { key: "personal_motivation", label: "Motivazione personale", rows: 2, hint: "Perché interessa a te." },
] as const;

type FieldKey = (typeof FIELDS)[number]["key"];

/**
 * Everything here is *derived*. The original capture lives in a
 * read-only block above and is never edited from this form — the
 * database rejects it too.
 */
export function IdeaFields({ idea }: { idea: IdeaDetail }) {
  const router = useRouter();
  const [values, setValues] = React.useState<Record<FieldKey, string>>(() => ({
    summary: idea.summary ?? "",
    problem: idea.problem ?? "",
    solution: idea.solution ?? "",
    audience: idea.audience ?? "",
    expected_value: idea.expected_value ?? "",
    personal_motivation: idea.personal_motivation ?? "",
  }));
  const [title, setTitle] = React.useState(idea.title);
  const [category, setCategory] = React.useState(idea.category ?? "");
  const [saveState, setSaveState] = React.useState<SaveState>("idle");
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  const save = React.useCallback(
    async (patch: Record<string, unknown>) => {
      setSaveState("saving");
      const result = await updateIdeaAction({ id: idea.id, ...patch });
      if (!result.ok) {
        setSaveState("error");
        toast.error(result.error);
        return;
      }
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 1800);
      router.refresh();
    },
    [idea.id, router],
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1 space-y-1.5">
          <Label htmlFor="idea-title">Titolo</Label>
          <Input
            id="idea-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onBlur={() => {
              const next = title.trim();
              if (next.length > 0 && next !== idea.title) void save({ title: next });
              else if (next.length === 0) setTitle(idea.title);
            }}
            className="text-[15px] font-medium"
          />
        </div>
        <div className="flex items-center gap-1 pt-6">
          <Button
            variant={idea.is_favorite ? "subtle" : "ghost"}
            size="icon-sm"
            aria-pressed={idea.is_favorite}
            aria-label={idea.is_favorite ? "Rimuovi dai preferiti" : "Aggiungi ai preferiti"}
            onClick={() => void save({ isFavorite: !idea.is_favorite })}
          >
            <Star className={cn(idea.is_favorite && "fill-amber-400 text-amber-400")} />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Elimina idea"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 />
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="idea-status">Stato</Label>
          <select
            id="idea-status"
            value={idea.status}
            onChange={(event) => void save({ status: event.target.value })}
            className="h-9 w-full rounded-[var(--radius-md)] border border-border bg-surface px-2 text-[13px]"
          >
            {IDEA_STATUSES.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="idea-maturity">Maturità</Label>
          <select
            id="idea-maturity"
            value={idea.maturity}
            onChange={(event) => void save({ maturity: event.target.value })}
            className="h-9 w-full rounded-[var(--radius-md)] border border-border bg-surface px-2 text-[13px]"
          >
            {IDEA_MATURITIES.map((maturity) => (
              <option key={maturity.value} value={maturity.value}>
                {maturity.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="idea-category">Categoria</Label>
          <Input
            id="idea-category"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            onBlur={() => {
              const next = category.trim();
              if (next !== (idea.category ?? "")) void save({ category: next || null });
            }}
            placeholder="Prodotto, Studio…"
          />
        </div>
      </div>

      <div className="space-y-4">
        {FIELDS.map((field) => (
          <div key={field.key} className="space-y-1.5">
            <Label htmlFor={`idea-${field.key}`}>{field.label}</Label>
            <Textarea
              id={`idea-${field.key}`}
              rows={field.rows}
              value={values[field.key]}
              placeholder={field.hint}
              onChange={(event) =>
                setValues((current) => ({ ...current, [field.key]: event.target.value }))
              }
              onBlur={() => {
                const next = values[field.key].trim();
                const previous = (idea[field.key] as string | null) ?? "";
                if (next !== previous) {
                  void save({
                    [field.key === "expected_value"
                      ? "expectedValue"
                      : field.key === "personal_motivation"
                        ? "personalMotivation"
                        : field.key]: next || null,
                  });
                }
              }}
            />
          </div>
        ))}
      </div>

      <SaveIndicator state={saveState} />

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Eliminare questa idea?"
        description="Finisce nell'archivio: puoi recuperarla da lì. Il testo originale non viene distrutto."
        confirmLabel="Elimina"
        destructive
        onConfirm={async () => {
          const result = await archiveIdeaAction(idea.id);
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          toast.success("Idea eliminata", {
            action: {
              label: "Annulla",
              onClick: () => {
                void archiveIdeaAction(idea.id, true).then(() => router.refresh());
              },
            },
          });
          router.push("/ideas");
        }}
      />
    </div>
  );
}
