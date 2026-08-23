"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react";

import "@xyflow/react/dist/style.css";

import { Button } from "@/components/ui/button";
import { CANVAS_NODE_STYLES, RELATION_MAP } from "@/lib/domain/constants";
import { cn } from "@/lib/utils";
import type { GraphData } from "@/server/queries/canvas";
import type { RelationType } from "@/types/database";

type Filter = "all" | "idea" | "project" | "decision" | "orphans";

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: "all", label: "Tutto" },
  { value: "project", label: "Progetti" },
  { value: "idea", label: "Idee" },
  { value: "decision", label: "Decisioni" },
  { value: "orphans", label: "Orfani" },
];

/**
 * The global map exists to answer operational questions — what is
 * connected to what, what is floating alone — not to look like a starry
 * sky. Hence the filters, and hence "orfani" being a first-class view.
 */
export function GlobalGraph({ data }: { data: GraphData }) {
  const router = useRouter();
  const [filter, setFilter] = React.useState<Filter>("all");

  const visible = React.useMemo(() => {
    if (filter === "all") return data.nodes;
    if (filter === "orphans") return data.nodes.filter((node) => node.orphan);
    return data.nodes.filter((node) => node.type === filter);
  }, [data.nodes, filter]);

  const visibleIds = React.useMemo(() => new Set(visible.map((n) => n.id)), [visible]);

  const nodes: Node[] = React.useMemo(() => {
    const columns = Math.max(3, Math.ceil(Math.sqrt(visible.length)));
    return visible.map((node, index) => ({
      id: node.id,
      position: {
        x: (index % columns) * 240,
        y: Math.floor(index / columns) * 130,
      },
      data: { label: node.label },
      style: {
        borderRadius: 12,
        border: `1px solid ${
          CANVAS_NODE_STYLES[node.type as keyof typeof CANVAS_NODE_STYLES]?.accent ?? "#8D92AD"
        }`,
        background:
          CANVAS_NODE_STYLES[node.type as keyof typeof CANVAS_NODE_STYLES]?.surface ??
          "transparent",
        padding: 10,
        fontSize: 12,
        width: 200,
        opacity: node.orphan ? 0.75 : 1,
      },
    }));
  }, [visible]);

  const edges: Edge[] = React.useMemo(
    () =>
      data.edges
        .filter((edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target))
        .map((edge) => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          label: RELATION_MAP[edge.relation as RelationType]?.label,
        })),
    [data.edges, visibleIds],
  );

  const orphanCount = data.nodes.filter((node) => node.orphan).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {FILTERS.map((option) => (
          <Button
            key={option.value}
            variant={filter === option.value ? "subtle" : "ghost"}
            size="sm"
            aria-pressed={filter === option.value}
            onClick={() => setFilter(option.value)}
            className={cn(filter === option.value && "text-foreground")}
          >
            {option.label}
            {option.value === "orphans" && orphanCount > 0 && ` (${orphanCount})`}
          </Button>
        ))}
        <span className="ml-auto text-[12px] text-muted-foreground">
          {visible.length} elementi · {edges.length} collegamenti
        </span>
      </div>

      <div className="surface-card h-[70vh] min-h-[420px] overflow-hidden">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          fitView
          nodesDraggable={false}
          nodesConnectable={false}
          proOptions={{ hideAttribution: true }}
          onNodeClick={(_, node) => {
            const target = data.nodes.find((n) => n.id === node.id);
            if (!target) return;
            if (target.type === "idea") router.push(`/ideas/${target.id}`);
            else if (target.type === "project") router.push(`/projects/${target.id}`);
          }}
          className="h-full w-full"
          aria-label="Grafo globale del workspace"
        >
          <Background gap={22} size={1} color="var(--border)" />
          <Controls showInteractive={false} />
          <MiniMap pannable zoomable className="!bg-[var(--surface)] !border !border-[var(--border)]" />
        </ReactFlow>
      </div>

      {filter === "orphans" && orphanCount > 0 && (
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          Questi elementi non sono collegati a nulla. Non è per forza un problema: spesso
          è il segnale che un&apos;idea aspetta di diventare un progetto, o che una
          decisione è rimasta senza contesto.
        </p>
      )}
    </div>
  );
}
