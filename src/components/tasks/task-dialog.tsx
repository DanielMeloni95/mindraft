"use client";

import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TASK_PRIORITIES, TASK_STATUSES } from "@/lib/domain/constants";
import { deleteTaskAction, updateTaskAction } from "@/server/actions/tasks";
import type { TaskWithProject } from "@/server/queries/tasks";

export function TaskDialog({
  task,
  milestones,
  open,
  onOpenChange,
  onSaved,
}: {
  task: TaskWithProject;
  milestones: Array<{ id: string; title: string }>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = React.useState(task.title);
  const [description, setDescription] = React.useState(task.description ?? "");
  const [status, setStatus] = React.useState(task.status);
  const [priority, setPriority] = React.useState(task.priority);
  const [dueDate, setDueDate] = React.useState(task.due_date ?? "");
  const [estimate, setEstimate] = React.useState(task.estimate_minutes ?? "");
  const [milestoneId, setMilestoneId] = React.useState(task.milestone_id ?? "");
  const [pending, startTransition] = React.useTransition();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Attività</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="task-title">Titolo</Label>
            <Input
              id="task-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="task-description">Descrizione</Label>
            <Textarea
              id="task-description"
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="task-status">Stato</Label>
              <select
                id="task-status"
                value={status}
                onChange={(event) => setStatus(event.target.value as typeof status)}
                className="h-9 w-full rounded-[var(--radius-md)] border border-border bg-surface px-2 text-[13px]"
              >
                {TASK_STATUSES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-priority">Priorità</Label>
              <select
                id="task-priority"
                value={priority}
                onChange={(event) => setPriority(event.target.value as typeof priority)}
                className="h-9 w-full rounded-[var(--radius-md)] border border-border bg-surface px-2 text-[13px]"
              >
                {TASK_PRIORITIES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="task-due">Scadenza</Label>
              <Input
                id="task-due"
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-estimate">Stima (minuti)</Label>
              <Input
                id="task-estimate"
                type="number"
                min={0}
                value={estimate}
                onChange={(event) => setEstimate(event.target.value)}
              />
            </div>
          </div>

          {milestones.length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="task-milestone">Milestone</Label>
              <select
                id="task-milestone"
                value={milestoneId}
                onChange={(event) => setMilestoneId(event.target.value)}
                className="h-9 w-full rounded-[var(--radius-md)] border border-border bg-surface px-2 text-[13px]"
              >
                <option value="">Nessuna</option>
                {milestones.map((milestone) => (
                  <option key={milestone.id} value={milestone.id}>
                    {milestone.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          {task.origin_type && (
            <p className="text-[12px] text-subtle-foreground">
              Nata da: {task.origin_type === "idea" ? "un'idea" : task.origin_type}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            className="mr-auto text-danger"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await deleteTaskAction(task.id);
                if (!result.ok) {
                  toast.error(result.error);
                  return;
                }
                onOpenChange(false);
                onSaved();
                toast.success("Attività eliminata", {
                  action: {
                    label: "Annulla",
                    onClick: () => void deleteTaskAction(task.id, true).then(onSaved),
                  },
                });
              })
            }
          >
            Elimina
          </Button>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            Chiudi
          </Button>
          <Button
            variant="primary"
            loading={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await updateTaskAction({
                  id: task.id,
                  title: title.trim(),
                  description: description.trim() || null,
                  status,
                  priority,
                  dueDate: dueDate || null,
                  estimateMinutes: estimate === "" ? null : Number(estimate),
                  milestoneId: milestoneId || null,
                });
                if (!result.ok) {
                  toast.error(result.error);
                  return;
                }
                onOpenChange(false);
                onSaved();
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
