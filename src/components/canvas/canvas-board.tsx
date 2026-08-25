"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Background,
  ConnectionMode,
  Controls,
  MiniMap,
  MarkerType,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type NodeChange,
} from "@xyflow/react";
import { toPng } from "html-to-image";
import { ArrowLeftRight, Download, GitBranch, LayoutGrid, Maximize2, Minimize2, Plus, Presentation, Route, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import "@xyflow/react/dist/style.css";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CANVAS_NODE_STYLES, RELATION_TYPES } from "@/lib/domain/constants";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  createCanvasEdgeAction,
  createCanvasNodeAction,
  deleteCanvasEdgeAction,
  deleteCanvasNodeAction,
  promoteNodeAction,
  saveCanvasLayoutAction,
  updateCanvasEdgeAction,
  updateCanvasEdgeRoutingAction,
  updateCanvasNodeAction,
} from "@/server/actions/canvas";
import type {
  CanvasEdgeRow,
  CanvasNodeRow,
  CanvasNodeType,
  RelationType,
} from "@/types/database";

import { CanvasNodeCard, type MindraftNode } from "./canvas-node";
import { CanvasEdge, type MindraftEdge } from "./canvas-edge";

const nodeTypes = { mindraft: CanvasNodeCard };
const edgeTypes = { mindraft: CanvasEdge };

type NodeVariant = "default" | "subproject" | "tool";
type AddableNode = { type: CanvasNodeType; label: string; icon: string; variant?: Exclude<NodeVariant, "default"> };
type NodeCluster = { id: string; label: string; icon: string; nodes: AddableNode[] };
const NODE_CLUSTERS: NodeCluster[] = [
  { id: "structure", label: "Struttura progetto", icon: "🗂️", nodes: [
    { type: "project", label: "Progetto", icon: "📁" },
    { type: "project", label: "Sottoprogetto", icon: "🧩", variant: "subproject" },
    { type: "goal", label: "Visione", icon: "🔭" },
    { type: "goal", label: "Obiettivo", icon: "🎯" },
    { type: "goal", label: "Risultato chiave", icon: "🏁" },
  ] },
  { id: "market", label: "Mercato e target", icon: "🌍", nodes: [
    { type: "idea", label: "Target", icon: "🎯" },
    { type: "idea", label: "Persona", icon: "👤" },
    { type: "idea", label: "Bisogno", icon: "💭" },
    { type: "idea", label: "Problema", icon: "🧱" },
    { type: "idea", label: "Insight", icon: "💡" },
    { type: "resource", label: "Competitor", icon: "⚔️" },
    { type: "resource", label: "Trend", icon: "📈" },
  ] },
  { id: "product", label: "Prodotto e soluzione", icon: "📦", nodes: [
    { type: "feature", label: "Funzionalità", icon: "✨" },
    { type: "feature", label: "Requisito", icon: "📋" },
    { type: "feature", label: "User journey", icon: "🧭" },
    { type: "feature", label: "Esperimento", icon: "🧪" },
    { type: "idea", label: "Proposta di valore", icon: "💎" },
    { type: "decision", label: "Vincolo", icon: "🔒" },
  ] },
  { id: "business", label: "Business e monetizzazione", icon: "💰", nodes: [
    { type: "goal", label: "Monetizzazione", icon: "💰" },
    { type: "goal", label: "Pricing", icon: "🏷️" },
    { type: "resource", label: "Canale", icon: "📣" },
    { type: "resource", label: "Partner", icon: "🤝" },
    { type: "resource", label: "Costo", icon: "🧾" },
    { type: "goal", label: "KPI / Metrica", icon: "📊" },
    { type: "goal", label: "Revenue stream", icon: "💵" },
  ] },
  { id: "execution", label: "Pianificazione ed execution", icon: "🗓️", nodes: [
    { type: "goal", label: "Milestone", icon: "🚩" },
    { type: "task", label: "Attività", icon: "✅" },
    { type: "task", label: "Dipendenza", icon: "🔗" },
    { type: "decision", label: "Decisione", icon: "⚖️" },
    { type: "risk", label: "Rischio", icon: "⚠️" },
    { type: "risk", label: "Assunzione", icon: "❓" },
  ] },
  { id: "resources", label: "Risorse e conoscenza", icon: "🧰", nodes: [
    { type: "resource", label: "Strumento", icon: "🛠️", variant: "tool" },
    { type: "resource", label: "Persona / Ruolo", icon: "👥" },
    { type: "resource", label: "Budget", icon: "💳" },
    { type: "resource", label: "Link / Fonte", icon: "🔗" },
    { type: "resource", label: "Documento", icon: "📄" },
    { type: "note", label: "Nota", icon: "📝" },
    { type: "text", label: "Testo libero", icon: "🔤" },
  ] },
];
const ADDABLE = NODE_CLUSTERS.flatMap((cluster) => cluster.nodes);

