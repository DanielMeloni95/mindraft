"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Scale } from "lucide-react";
import { toast } from "sonner";

import { RelativeTime } from "@/components/common/relative-time";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DECISION_STATUSES, DECISION_STATUS_MAP } from "@/lib/domain/constants";
import { deleteDecisionAction, saveDecisionAction } from "@/server/actions/planning";
import type { DecisionRow } from "@/types/database";

/**
 * The decision log is what stops a project from re-litigating the same
 * choice every three weeks. Context and alternatives matter as much as
 * the decision itself, so they are first-class fields.
 */
export function DecisionLog({
  projectId,
  decisions,
  canWrite,
}: {
  projectId: string;
  decisions: DecisionRow[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = React.useState<DecisionRow | null>(null);
  const [creating, setCreating] = React.useState(false);

  return (
    <div className="space-y-4">
      {canWrite && (
        <div className="flex justify-end">
          <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
            <Plus /> Registra decisione
          </Button>
        </div>
      )}

      {decisions.length === 0 ? (
        <EmptyState
          icon={Scale}
          title="Nessuna decisione registrata"
          description="Registra le scelte che oggi sembrano ovvie: fra un mese non lo saranno più."
          action={
            canWrite ? (
              <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
                Registra la prima
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="space-y-3">
          {decisions.map((decision) => (
            <li key={decision.id} className="surface-card p-4">
              <div className="flex flex-wrap items-start gap-2">
                <h3 className="min-w-0 flex-1 font-display text-[14px] font-semibold">
                  {decision.title}
                </h3>
                <StatusBadge descriptor={DECISION_STATUS_MAP[decision.status]} />
                {canWrite && (
                  <Button variant="ghost" size="sm" onClick={() => setEditing(decision)}>
                    Modifica
                  </Button>
                )}
              </div>

              <dl className="mt-2 space-y-2 text-[13px]">
                {decision.context && (
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-subtle-foreground">
                      Contesto
                    </dt>
                    <dd className="leading-relaxed text-muted-foreground">{decision.context}</dd>
                  </div>
                )}
                {decision.alternatives && (
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-subtle-foreground">
                      Alternative considerate
                    </dt>
                    <dd className="leading-relaxed text-muted-foreground">
                      {decision.alternatives}
                    </dd>
                  </div>
                )}
                {decision.rationale && (
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-subtle-foreground">
                      Motivazione
                    </dt>
                    <dd className="leading-relaxed">{decision.rationale}</dd>
                  </div>
                )}
                {decision.consequences && (
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-subtle-foreground">
                      Conseguenze
                    </dt>
                    <dd className="leading-relaxed text-muted-foreground">
                      {decision.consequences}
                    </dd>
                  </div>
                )}
              </dl>

              <p className="mt-3 border-t border-border pt-2 text-[11px] text-subtle-foreground">
                {decision.decided_on ? `Decisa il ${decision.decided_on} · ` : ""}
                aggiornata <RelativeTime value={decision.updated_at} />
              </p>
            </li>
          ))}
        </ul>
      )}

      {(creating || editing) && (
        <DecisionDialog
          projectId={projectId}
          decision={editing}
          open
          onOpenChange={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => router.refresh()}
        />
      )}
    </div>
  );
}

function DecisionDialog({
  projectId,
  decision,
  open,
  onOpenChange,
  onSaved,
}: {
  projectId: string;
  decision: DecisionRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = React.useState(decision?.title ?? "");
  const [context, setContext] = React.useState(decision?.context ?? "");
  const [alternatives, setAlternatives] = React.useState(decision?.alternatives ?? "");
  const [rationale, setRationale] = React.useState(decision?.rationale ?? "");
  const [consequences, setConsequences] = React.useState(decision?.consequences ?? "");
  const [status, setStatus] = React.useState(decision?.status ?? "proposed");
  const [decidedOn, setDecidedOn] = React.useState(decision?.decided_on ?? "");
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});
  const [pending, startTransition] = React.useTransition();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{decision ? "Modifica decisione" : "Registra una decisione"}</DialogTitle>
          <DialogDescription>
            Scrivi anche cosa hai scartato: è la parte che serve davvero quando torni qui.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="decision-title">Decisione</Label>
            <Input
              id="decision-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              autoFocus
              aria-invalid={Boolean(errors.title)}
              placeholder="Il punteggio resta modificabile a mano"
            />
            {errors.title && <p className="text-[12px] text-danger">{errors.title[0]}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="decision-context">Contesto</Label>
            <Textarea
              id="decision-context"
              rows={2}
              value={context}
              onChange={(event) => setContext(event.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="decision-alternatives">Alternative considerate</Label>
            <Textarea
              id="decision-alternatives"
              rows={2}
              value={alternatives}
              onChange={(event) => setAlternatives(event.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="decision-rationale">Motivazione</Label>
            <Textarea
              id="decision-rationale"
              rows={2}
              value={rationale}
              onChange={(event) => setRationale(event.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="decision-consequences">Conseguenze</Label>
            <Textarea
              id="decision-consequences"
              rows={2}
              value={consequences}
              onChange={(event) => setConsequences(event.target.value)}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="decision-status">Stato</Label>
              <select
                id="decision-status"
                value={status}
                onChange={(event) => setStatus(event.target.value as typeof status)}
                className="h-9 w-full rounded-[var(--radius-md)] border border-border bg-surface px-2 text-[13px]"
              >
                {DECISION_STATUSES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="decision-date">Data</Label>
              <Input
                id="decision-date"
                type="date"
                value={decidedOn}
                onChange={(event) => setDecidedOn(event.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          {decision && (
            <Button
              variant="ghost"
              className="mr-auto text-danger"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await deleteDecisionAction(decision.id);
                  if (!result.ok) {
                    toast.error(result.error);
                    return;
                  }
                  onOpenChange(false);
                  onSaved();
                })
              }
            >
              Elimina
            </Button>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            Annulla
          </Button>
          <Button
            variant="primary"
            loading={pending}
            onClick={() =>
              startTransition(async () => {
                setErrors({});
                const result = await saveDecisionAction({
                  id: decision?.id,
                  projectId,
                  title: title.trim(),
                  context: context.trim() || undefined,
                  alternatives: alternatives.trim() || undefined,
                  rationale: rationale.trim() || undefined,
                  consequences: consequences.trim() || undefined,
                  status,
                  decidedOn: decidedOn || undefined,
                });
                if (!result.ok) {
                  setErrors(result.fieldErrors ?? {});
                  if (!result.fieldErrors) toast.error(result.error);
                  return;
                }
                onOpenChange(false);
                onSaved();
                toast.success("Decisione registrata");
              })
            }
          >
            Salva
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
