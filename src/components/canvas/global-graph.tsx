"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  applyNodeChanges,
  Background,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeChange,
  type NodeProps,
} from "@xyflow/react";
import { LayoutGrid, Maximize2, Minimize2, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";

import "@xyflow/react/dist/style.css";

import { Button } from "@/components/ui/button";
import { CANVAS_NODE_STYLES, RELATION_MAP } from "@/lib/domain/constants";
import { cn } from "@/lib/utils";
import type { GraphData } from "@/server/queries/canvas";
import type { RelationType } from "@/types/database";

type Filter = "all" | "area" | "project" | "subproject" | "tool";

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: "all", label: "Tutto" },
  { value: "area", label: "Ambiti" },
  { value: "project", label: "Progetti" },
  { value: "subproject", label: "Sottoprogetti" },
  { value: "tool", label: "Strumenti" },
];

type GlobalNodeData = { label: string; kind: GraphData["nodes"][number]["kind"]; color: string; icon: string };
type GlobalNode = Node<GlobalNodeData, "global">;

function GlobalNodeCard({ data, selected }: NodeProps<GlobalNode>) {
  const kindLabel = data.kind === "me" ? "Utente" : data.kind === "area" ? "Ambito"
    : data.kind === "tool" ? "Strumento" : data.kind === "subproject" ? "Sottoprogetto" : "Progetto";
  return <div className={cn("relative min-w-52 max-w-72 rounded-xl border bg-surface p-3 shadow-soft", selected && "ring-2 ring-primary ring-offset-2")} style={{ borderColor: data.color, backgroundColor: `${data.color}1A` }}>
    <Handle type="target" position={Position.Top} className="!size-2 !border-surface !bg-foreground" />
    <div className="flex items-center gap-1.5">
      <span className="text-lg" aria-hidden>{data.icon}</span>
      <span className="size-2 rounded-full" style={{ backgroundColor: data.color }} />
      <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">{kindLabel}</span>
    </div>
    <p className="mt-1 break-words text-[13px] font-medium leading-snug">{data.label}</p>
    <Handle type="source" position={Position.Bottom} className="!size-2 !border-surface !bg-foreground" />
  </div>;
}

const globalNodeTypes = { global: GlobalNodeCard };

/**
 * The global map exists to answer operational questions — what is
 * connected to what, what is floating alone — not to look like a starry
 * sky. Hence the filters, and hence "orfani" being a first-class view.
 */
function arrangedNodes(data: GraphData): GlobalNode[] {
  const byId = new Map(data.nodes.map((node) => [node.id, node]));
  const primaryParent = new Map<string, string>();
  const orderedEdges = [...data.edges].sort((a, b) => Number(b.relation === "part_of") - Number(a.relation === "part_of"));
  for (const edge of orderedEdges) if (!primaryParent.has(edge.target)) primaryParent.set(edge.target, edge.source);
  const children = new Map<string, string[]>();
  for (const [child, parent] of primaryParent) children.set(parent, [...(children.get(parent) ?? []), child]);
  for (const nested of children.values()) nested.sort((a, b) => (byId.get(a)?.label ?? "").localeCompare(byId.get(b)?.label ?? "", "it"));
  const positions = new Map<string, { x: number; y: number }>();
  const visiting = new Set<string>();
  let leaf = 0;
  const place = (id: string, depth: number) => {
    if (positions.has(id) || visiting.has(id)) return;
    visiting.add(id);
    const nested = (children.get(id) ?? []).filter((child) => byId.has(child));
    for (const child of nested) place(child, depth + 1);
    const childXs = nested.map((child) => positions.get(child)?.x).filter((x): x is number => x !== undefined);
    positions.set(id, { x: childXs.length ? (Math.min(...childXs) + Math.max(...childXs)) / 2 : leaf++ * 340, y: depth * 220 });
    visiting.delete(id);
  };
  place("me", 0);
  for (const node of data.nodes) if (!positions.has(node.id)) place(node.id, node.level);
  const totalWidth = Math.max(0, (leaf - 1) * 340);
  return data.nodes.map((node) => {
      const accent = node.kind === "me" ? "#2563eb" : node.kind === "tool" ? "#f59e0b"
        : node.color || (node.kind === "area" ? "#8b5cf6" : CANVAS_NODE_STYLES.project.accent);
      const icon = node.kind === "me" ? "👤" : node.kind === "tool" ? "🛠️"
        : node.kind === "area" ? "🗂️" : node.kind === "subproject" ? "🧩" : "📁";
    return {
      id: node.id,
      type: "global" as const,
      position: { x: (positions.get(node.id)?.x ?? 0) - totalWidth / 2, y: positions.get(node.id)?.y ?? node.level * 220 },
      data: { label: node.label, kind: node.kind, color: accent, icon },
      style: { width: 220 },
    };
  });
}

