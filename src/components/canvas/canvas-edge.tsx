"use client";

import * as React from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  getSmoothStepPath,
  getStraightPath,
  useReactFlow,
  type EdgeProps,
  type Edge,
} from "@xyflow/react";
import { Grip } from "lucide-react";
import { toast } from "sonner";

import { updateCanvasEdgeWaypointAction } from "@/server/actions/canvas";

export type MindraftEdgeData = {
  relation?: string;
  sourceHandle?: string;
  targetHandle?: string;
  routeStyle?: "smoothstep" | "bezier" | "straight";
  waypointX?: number | null;
  waypointY?: number | null;
};

export type MindraftEdge = Edge<MindraftEdgeData, "mindraft">;

export function CanvasEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  style,
  label,
  selected,
  data,
}: EdgeProps<MindraftEdge>) {
  const flow = useReactFlow();
  const fallback = { x: (sourceX + targetX) / 2, y: (sourceY + targetY) / 2 };
  const [waypoint, setWaypoint] = React.useState({
    x: data?.waypointX ?? fallback.x,
    y: data?.waypointY ?? fallback.y,
  });

  React.useEffect(() => {
    setWaypoint({
      x: data?.waypointX ?? (sourceX + targetX) / 2,
      y: data?.waypointY ?? (sourceY + targetY) / 2,
    });
  }, [data?.waypointX, data?.waypointY, sourceX, sourceY, targetX, targetY]);

  const hasManualWaypoint = data?.waypointX != null && data?.waypointY != null;
  const routeStyle = data?.routeStyle ?? "smoothstep";
  let edgePath: string;
  let labelX: number;
  let labelY: number;

  if (hasManualWaypoint) {
    edgePath = `M ${sourceX} ${sourceY} L ${waypoint.x} ${waypoint.y} L ${targetX} ${targetY}`;
    labelX = waypoint.x;
    labelY = waypoint.y;
  } else {
    const builder = routeStyle === "straight"
      ? getStraightPath
      : routeStyle === "bezier"
        ? getBezierPath
        : getSmoothStepPath;
    [edgePath, labelX, labelY] = builder({
      sourceX,
      sourceY,
      targetX,
      targetY,
      sourcePosition,
      targetPosition,
    });
  }

  const startDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const move = (pointer: PointerEvent) => {
      setWaypoint(flow.screenToFlowPosition({ x: pointer.clientX, y: pointer.clientY }));
    };
    const stop = (pointer: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      const next = flow.screenToFlowPosition({ x: pointer.clientX, y: pointer.clientY });
      setWaypoint(next);
      void updateCanvasEdgeWaypointAction({ id, waypointX: next.x, waypointY: next.y }).then((result) => {
        if (!result.ok) toast.error(result.error);
      });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop, { once: true });
  };

  return (
    <>
      <BaseEdge
        id={id}
        path={hasManualWaypoint || selected ? `M ${sourceX} ${sourceY} L ${waypoint.x} ${waypoint.y} L ${targetX} ${targetY}` : edgePath}
        markerEnd={markerEnd}
        style={{ ...style, strokeWidth: selected ? 2.5 : 1.5 }}
      />
      <EdgeLabelRenderer>
        {label && (
          <div
            className="pointer-events-none absolute rounded-md border border-border bg-surface/95 px-1.5 py-0.5 text-[11px] font-medium shadow-soft"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          >
            {String(label)}
          </div>
        )}
        {selected && (
          <button
            type="button"
            onPointerDown={startDrag}
            className="nodrag nopan absolute flex size-7 cursor-move items-center justify-center rounded-full border-2 border-primary bg-surface text-primary shadow-raised"
            style={{ transform: `translate(-50%, -50%) translate(${waypoint.x}px, ${waypoint.y}px)` }}
            aria-label="Trascina per spostare la freccia"
            title="Trascina per spostare il percorso"
          >
            <Grip className="size-3.5" />
          </button>
        )}
      </EdgeLabelRenderer>
    </>
  );
}
