"use client";

import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { MILESTONE_STATUSES } from "@/lib/domain/constants";
import { deleteMilestoneAction, saveMilestoneAction } from "@/server/actions/planning";
import type { MilestoneRow } from "@/types/database";

export function MilestoneDialog({
  projectId,
  milestone,
  open,
  onOpenChange,
  onSaved,
}: {
  projectId: string;
  milestone: MilestoneRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = React.useState(milestone?.title ?? "");
  const [description, setDescription] = React.useState(milestone?.description ?? "");
  const [phase, setPhase] = React.useState(milestone?.phase ?? "");
  const [versionLabel, setVersionLabel] = React.useState(milestone?.version_label ?? "");
  const [status, setStatus] = React.useState(milestone?.status ?? "planned");
  const [startsOn, setStartsOn] = React.useState(milestone?.starts_on ?? "");
  const [endsOn, setEndsOn] = React.useState(milestone?.ends_on ?? "");
  const [progress, setProgress] = React.useState(milestone?.progress ?? 0);
  const [isEstimate, setIsEstimate] = React.useState(milestone?.is_estimate ?? true);
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});
  const [pending, startTransition] = React.useTransition();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{milestone ? "Modifica milestone" : "Nuova milestone"}</DialogTitle>
          <DialogDescription>
            Se le date sono una previsione, lascia attivo «stima»: la roadmap lo mostrerà.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="milestone-title">Titolo</Label>
            <Input
              id="milestone-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              autoFocus
              aria-invalid={Boolean(errors.title)}
            />
            {errors.title && <p className="text-[12px] text-danger">{errors.title[0]}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="milestone-description">Descrizione</Label>
            <Textarea
              id="milestone-description"
              rows={2}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="milestone-start">Inizio</Label>
              <Input
                id="milestone-start"
                type="date"
                value={startsOn}
                onChange={(event) => setStartsOn(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="milestone-end">Fine</Label>
              <Input
                id="milestone-end"
                type="date"
                value={endsOn}
                onChange={(event) => setEndsOn(event.target.value)}
                aria-invalid={Boolean(errors.endsOn)}
              />
              {errors.endsOn && <p className="text-[12px] text-danger">{errors.endsOn[0]}</p>}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="milestone-status">Stato</Label>
              <select
                id="milestone-status"
                value={status}
                onChange={(event) => setStatus(event.target.value as typeof status)}
                className="h-9 w-full rounded-[var(--radius-md)] border border-border bg-surface px-2 text-[13px]"
              >
                {MILESTONE_STATUSES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="milestone-phase">Fase</Label>
              <Input
                id="milestone-phase"
                value={phase}
                onChange={(event) => setPhase(event.target.value)}
                placeholder="Fase 1"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="milestone-version">Versione</Label>
              <Input
                id="milestone-version"
                value={versionLabel}
                onChange={(event) => setVersionLabel(event.target.value)}
                placeholder="v0.1"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="milestone-progress">Avanzamento (%)</Label>
            <Input
              id="milestone-progress"
              type="number"
              min={0}
              max={100}
              value={progress}
              onChange={(event) => setProgress(Number(event.target.value))}
            />
          </div>

          <label className="flex items-center gap-2 text-[13px]">
            <Checkbox
              checked={isEstimate}
              onCheckedChange={(value) => setIsEstimate(value === true)}
            />
            Le date sono una stima
          </label>
        </div>

        <DialogFooter>
          {milestone && (
            <Button
              variant="ghost"
              className="mr-auto text-danger"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await deleteMilestoneAction(milestone.id);
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
                const result = await saveMilestoneAction({
                  id: milestone?.id,
                  projectId,
                  title: title.trim(),
                  description: description.trim() || undefined,
                  phase: phase.trim() || undefined,
                  versionLabel: versionLabel.trim() || undefined,
                  status,
                  startsOn: startsOn || undefined,
                  endsOn: endsOn || undefined,
                  progress,
                  isEstimate,
                });

                if (!result.ok) {
                  setErrors(result.fieldErrors ?? {});
                  if (!result.fieldErrors) toast.error(result.error);
                  return;
                }

                onOpenChange(false);
                onSaved();
                toast.success("Milestone salvata");
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