export function GlobalGraph({ data, workspaceId, canWrite }: { data: GraphData; workspaceId: string; canWrite: boolean }) {
  const router = useRouter();
  const [filter, setFilter] = React.useState<Filter>("all");
  const [nodes, setNodes] = React.useState<GlobalNode[]>(() => arrangedNodes(data));
  const [dirty, setDirty] = React.useState(false);
  const [expanded, setExpanded] = React.useState(false);
  const storageKey = `mindraft:global-map:v4:${workspaceId}`;

  React.useEffect(() => {
    if (!expanded) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const close = (event: KeyboardEvent) => event.key === "Escape" && setExpanded(false);
    window.addEventListener("keydown", close);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", close);
    };
  }, [expanded]);

  React.useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);
    let positions: Record<string, { x: number; y: number }> = {};
    try {
      positions = saved ? JSON.parse(saved) as Record<string, { x: number; y: number }> : {};
    } catch {
      window.localStorage.removeItem(storageKey);
    }
    setNodes(arrangedNodes(data).map((node) => positions[node.id]
      ? { ...node, position: positions[node.id] } : node));
    setDirty(false);
  }, [data, storageKey]);

  const visible = React.useMemo(() => {
    const allowed = filter === "all" ? data.nodes
      : data.nodes.filter((node) => node.kind === filter || node.kind === "me");
    const ids = new Set(allowed.map((node) => node.id));
    return nodes.filter((node) => ids.has(node.id));
  }, [data.nodes, filter, nodes]);

  const visibleIds = React.useMemo(() => new Set(visible.map((n) => n.id)), [visible]);

  const edges: Edge[] = React.useMemo(
    () =>
      data.edges
        .filter((edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target))
        .map((edge) => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          label: edge.relation === "part_of" ? "Contiene" : RELATION_MAP[edge.relation as RelationType]?.label,
          type: "smoothstep",
          markerEnd: { type: MarkerType.ArrowClosed },
          deletable: false,
        })),
    [data.edges, visibleIds],
  );

  return (
    <div className={cn("space-y-3", expanded && "fixed inset-0 z-50 overflow-hidden bg-background p-4")}>
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
          </Button>
        ))}
        <span className="ml-auto text-[12px] text-muted-foreground">
          {visible.length} elementi · {edges.length} collegamenti
        </span>
        <Button variant="secondary" size="sm" onClick={() => {
          setNodes(arrangedNodes(data));
          setDirty(true);
        }}>
          <LayoutGrid /> Disponi
        </Button>
        <Button variant="secondary" size="sm" disabled={!dirty} onClick={() => {
          const positions = Object.fromEntries(nodes.map((node) => [node.id, node.position]));
          window.localStorage.setItem(storageKey, JSON.stringify(positions));
          setDirty(false);
          toast.success("Layout della mappa globale salvato");
        }}>
          <Save /> Salva layout
        </Button>
        <Button variant="ghost" size="sm" onClick={() => {
          window.localStorage.removeItem(storageKey);
          setNodes(arrangedNodes(data));
          setDirty(false);
          toast.success("Layout ripristinato");
        }}>
          <RotateCcw /> Ripristina
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setExpanded((value) => !value)}>
          {expanded ? <Minimize2 /> : <Maximize2 />} {expanded ? "Riduci" : "Tutto schermo"}
        </Button>
      </div>

      <div className={cn("surface-card h-[70vh] min-h-[420px] overflow-hidden", expanded && "h-[calc(100vh-5.5rem)]")}>
        <ReactFlow
          nodeTypes={globalNodeTypes}
          nodes={visible}
          edges={edges}
          fitView
          nodesDraggable={canWrite}
          nodesConnectable={false}
          onNodesChange={(changes: NodeChange<GlobalNode>[]) => {
            setNodes((current) => applyNodeChanges<GlobalNode>(changes, current));
            if (changes.some((change) => change.type === "position")) setDirty(true);
          }}
          proOptions={{ hideAttribution: true }}
          onNodeClick={(_, node) => {
            const target = data.nodes.find((n) => n.id === node.id);
            if (!target || target.kind === "me") return;
            router.push(`/projects/${target.id}`);
          }}
          className="h-full w-full"
          aria-label="Grafo globale del workspace"
        >
          <Background gap={22} size={1} color="var(--border)" />
          <Controls showInteractive={false} />
          <MiniMap pannable zoomable className="!bg-[var(--surface)] !border !border-[var(--border)]" />
        </ReactFlow>
      </div>

    </div>
  );
}