const ICON_PRESETS = ["📁", "🧩", "🚀", "💡", "🎯", "⭐", "🔥", "✅", "🛠️", "📌", "🌱", "🎨", "💻", "📊", "❤️", "⚡"];

function nodeMetadata(value: CanvasNodeRow["data"]): { icon: string | null; variant: NodeVariant } {
  if (!value || Array.isArray(value) || typeof value !== "object") return { icon: null, variant: "default" };
  const record = value as Record<string, unknown>;
  return {
    icon: typeof record.icon === "string" ? record.icon : null,
    variant: record.variant === "subproject" || record.variant === "tool" ? record.variant : "default",
  };
}

function toFlowNodes(
  rows: CanvasNodeRow[],
  dimmedIds: Set<string>,
  onRename: (id: string, label: string) => void,
): MindraftNode[] {
  return rows.map((row) => ({
    id: row.id,
    type: "mindraft" as const,
    position: { x: row.position_x, y: row.position_y },
    data: {
      ...nodeMetadata(row.data),
      color: row.color,
      label: row.label,
      body: row.body,
      nodeType: row.type,
      entityType: row.entity_type,
      entityId: row.entity_id,
      dimmed: dimmedIds.has(row.id),
      onRename,
    },
  }));
}

function toFlowEdges(rows: CanvasEdgeRow[]): MindraftEdge[] {
  return rows.map((row) => ({
    id: row.id,
    source: row.source_node_id,
    target: row.target_node_id,
    sourceHandle: row.source_handle ?? (row.relation === "part_of" ? "top" : "right"),
    targetHandle: row.target_handle ?? (row.relation === "part_of" ? "bottom" : "left"),
    label: row.label || RELATION_TYPES.find((r) => r.value === row.relation)?.label,
    data: {
      relation: row.relation,
      sourceHandle: row.source_handle ?? (row.relation === "part_of" ? "top" : "right"),
      targetHandle: row.target_handle ?? (row.relation === "part_of" ? "bottom" : "left"),
      routeStyle: row.route_style ?? "smoothstep",
      waypointX: row.waypoint_x ?? null,
      waypointY: row.waypoint_y ?? null,
    },
    animated: row.relation === "blocks",
    type: "mindraft" as const,
    markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
    style: { stroke: "var(--border-strong)", strokeWidth: 1.5 },
    labelStyle: { fontSize: 11, fontWeight: 500, fill: "var(--foreground)" },
    labelBgStyle: { fill: "var(--surface)", fillOpacity: 0.94 },
    labelBgPadding: [6, 4] as [number, number],
    labelBgBorderRadius: 6,
    zIndex: 0,
  }));
}

