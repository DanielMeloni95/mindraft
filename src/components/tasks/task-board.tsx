"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { TASK_PRIORITY_MAP, TASK_STATUSES, TASK_STATUS_MAP } from "@/lib/domain/constants";
import { cn } from "@/lib/utils";
import { createTaskAction, updateTaskAction } from "@/server/actions/tasks";
import type { TaskWithProject } from "@/server/queries/tasks";
import type { TaskStatus } from "@/types/database";

import { TaskDialog } from "./task-dialog";

/**
 * Kanban that stays a thinking tool: four states, no swimlanes, no
 * estimates ceremony. Dragging is a shortcut — the status select on each
 * card does the same thing from the keyboard.
 */
export function TaskBoard({
  tasks,
  projectId,
  milestones,
  canWrite,
}: {
  tasks: TaskWithProject[];
  projectId?: string;
  milestones?: Array<{ id: string; title: string }>;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [dragging, setDragging] = React.useState<TaskWithProject | null>(null);
  const [editing, setEditing] = React.useState<TaskWithProject | null>(null);
  const [quickTitle, setQuickTitle] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const byStatus = React.useMemo(() => {
    const map: Record<TaskStatus, TaskWithProject[]> = {
      todo: [],
      in_progress: [],
      blocked: [],
      done: [],
    };
    for (const task of tasks) map[task.status].push(task);
    return map;
  }, [tasks]);

  const move = (taskId: string, status: TaskStatus) => {
    void updateTaskAction({ id: taskId, status }).then((result) => {
      if (!result.ok) toast.error(result.error);
      else router.refresh();
    });
  };

  const onDragStart = (event: DragStartEvent) => {
    setDragging(tasks.find((task) => task.id === event.active.id) ?? null);
  };

  const onDragEnd = (event: DragEndEvent) => {
    setDragging(null);
    const status = event.over?.id as TaskStatus | undefined;
    const taskId = event.active.id as string;
    if (!status) return;
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === status) return;
    move(taskId, status);
  };

  const addQuick = () => {
    const title = quickTitle.trim();
    if (!title) return;
    startTransition(async () => {
      const result = await createTaskAction({ title, projectId });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setQuickTitle("");
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      {canWrite && (
        <div className="flex gap-2">
          <Input
            value={quickTitle}
            onChange={(event) => setQuickTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") addQuick();
            }}
            placeholder="Nuova attività…"
            aria-label="Nuova attività"
          />
          <Button variant="primary" onClick={addQuick} loading={pending}>
            <Plus /> Aggiungi
          </Button>
        </div>
      )}

      {tasks.length === 0 ? (
        <EmptyState
          title="Nessuna attività"
          description="Le attività servono a sostenere il pensiero, non a sostituirlo. Aggiungine una quando sai qual è il passo."
        />
      ) : (
        <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {TASK_STATUSES.map((status) => (
              <Column
                key={status.value}
                status={status.value}
                label={status.label}
                tasks={byStatus[status.value]}
                canWrite={canWrite}
                onSelect={setEditing}
                onMove={move}
              />
            ))}
          </div>

          <DragOverlay>
            {dragging && (
              <div className="surface-card w-64 p-3 text-[13px] shadow-raised">
                {dragging.title}
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      {editing && (
        <TaskDialog
          task={editing}
          milestones={milestones ?? []}
          open
          onOpenChange={() => setEditing(null)}
          onSaved={() => router.refresh()}
        />
      )}
    </div>
  );
}

function Column({
  status,
  label,
  tasks,
  canWrite,
  onSelect,
  onMove,
}: {
  status: TaskStatus;
  label: string;
  tasks: TaskWithProject[];
  canWrite: boolean;
  onSelect: (task: TaskWithProject) => void;
  onMove: (taskId: string, status: TaskStatus) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <section
      ref={setNodeRef}
      aria-label={label}
      className={cn(
        "rounded-[var(--radius-xl)] border border-border bg-surface-muted/50 p-2 transition-colors",
        isOver && "border-primary bg-brand-50/60 dark:bg-brand-900/20",
      )}
    >
      <header className="flex items-center justify-between px-1.5 py-1.5">
        <h3 className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </h3>
        <span className="text-[11px] tabular-nums text-subtle-foreground">{tasks.length}</span>
      </header>

      <ul className="space-y-2">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            canWrite={canWrite}
            onSelect={onSelect}
            onMove={onMove}
          />
        ))}
        {tasks.length === 0 && (
          <li className="px-1.5 py-3 text-[12px] text-subtle-foreground">Niente qui.</li>
        )}
      </ul>
    </section>
  );
}

function TaskCard({
  task,
  canWrite,
  onSelect,
  onMove,
}: {
  task: TaskWithProject;
  canWrite: boolean;
  onSelect: (task: TaskWithProject) => void;
  onMove: (taskId: string, status: TaskStatus) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
    disabled: !canWrite,
  });

  const overdue =
    task.due_date !== null &&
    task.status !== "done" &&
    task.due_date < new Date().toISOString().slice(0, 10);

  return (
    <li
      ref={setNodeRef}
      className={cn("surface-card p-2.5", isDragging && "opacity-40")}
      {...attributes}
      {...listeners}
    >
      <button
        type="button"
        onClick={() => onSelect(task)}
        className="block w-full text-left text-[13px] font-medium leading-snug"
      >
        {task.title}
      </button>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <StatusBadge descriptor={TASK_PRIORITY_MAP[task.priority]} />
        {task.due_date && (
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[11px]",
              overdue
                ? "bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-200"
                : "bg-surface-muted text-muted-foreground",
            )}
          >
            {overdue ? "scaduta " : ""}
            {task.due_date}
          </span>
        )}
        {task.project && (
          <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] text-muted-foreground">
            {task.project.emoji ?? "🧩"} {task.project.name}
          </span>
        )}
      </div>

      {canWrite && (
        <label className="mt-2 block">
          <span className="sr-only">Stato di {task.title}</span>
          <select
            value={task.status}
            onChange={(event) => onMove(task.id, event.target.value as TaskStatus)}
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
            className="h-7 w-full rounded-[var(--radius-sm)] border border-border bg-surface px-1.5 text-[11px]"
          >
            {TASK_STATUSES.map((option) => (
              <option key={option.value} value={option.value}>
                {TASK_STATUS_MAP[option.value].label}
              </option>
            ))}
          </select>
        </label>
      )}
    </li>
  );
}
