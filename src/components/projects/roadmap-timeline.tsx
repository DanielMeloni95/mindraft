"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarRange, List, Plus } from "lucide-react";
import { toast } from "sonner";

import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/empty-state";
import { MILESTONE_STATUS_MAP } from "@/lib/domain/constants";
import { cn } from "@/lib/utils";
import { moveMilestoneAction } from "@/server/actions/planning";
import type { MilestoneRow, TaskRow } from "@/types/database";

import { MilestoneDialog } from "./milestone-dialog";

type Zoom = "week" | "month" | "quarter";

const PX_PER_DAY: Record<Zoom, number> = { week: 26, month: 9, quarter: 3.4 };

function toDate(value: string | null): Date | null {
  return value ? new Date(`${value}T00:00:00`) : null;
}

function toIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/**
 * Timeline and list of the same data. Estimated milestones are marked as
 * such: the roadmap must never let a guess look like a commitment.
 */
export function RoadmapTimeline({
  projectId,
  milestones,
  tasks,
  canWrite,
}: {
  projectId: string;
  milestones: MilestoneRow[];
  tasks: TaskRow[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [zoom, setZoom] = React.useState<Zoom>("month");
  const [view, setView] = React.useState<"timeline" | "list">("timeline");
  const [editing, setEditing] = React.useState<MilestoneRow | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [drag, setDrag] = React.useState<{ id: string; startX: number; days: number } | null>(
    null,
  );

  const dated = milestones.filter((m) => m.starts_on && m.ends_on);
  const undated = milestones.filter((m) => !m.starts_on || !m.ends_on);

  const origin = React.useMemo(() => {
    const dates = dated.map((m) => toDate(m.starts_on)!).sort((a, b) => a.getTime() - b.getTime());
    return dates[0] ? addDays(dates[0], -7) : new Date();
  }, [dated]);

  const totalDays = React.useMemo(() => {
    const ends = dated.map((m) => toDate(m.ends_on)!).sort((a, b) => b.getTime() - a.getTime());
    return ends[0] ? Math.max(30, daysBetween(origin, ends[0]) + 14) : 60;
  }, [dated, origin]);

  const width = totalDays * PX_PER_DAY[zoom];

  const onPointerMove = (event: React.PointerEvent) => {
    if (!drag) return;
    const deltaDays = Math.round((event.clientX - drag.startX) / PX_PER_DAY[zoom]);
    if (deltaDays !== drag.days) setDrag({ ...drag, days: deltaDays });
  };

  const commitDrag = () => {
    if (!drag) return;
    const milestone = milestones.find((m) => m.id === drag.id);
    if (!milestone || drag.days === 0 || !milestone.starts_on || !milestone.ends_on) {
      setDrag(null);
      return;
    }
    const starts = toIso(addDays(toDate(milestone.starts_on)!, drag.days));
    const ends = toIso(addDays(toDate(milestone.ends_on)!, drag.days));
    setDrag(null);
    void moveMilestoneAction(milestone.id, starts, ends).then((result) => {
      if (!result.ok) toast.error(result.error);
      else {
        router.refresh();
        toast.success("Date aggiornate (restano una stima)");
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-[var(--radius-md)] border border-border bg-surface p-0.5" role="group" aria-label="Vista">
          <button
            type="button"
            aria-pressed={view === "timeline"}
            onClick={() => setView("timeline")}
            className={cn(
              "rounded-[var(--radius-sm)] p-1.5",
              view === "timeline" ? "bg-surface-muted text-foreground" : "text-muted-foreground",
            )}
            aria-label="Timeline"
          >
            <CalendarRange className="size-4" />
          </button>
          <button
            type="button"
            aria-pressed={view === "list"}
            onClick={() => setView("list")}
            className={cn(
              "rounded-[var(--radius-sm)] p-1.5",
              view === "list" ? "bg-surface-muted text-foreground" : "text-muted-foreground",
            )}
            aria-label="Lista"
          >
            <List className="size-4" />
          </button>
        </div>

        {view === "timeline" && (
          <select
            value={zoom}
            onChange={(event) => setZoom(event.target.value as Zoom)}
            aria-label="Livello di zoom"
            className="h-9 rounded-[var(--radius-md)] border border-border bg-surface px-2 text-[13px]"
          >
            <option value="week">Settimana</option>
            <option value="month">Mese</option>
            <option value="quarter">Trimestre</option>
          </select>
        )}

        {canWrite && (
          <Button variant="primary" size="sm" className="ml-auto" onClick={() => setCreating(true)}>
            <Plus /> Milestone
          </Button>
        )}
      </div>

      {milestones.length === 0 ? (
        <EmptyState
          icon={CalendarRange}
          title="Nessuna milestone"
          description="La roadmap serve a rendere visibile una sequenza, non a riempire un calendario. Comincia con due o tre tappe."
          action={
            canWrite ? (
              <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
                Aggiungi la prima
              </Button>
            ) : undefined
          }
        />
      ) : view === "timeline" ? (
        <div className="surface-card overflow-x-auto p-4">
          <div
            className="relative"
            style={{ width: Math.max(width, 640), minHeight: dated.length * 52 + 40 }}
            onPointerMove={onPointerMove}
            onPointerUp={commitDrag}
            onPointerLeave={() => setDrag(null)}
          >
            {Array.from({ length: Math.ceil(totalDays / 7) }).map((_, index) => (
              <div
                key={index}
                className="absolute top-0 h-full border-l border-border/60"
                style={{ left: index * 7 * PX_PER_DAY[zoom] }}
                aria-hidden
              >
                {zoom !== "quarter" && (
                  <span className="ml-1 text-[10px] text-subtle-foreground">
                    {toIso(addDays(origin, index * 7)).slice(5)}
                  </span>
                )}
              </div>
            ))}

            {dated.map((milestone, index) => {
              const start = toDate(milestone.starts_on)!;
              const end = toDate(milestone.ends_on)!;
              const offsetDays = daysBetween(origin, start) + (drag?.id === milestone.id ? drag.days : 0);
              const durationDays = Math.max(1, daysBetween(start, end));
              return (
                <div
                  key={milestone.id}
                  className={cn(
                    "absolute flex h-9 items-center gap-2 rounded-[var(--radius-md)] border px-2 text-[12px] shadow-soft",
                    milestone.status === "done"
                      ? "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/30"
                      : milestone.status === "in_progress"
                        ? "border-brand-300 bg-brand-50 dark:border-brand-700 dark:bg-brand-900/40"
                        : "border-border bg-surface-muted",
                    canWrite && "cursor-grab active:cursor-grabbing",
                  )}
                  style={{
                    left: offsetDays * PX_PER_DAY[zoom],
                    top: index * 52 + 24,
                    width: Math.max(80, durationDays * PX_PER_DAY[zoom]),
                  }}
                  onPointerDown={(event) => {
                    if (!canWrite) return;
                    event.currentTarget.setPointerCapture(event.pointerId);
                    setDrag({ id: milestone.id, startX: event.clientX, days: 0 });
                  }}
                  onDoubleClick={() => canWrite && setEditing(milestone)}
                  title={`${milestone.title} · ${milestone.starts_on} → ${milestone.ends_on}${milestone.is_estimate ? " (stima)" : ""}`}
                >
                  <span className="truncate font-medium">{milestone.title}</span>
                  {milestone.is_estimate && (
                    <span className="shrink-0 rounded-full bg-surface px-1.5 text-[10px] text-muted-foreground">
                      stima
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {undated.length > 0 && (
            <p className="mt-4 text-[12px] text-muted-foreground">
              Senza date: {undated.map((m) => m.title).join(", ")}
            </p>
          )}
        </div>
      ) : (
        <ul className="surface-card divide-y divide-border">
          {milestones.map((milestone) => {
            const linked = tasks.filter((task) => task.milestone_id === milestone.id);
            const done = linked.filter((task) => task.status === "done").length;
            return (
              <li key={milestone.id} className="p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-display text-[14px] font-semibold">{milestone.title}</span>
                  <StatusBadge descriptor={MILESTONE_STATUS_MAP[milestone.status]} />
                  {milestone.is_estimate && (
                    <span className="rounded-full border border-border bg-surface-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                      date stimate
                    </span>
                  )}
                  {canWrite && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-auto"
                      onClick={() => setEditing(milestone)}
                    >
                      Modifica
                    </Button>
                  )}
                </div>

                {milestone.description && (
                  <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                    {milestone.description}
                  </p>
                )}

                <div className="mt-2 flex flex-wrap items-center gap-3 text-[12px] text-subtle-foreground">
                  <span>
                    {milestone.starts_on ?? "—"} → {milestone.ends_on ?? "—"}
                  </span>
                  <span>
                    {linked.length > 0
                      ? `${done}/${linked.length} attività completate`
                      : "nessuna attività collegata"}
                  </span>
                </div>

                <Progress value={milestone.progress} className="mt-2 max-w-sm" />
              </li>
            );
          })}
        </ul>
      )}

      {(creating || editing) && (
        <MilestoneDialog
          projectId={projectId}
          milestone={editing}
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