function CanvasInner({
  canvasId,
  initialNodes,
  initialEdges,
  canWrite,
}: {
  canvasId: string;
  initialNodes: CanvasNodeRow[];
  initialEdges: CanvasEdgeRow[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const flow = useReactFlow<MindraftNode, Edge>();
  const wrapperRef = React.useRef<HTMLDivElement>(null);
  const [search, setSearch] = React.useState("");
  const [paletteSearch, setPaletteSearch] = React.useState("");
  const [presenting, setPresenting] = React.useState(false);
  const [expanded, setExpanded] = React.useState(false);
  const [nodeDialogOpen, setNodeDialogOpen] = React.useState(false);
  const [nodeKind, setNodeKind] = React.useState<AddableNode>(ADDABLE[0]);
  const [nodeLabel, setNodeLabel] = React.useState("");
  const [nodeBody, setNodeBody] = React.useState("");
  const [nodeIcon, setNodeIcon] = React.useState("📁");
  const [creatingNode, startCreatingNode] = React.useTransition();
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [settingsLabel, setSettingsLabel] = React.useState("");
  const [settingsBody, setSettingsBody] = React.useState("");
  const [settingsIcon, setSettingsIcon] = React.useState("");
  const [settingsColor, setSettingsColor] = React.useState("#5B5CE2");
  const [savingSettings, startSavingSettings] = React.useTransition();
  const [edgeSettingsOpen, setEdgeSettingsOpen] = React.useState(false);
  const [edgeSourceHandle, setEdgeSourceHandle] = React.useState<"top" | "right" | "bottom" | "left">("right");
  const [edgeTargetHandle, setEdgeTargetHandle] = React.useState<"top" | "right" | "bottom" | "left">("left");
  const [edgeRouteStyle, setEdgeRouteStyle] = React.useState<"smoothstep" | "bezier" | "straight">("smoothstep");
  const [savingEdge, startSavingEdge] = React.useTransition();
  const [draftPosition, setDraftPosition] = React.useState<{ x: number; y: number } | null>(null);
  const saveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const draggingNodeIds = React.useRef(new Set<string>());

  React.useEffect(() => {
    if (!expanded && !presenting) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [expanded, presenting]);

  React.useEffect(() => {
    const closeFullscreen = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setExpanded(false);
        setPresenting(false);
      }
    };
    window.addEventListener("keydown", closeFullscreen);
    return () => window.removeEventListener("keydown", closeFullscreen);
  }, []);

  const rename = React.useCallback(
    (id: string, label: string) => {
      setNodes((current) =>
        current.map((node) =>
          node.id === id ? { ...node, data: { ...node.data, label } } : node,
        ),
      );
      void updateCanvasNodeAction({ id, label }).then((result) => {
        if (!result.ok) toast.error(result.error);
        else router.refresh();
      });
    },
    // setNodes is defined below by useNodesState; the reference is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [router],
  );

  const [nodes, setNodes, onNodesChangeInternal] = useNodesState<MindraftNode>(
    toFlowNodes(initialNodes, new Set(), rename),
  );
  const [edges, setEdges, onEdgesChangeInternal] = useEdgesState<Edge>(
    toFlowEdges(initialEdges),
  );

  // Keep local state aligned when a server refresh supplies a newer bundle.
  React.useEffect(() => {
    setNodes(toFlowNodes(initialNodes, new Set(), rename));
  }, [initialNodes, rename, setNodes]);

  React.useEffect(() => {
    setEdges(toFlowEdges(initialEdges));
  }, [initialEdges, setEdges]);

  // Supabase Realtime keeps every open view of this canvas in sync. Upserts
  // make local optimistic inserts idempotent when their realtime echo arrives.
  React.useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`canvas:${canvasId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "canvas_nodes", filter: `canvas_id=eq.${canvasId}` },
        (payload) => {
          const row = payload.new as CanvasNodeRow;
          const incoming = toFlowNodes([row], new Set(), rename)[0];
          setNodes((current) => current.some((node) => node.id === incoming.id)
            ? current.map((node) => node.id === incoming.id ? { ...incoming, selected: node.selected } : node)
            : [...current, incoming]);
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "canvas_nodes", filter: `canvas_id=eq.${canvasId}` },
        (payload) => {
          const incoming = toFlowNodes([payload.new as CanvasNodeRow], new Set(), rename)[0];
          if (draggingNodeIds.current.has(incoming.id)) return;
          setNodes((current) => current.map((node) =>
            node.id === incoming.id ? { ...incoming, selected: node.selected } : node));
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "canvas_nodes", filter: `canvas_id=eq.${canvasId}` },
        (payload) => {
          const id = (payload.old as { id?: string }).id;
          if (id) setNodes((current) => current.filter((node) => node.id !== id));
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "canvas_edges", filter: `canvas_id=eq.${canvasId}` },
        (payload) => {
          const incoming = toFlowEdges([payload.new as CanvasEdgeRow])[0];
          setEdges((current) => current.some((edge) => edge.id === incoming.id)
            ? current.map((edge) => edge.id === incoming.id ? { ...incoming, selected: edge.selected } : edge)
            : [...current, incoming]);
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "canvas_edges", filter: `canvas_id=eq.${canvasId}` },
        (payload) => {
          const incoming = toFlowEdges([payload.new as CanvasEdgeRow])[0];
          setEdges((current) => current.map((edge) =>
            edge.id === incoming.id ? { ...incoming, selected: edge.selected } : edge));
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "canvas_edges", filter: `canvas_id=eq.${canvasId}` },
        (payload) => {
          const id = (payload.old as { id?: string }).id;
          if (id) setEdges((current) => current.filter((edge) => edge.id !== id));
        },
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") toast.error("Sincronizzazione realtime non disponibile.");
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [canvasId, rename, setEdges, setNodes]);

  // Dim non-matching nodes rather than hiding them: the shape of the map
  // is information too.
  React.useEffect(() => {
    const term = search.trim().toLowerCase();
    setNodes((current) =>
      current.map((node) => ({
        ...node,
        data: {
          ...node.data,
          dimmed:
            term.length > 1 &&
            !`${node.data.label} ${node.data.body ?? ""}`.toLowerCase().includes(term),
        },
      })),
    );
  }, [search, setNodes]);

  const scheduleLayoutSave = React.useCallback(() => {
    if (!canWrite) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const payload = flow.getNodes().map((node) => ({
        id: node.id,
        positionX: Math.round(node.position.x),
        positionY: Math.round(node.position.y),
      }));
      void saveCanvasLayoutAction({
        canvasId,
        nodes: payload,
        viewport: flow.getViewport(),
      }).then((result) => {
        if (!result.ok) toast.error(result.error);
      });
    }, 700);
  }, [canWrite, canvasId, flow]);

  const onNodesChange = React.useCallback(
    (changes: NodeChange<MindraftNode>[]) => {
      onNodesChangeInternal(changes);
    },
    [onNodesChangeInternal],
  );

  const onEdgesChange = React.useCallback(
    (changes: EdgeChange<Edge>[]) => {
      onEdgesChangeInternal(changes);
      for (const change of changes) {
        if (change.type === "remove" && canWrite) {
          void deleteCanvasEdgeAction(change.id);
        }
      }
    },
    [onEdgesChangeInternal, canWrite],
  );

  const onConnect = React.useCallback(
    (connection: Connection) => {
      if (!canWrite) return;
      void createCanvasEdgeAction({
        canvasId,
        sourceNodeId: connection.source,
        targetNodeId: connection.target,
        relation: "relates_to",
        sourceHandle: connection.sourceHandle ?? "right",
        targetHandle: connection.targetHandle ?? "left",
      }).then((result) => {
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        setEdges((current) =>
          addEdge(
            {
              ...connection,
              id: result.data.id,
              label: "È correlato a",
              type: "mindraft",
              markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
              data: {
                relation: "relates_to",
                sourceHandle: connection.sourceHandle ?? "right",
                targetHandle: connection.targetHandle ?? "left",
                routeStyle: "smoothstep",
              },
            },
            current,
          ),
        );
      });
    },
    [canWrite, canvasId, setEdges],
  );

  const openNodeDialog = (kind: AddableNode, position?: { x: number; y: number }) => {
    setNodeKind(kind);
    setNodeLabel("");
    setNodeBody("");
    setNodeIcon(kind.icon);
    setDraftPosition(position ?? null);
    setNodeDialogOpen(true);
  };

  const addNode = () => {
    if (!nodeLabel.trim()) {
      toast.error("Inserisci un titolo per il nodo.");
      return;
    }
    const bounds = wrapperRef.current?.getBoundingClientRect();
    const centre = flow.screenToFlowPosition({
      x: (bounds?.left ?? 0) + (bounds?.width ?? 800) / 2,
      y: (bounds?.top ?? 0) + (bounds?.height ?? 500) / 2,
    });
    const position = draftPosition ?? {
      x: Math.round(centre.x + (Math.random() - 0.5) * 80),
      y: Math.round(centre.y + (Math.random() - 0.5) * 80),
    };
    startCreatingNode(async () => {
      const result = await createCanvasNodeAction({
        canvasId,
        type: nodeKind.type,
        label: nodeLabel.trim(),
        body: nodeBody.trim() || undefined,
        icon: nodeIcon.trim() || undefined,
        variant: nodeKind.variant ?? "default",
        positionX: position.x,
        positionY: position.y,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setNodes((current) => [...current, {
        id: result.data.id,
        type: "mindraft",
        position,
        data: {
          label: nodeLabel.trim(),
          body: nodeBody.trim() || null,
          nodeType: nodeKind.type,
          entityType: result.data.entityType ?? null,
          entityId: result.data.entityId ?? null,
          icon: nodeIcon.trim() || null,
          variant: nodeKind.variant ?? "default",
          color: null,
          dimmed: false,
          onRename: rename,
        },
      }]);
      setNodeDialogOpen(false);
      setDraftPosition(null);
      toast.success("Nodo inserito");
    });
  };

  /** Hierarchical when part-of edges exist, compact grid otherwise. */
  const autoLayout = () => {
    const current = flow.getNodes();
    if (current.length === 0) return;
    const hierarchicalEdges = flow.getEdges().filter((edge) =>
      (edge.data as { relation?: RelationType } | undefined)?.relation === "part_of");
    const parentByChild = new Map(hierarchicalEdges.map((edge) => [edge.source, edge.target]));
    const children = new Map<string, string[]>();
    for (const edge of hierarchicalEdges) {
      children.set(edge.target, [...(children.get(edge.target) ?? []), edge.source]);
    }
    const positions = new Map<string, { x: number; y: number }>();
    let leaf = 0;
    const visiting = new Set<string>();
    const place = (id: string, depth: number) => {
      if (visiting.has(id) || positions.has(id)) return;
      visiting.add(id);
      const nested = children.get(id) ?? [];
      for (const child of nested) place(child, depth + 1);
      if (nested.length === 0) positions.set(id, { x: leaf++ * 280, y: depth * 190 });
      else {
        const xs = nested.map((child) => positions.get(child)?.x).filter((x): x is number => x !== undefined);
        positions.set(id, { x: xs.length ? (Math.min(...xs) + Math.max(...xs)) / 2 : leaf++ * 280, y: depth * 190 });
      }
      visiting.delete(id);
    };
    const roots = current.filter((node) => !parentByChild.has(node.id));
    if (hierarchicalEdges.length) {
      for (const root of roots) place(root.id, 0);
      for (const node of current) if (!positions.has(node.id)) place(node.id, 0);
    } else {
      const columns = Math.max(1, Math.ceil(Math.sqrt(current.length)));
      current.forEach((node, index) => positions.set(node.id, {
        x: (index % columns) * 280,
        y: Math.floor(index / columns) * 180,
      }));
    }
    const next = current.map((node) => ({ ...node, position: positions.get(node.id) ?? node.position }));
    setNodes(next);
    scheduleLayoutSave();
    setTimeout(() => flow.fitView({ padding: 0.2, duration: 300 }), 50);
  };

  const exportPng = async () => {
    const viewport = wrapperRef.current?.querySelector<HTMLElement>(".react-flow__viewport");
    if (!viewport) return;
    try {
      const dataUrl = await toPng(viewport, {
        backgroundColor: getComputedStyle(document.body).backgroundColor,
        pixelRatio: 2,
      });
      const anchor = document.createElement("a");
      anchor.href = dataUrl;
      anchor.download = "mindraft-mappa.png";
      anchor.click();
    } catch {
      toast.error("Esportazione non riuscita in questo browser.");
    }
  };

  const selectedNode = nodes.find((node) => node.selected);
  const selectedEdge = edges.find((edge) => edge.selected);

  const openEdgeSettings = (edge: Edge) => {
    const data = edge.data as {
      sourceHandle?: "top" | "right" | "bottom" | "left";
      targetHandle?: "top" | "right" | "bottom" | "left";
      routeStyle?: "smoothstep" | "bezier" | "straight";
    } | undefined;
    setEdgeSourceHandle(data?.sourceHandle ?? (edge.sourceHandle as typeof edgeSourceHandle) ?? "right");
    setEdgeTargetHandle(data?.targetHandle ?? (edge.targetHandle as typeof edgeTargetHandle) ?? "left");
    setEdgeRouteStyle(data?.routeStyle ?? (edge.type === "straight" ? "straight" : edge.type === "default" ? "bezier" : "smoothstep"));
    setEdgeSettingsOpen(true);
  };

  const saveEdgeRouting = (reverse = false) => {
    if (!selectedEdge) return;
    startSavingEdge(async () => {
      const result = await updateCanvasEdgeRoutingAction({
        id: selectedEdge.id,
        sourceHandle: edgeSourceHandle,
        targetHandle: edgeTargetHandle,
        routeStyle: edgeRouteStyle,
        reverse,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setEdges((current) => current.map((edge) => edge.id === selectedEdge.id ? {
        ...edge,
        source: reverse ? edge.target : edge.source,
        target: reverse ? edge.source : edge.target,
        sourceHandle: edgeSourceHandle,
        targetHandle: edgeTargetHandle,
        type: "mindraft",
        data: { ...edge.data, sourceHandle: edgeSourceHandle, targetHandle: edgeTargetHandle, routeStyle: edgeRouteStyle },
      } : edge));
      setEdgeSettingsOpen(false);
      toast.success(reverse ? "Direzione invertita" : "Percorso aggiornato");
    });
  };

  const openSettings = (node: MindraftNode) => {
    setSettingsLabel(node.data.label);
    setSettingsBody(node.data.body ?? "");
    setSettingsIcon(node.data.icon ?? "");
    setSettingsColor(node.data.color ?? CANVAS_NODE_STYLES[node.data.nodeType].accent);
    setSettingsOpen(true);
  };

  const saveSettings = () => {
    if (!selectedNode || !settingsLabel.trim()) return;
    startSavingSettings(async () => {
      const result = await updateCanvasNodeAction({
        id: selectedNode.id,
        label: settingsLabel.trim(),
        body: settingsBody.trim() || null,
        icon: settingsIcon.trim() || null,
        color: settingsColor,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setNodes((current) => current.map((node) => node.id === selectedNode.id ? {
        ...node,
        data: {
          ...node.data,
          label: settingsLabel.trim(),
          body: settingsBody.trim() || null,
          icon: settingsIcon.trim() || null,
          color: settingsColor,
        },
      } : node));
      setSettingsOpen(false);
      toast.success("Impostazioni aggiornate");
    });
  };

  return (
    <div
      ref={wrapperRef}
      className={
        presenting
          ? "fixed inset-0 z-50 bg-background"
          : expanded
            ? "fixed inset-0 z-50 overflow-hidden bg-background"
          : "surface-card relative h-[76vh] min-h-[560px] overflow-hidden bg-background"
      }
    >
      {!presenting && canWrite && (
        <div className="absolute left-1/2 top-3 z-20 flex max-w-[calc(100%-1.5rem)] -translate-x-1/2 flex-wrap items-center gap-1.5 rounded-xl border border-border bg-surface/95 p-1.5 shadow-raised backdrop-blur">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="primary" size="sm">
                <Plus /> Nodo
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>Tipo di nodo</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {NODE_CLUSTERS.map((cluster) => (
                <React.Fragment key={cluster.id}>
                  <DropdownMenuLabel>{cluster.icon} {cluster.label}</DropdownMenuLabel>
                  {cluster.nodes.map((kind) => (
                    <DropdownMenuItem key={`${cluster.id}-${kind.label}`} onSelect={() => openNodeDialog(kind)}>
                      <span aria-hidden>{kind.icon}</span>
                      {kind.label}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                </React.Fragment>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="secondary" size="sm" onClick={autoLayout}>
            {edges.some((edge) => (edge.data as { relation?: RelationType })?.relation === "part_of") ? <GitBranch /> : <LayoutGrid />}
            Disponi
          </Button>

          {selectedNode && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="sm">
                  Nodo selezionato
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onSelect={() => openSettings(selectedNode)}>
                  Modifica impostazioni
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Converti in elemento reale</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {(["idea", "task", "decision", "risk"] as const).map((target) => (
                  <DropdownMenuItem
                    key={target}
                    onSelect={() =>
                      void promoteNodeAction(selectedNode.id, target).then((result) => {
                        if (!result.ok) toast.error(result.error);
                        else {
                          toast.success("Nodo collegato a un elemento reale");
                          router.refresh();
                        }
                      })
                    }
                  >
                    {target === "idea"
                      ? "Idea"
                      : target === "task"
                        ? "Attività"
                        : target === "decision"
                          ? "Decisione"
                          : "Rischio"}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  destructive
                  onSelect={() =>
                    void deleteCanvasNodeAction(selectedNode.id).then((result) => {
                      if (!result.ok) toast.error(result.error);
                      else {
                        setNodes((current) => current.filter((node) => node.id !== selectedNode.id));
                        setEdges((current) => current.filter((edge) => edge.source !== selectedNode.id && edge.target !== selectedNode.id));
                      }
                    })
                  }
                >
                  <Trash2 /> Elimina nodo
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {selectedEdge && (
            <div className="flex items-center gap-1.5">
              <select
              value={(selectedEdge.data as { relation?: RelationType })?.relation ?? "relates_to"}
              onChange={(event) => {
                const relation = event.target.value as RelationType;
                void updateCanvasEdgeAction(selectedEdge.id, relation, null).then((result) => {
                  if (!result.ok) toast.error(result.error);
                  else setEdges((current) => current.map((edge) =>
                    edge.id === selectedEdge.id
                      ? { ...edge, label: RELATION_TYPES.find((item) => item.value === relation)?.label, data: { relation } }
                      : edge));
                });
              }}
              aria-label="Tipo di relazione"
              className="h-8 rounded-[var(--radius-sm)] border border-border bg-surface px-2 text-[12px]"
              >
              {RELATION_TYPES.map((relation) => (
                <option key={relation.value} value={relation.value}>
                  {relation.label}
                </option>
              ))}
              </select>
              <Button variant="secondary" size="sm" onClick={() => openEdgeSettings(selectedEdge)}>
                <Route /> Sistema freccia
              </Button>
            </div>
          )}

          <div className="relative ml-auto w-44">
            <Search
              className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cerca nella mappa"
              aria-label="Cerca nella mappa"
              className="h-8 pl-7 text-[12px]"
            />
          </div>

          <Button variant="ghost" size="icon-sm" onClick={exportPng} aria-label="Esporta PNG">
            <Download />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setExpanded((value) => !value)}
            aria-label={expanded ? "Esci dallo schermo intero" : "Canvas a schermo intero"}
            title={expanded ? "Riduci canvas" : "Canvas a schermo intero"}
          >
            {expanded ? <Minimize2 /> : <Maximize2 />}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setPresenting(true)}
            aria-label="Modalità presentazione"
          >
            <Presentation />
          </Button>
        </div>
      )}

      {presenting && (
        <Button
          variant="secondary"
          size="sm"
          className="absolute right-4 top-4 z-10"
          onClick={() => setPresenting(false)}
        >
          Esci dalla presentazione
        </Button>
      )}

      {expanded && !presenting && canWrite && (
        <aside className="absolute bottom-3 left-3 top-16 z-30 flex w-64 flex-col overflow-hidden rounded-xl border border-border bg-surface/95 shadow-overlay backdrop-blur">
          <div className="border-b border-border p-3">
            <p className="font-display text-sm font-semibold">Libreria nodi</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">Clicca o trascina sulla lavagna</p>
            <div className="relative mt-2">
              <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input value={paletteSearch} onChange={(event) => setPaletteSearch(event.target.value)} placeholder="Cerca un nodo" className="h-8 pl-7 text-xs" />
            </div>
          </div>
          <div className="flex-1 space-y-1 overflow-y-auto p-2">
            {NODE_CLUSTERS.map((cluster, index) => {
              const term = paletteSearch.trim().toLowerCase();
              const available = cluster.nodes.filter((kind) => !term || `${kind.label} ${cluster.label}`.toLowerCase().includes(term));
              if (available.length === 0) return null;
              return (
                <details key={cluster.id} open={Boolean(term) || index === 0} className="group rounded-lg border border-transparent open:border-border open:bg-surface-muted/40">
                  <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg px-2.5 py-2 text-[12px] font-semibold hover:bg-surface-muted">
                    <span aria-hidden>{cluster.icon}</span>
                    <span className="flex-1">{cluster.label}</span>
                    <span className="text-[10px] text-subtle-foreground">{available.length}</span>
                  </summary>
                  <div className="grid grid-cols-2 gap-1 p-1.5 pt-0">
                    {available.map((kind) => (
                      <button
                        key={`${cluster.id}-${kind.label}`}
                        type="button"
                        draggable
                        onDragStart={(event) => {
                          event.dataTransfer.effectAllowed = "copy";
                          event.dataTransfer.setData("application/x-mindraft-node", JSON.stringify(kind));
                        }}
                        onClick={() => openNodeDialog(kind)}
                        className="flex min-h-16 flex-col items-start justify-between rounded-lg border border-border bg-surface p-2 text-left transition hover:-translate-y-0.5 hover:border-primary hover:shadow-soft"
                      >
                        <span className="text-lg" aria-hidden>{kind.icon}</span>
                        <span className="mt-1 text-[11px] font-medium leading-tight">{kind.label}</span>
                      </button>
                    ))}
                  </div>
                </details>
              );
            })}
          </div>
        </aside>
      )}

      <Dialog open={nodeDialogOpen} onOpenChange={setNodeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuovo nodo · {nodeKind.label}</DialogTitle>
            <DialogDescription>
              Personalizza il blocco prima di inserirlo nel canvas.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="canvas-node-title">Titolo</Label>
              <Input
                id="canvas-node-title"
                value={nodeLabel}
                onChange={(event) => setNodeLabel(event.target.value)}
                placeholder={nodeKind.label}
                autoFocus
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) addNode();
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="canvas-node-body">Descrizione</Label>
              <Textarea
                id="canvas-node-body"
                value={nodeBody}
                onChange={(event) => setNodeBody(event.target.value)}
                rows={3}
                placeholder="Dettagli facoltativi"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="canvas-node-icon">Emoji o sticker</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="canvas-node-icon"
                  value={nodeIcon}
                  onChange={(event) => setNodeIcon(event.target.value.slice(0, 32))}
                  placeholder="Incolla un’emoji"
                  className="w-36 text-xl"
                />
                <span className="text-[12px] text-muted-foreground">Puoi anche incollare qualsiasi emoji.</span>
              </div>
              <div className="grid grid-cols-8 gap-1.5" aria-label="Sticker disponibili">
                {ICON_PRESETS.map((icon) => (
                  <button
                    key={icon}
                    type="button"
                    onClick={() => setNodeIcon(icon)}
                    className="flex size-9 items-center justify-center rounded-md border border-border bg-surface text-xl hover:bg-surface-muted"
                    aria-label={`Usa ${icon}`}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNodeDialogOpen(false)} disabled={creatingNode}>Annulla</Button>
            <Button variant="primary" onClick={addNode} loading={creatingNode}>Inserisci nodo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Impostazioni del nodo</DialogTitle>
            <DialogDescription>Modifica contenuto, simbolo e colore del blocco selezionato.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="node-settings-label">Titolo</Label>
              <Input id="node-settings-label" value={settingsLabel} onChange={(event) => setSettingsLabel(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="node-settings-body">Descrizione</Label>
              <Textarea id="node-settings-body" rows={3} value={settingsBody} onChange={(event) => setSettingsBody(event.target.value)} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="node-settings-icon">Emoji o sticker</Label>
                <Input id="node-settings-icon" className="text-xl" value={settingsIcon} onChange={(event) => setSettingsIcon(event.target.value.slice(0, 32))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="node-settings-color">Colore</Label>
                <div className="flex gap-2">
                  <input id="node-settings-color" type="color" value={settingsColor} onChange={(event) => setSettingsColor(event.target.value)} className="h-10 w-14 cursor-pointer rounded-md border border-border bg-surface p-1" />
                  <Input value={settingsColor} onChange={(event) => setSettingsColor(event.target.value)} maxLength={7} aria-label="Codice colore" />
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {ICON_PRESETS.map((icon) => (
                <button key={icon} type="button" onClick={() => setSettingsIcon(icon)} className="flex size-9 items-center justify-center rounded-md border border-border bg-surface text-xl hover:bg-surface-muted">{icon}</button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSettingsOpen(false)} disabled={savingSettings}>Annulla</Button>
            <Button variant="primary" onClick={saveSettings} loading={savingSettings}>Salva modifiche</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={edgeSettingsOpen} onOpenChange={setEdgeSettingsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sistema freccia</DialogTitle>
            <DialogDescription>Scegli da quali lati deve partire e arrivare la linea.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="edge-source-side">Partenza</Label>
              <select id="edge-source-side" value={edgeSourceHandle} onChange={(event) => setEdgeSourceHandle(event.target.value as typeof edgeSourceHandle)} className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm">
                <option value="top">Alto</option><option value="right">Destra</option><option value="bottom">Basso</option><option value="left">Sinistra</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edge-target-side">Arrivo</Label>
              <select id="edge-target-side" value={edgeTargetHandle} onChange={(event) => setEdgeTargetHandle(event.target.value as typeof edgeTargetHandle)} className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm">
                <option value="top">Alto</option><option value="right">Destra</option><option value="bottom">Basso</option><option value="left">Sinistra</option>
              </select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="edge-route-style">Stile del percorso</Label>
              <select id="edge-route-style" value={edgeRouteStyle} onChange={(event) => setEdgeRouteStyle(event.target.value as typeof edgeRouteStyle)} className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm">
                <option value="smoothstep">Ortogonale arrotondato</option>
                <option value="bezier">Curva morbida</option>
                <option value="straight">Linea retta</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => saveEdgeRouting(true)} disabled={savingEdge}>
              <ArrowLeftRight /> Inverti direzione
            </Button>
            <Button variant="ghost" onClick={() => setEdgeSettingsOpen(false)} disabled={savingEdge}>Annulla</Button>
            <Button variant="primary" onClick={() => saveEdgeRouting(false)} loading={savingEdge}>Salva percorso</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ReactFlow<MindraftNode, Edge>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onNodeDragStart={(_, node) => {
          const moving = node.selected ? flow.getNodes().filter((item) => item.selected) : [node];
          for (const item of moving) draggingNodeIds.current.add(item.id);
        }}
        onNodeDragStop={() => {
          scheduleLayoutSave();
          const moved = [...draggingNodeIds.current];
          window.setTimeout(() => {
            for (const id of moved) draggingNodeIds.current.delete(id);
          }, 1000);
        }}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDragOver={(event) => {
          if (!canWrite || !event.dataTransfer.types.includes("application/x-mindraft-node")) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }}
        onDrop={(event) => {
          if (!canWrite) return;
          const raw = event.dataTransfer.getData("application/x-mindraft-node");
          if (!raw) return;
          event.preventDefault();
          try {
            const kind = JSON.parse(raw) as AddableNode;
            openNodeDialog(kind, flow.screenToFlowPosition({ x: event.clientX, y: event.clientY }));
          } catch {
            toast.error("Nodo non riconosciuto.");
          }
        }}
        onDoubleClick={(event: React.MouseEvent<HTMLDivElement>) => {
          if (!canWrite || !(event.target as HTMLElement).classList.contains("react-flow__pane")) return;
          openNodeDialog(
            { type: "note", label: "Nota", icon: "📝" },
            flow.screenToFlowPosition({ x: event.clientX, y: event.clientY }),
          );
        }}
        onMoveEnd={() => scheduleLayoutSave()}
        nodesDraggable={canWrite}
        nodeDragThreshold={3}
        selectNodesOnDrag
        nodesConnectable={canWrite}
        connectionMode={ConnectionMode.Loose}
        elementsSelectable
        fitView
        fitViewOptions={{ padding: 0.22, maxZoom: 1.15 }}
        minZoom={0.12}
        maxZoom={2.5}
        panOnDrag
        panOnScroll
        selectionOnDrag={false}
        zoomOnDoubleClick={false}
        snapToGrid={false}
        proOptions={{ hideAttribution: true }}
        deleteKeyCode={canWrite ? ["Backspace", "Delete"] : []}
        onNodesDelete={(deleted) => {
          for (const node of deleted) void deleteCanvasNodeAction(node.id);
        }}
        className="h-full w-full"
        defaultEdgeOptions={{
          type: "smoothstep",
          markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
          style: { stroke: "var(--border-strong)", strokeWidth: 1.5 },
        }}
        aria-label="Mappa del progetto"
      >
        <Background variant={undefined} gap={24} size={1.2} color="var(--border-strong)" />
        <Controls showInteractive={false} position="bottom-left" />
        <MiniMap
          pannable
          zoomable
          nodeColor={(node) =>
            CANVAS_NODE_STYLES[(node as MindraftNode).data.nodeType]?.accent ?? "#8D92AD"
          }
          className="!bg-[var(--surface)] !border !border-[var(--border)]"
        />
      </ReactFlow>
    </div>
  );
}

export function CanvasBoard(props: {
  canvasId: string;
  initialNodes: CanvasNodeRow[];
  initialEdges: CanvasEdgeRow[];
  canWrite: boolean;
}) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}
