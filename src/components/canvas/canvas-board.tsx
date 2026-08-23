"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Background,
  Controls,
  MiniMap,
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
import { Download, LayoutGrid, Plus, Presentation, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import "@xyflow/react/dist/style.css";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CANVAS_NODE_STYLES, RELATION_TYPES } from "@/lib/domain/constants";
import {
  createCanvasEdgeAction,
  createCanvasNodeAction,
  deleteCanvasEdgeAction,
  deleteCanvasNodeAction,
  promoteNodeAction,
  saveCanvasLayoutAction,
  updateCanvasEdgeAction,
  updateCanvasNodeAction,
} from "@/server/actions/canvas";
import type {
  CanvasEdgeRow,
  CanvasNodeRow,
  CanvasNodeType,
  RelationType,
} from "@/types/database";

import { CanvasNodeCard, type MindraftNode } from "./canvas-node";

const nodeTypes = { mindraft: CanvasNodeCard };

const ADDABLE: CanvasNodeType[] = [
  "note",
  "idea",
  "goal",
  "feature",
  "task",
  "decision",
  "risk",
  "resource",
  "text",
];

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

function toFlowEdges(rows: CanvasEdgeRow[]): Edge[] {
  return rows.map((row) => ({
    id: row.id,
    source: row.source_node_id,
    target: row.target_node_id,
    label: row.label || RELATION_TYPES.find((r) => r.value === row.relation)?.label,
    data: { relation: row.relation },
    animated: row.relation === "blocks",
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
  const [presenting, setPresenting] = React.useState(false);
  const saveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

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
      if (changes.some((change) => change.type === "position")) scheduleLayoutSave();
    },
    [onNodesChangeInternal, scheduleLayoutSave],
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
              data: { relation: "relates_to" },
            },
            current,
          ),
        );
      });
    },
    [canWrite, canvasId, setEdges],
  );

  const addNode = (type: CanvasNodeType) => {
    const centre = flow.screenToFlowPosition({
      x: (wrapperRef.current?.clientWidth ?? 800) / 2,
      y: (wrapperRef.current?.clientHeight ?? 500) / 2,
    });
    void createCanvasNodeAction({
      canvasId,
      type,
      label: CANVAS_NODE_STYLES[type].label,
      positionX: Math.round(centre.x + (Math.random() - 0.5) * 120),
      positionY: Math.round(centre.y + (Math.random() - 0.5) * 120),
    }).then((result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  };

  /** Simple radial auto-layout: readable, deterministic, undoable by dragging. */
  const autoLayout = () => {
    const current = flow.getNodes();
    if (current.length === 0) return;
    const radius = Math.max(220, current.length * 42);
    const next = current.map((node, index) => {
      if (index === 0) return { ...node, position: { x: 0, y: 0 } };
      const angle = ((index - 1) / (current.length - 1)) * Math.PI * 2;
      return {
        ...node,
        position: {
          x: Math.round(Math.cos(angle) * radius),
          y: Math.round(Math.sin(angle) * radius),
        },
      };
    });
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

  return (
    <div
      ref={wrapperRef}
      className={
        presenting
          ? "fixed inset-0 z-50 bg-background"
          : "surface-card h-[70vh] min-h-[420px] overflow-hidden"
      }
    >
      {!presenting && canWrite && (
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="primary" size="sm">
                <Plus /> Nodo
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>Tipo di nodo</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {ADDABLE.map((type) => (
                <DropdownMenuItem key={type} onSelect={() => addNode(type)}>
                  <span
                    className="inline-block size-2 rounded-full"
                    style={{ backgroundColor: CANVAS_NODE_STYLES[type].accent }}
                    aria-hidden
                  />
                  {CANVAS_NODE_STYLES[type].label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="secondary" size="sm" onClick={autoLayout}>
            <LayoutGrid /> Riordina
          </Button>

          {selectedNode && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="sm">
                  Nodo selezionato
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
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
                      else router.refresh();
                    })
                  }
                >
                  <Trash2 /> Elimina nodo
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {selectedEdge && (
            <select
              value={(selectedEdge.data as { relation?: RelationType })?.relation ?? "relates_to"}
              onChange={(event) => {
                const relation = event.target.value as RelationType;
                void updateCanvasEdgeAction(selectedEdge.id, relation, null).then((result) => {
                  if (!result.ok) toast.error(result.error);
                  else router.refresh();
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

      <ReactFlow<MindraftNode, Edge>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodesDraggable={canWrite}
        nodesConnectable={canWrite}
        elementsSelectable
        fitView
        snapToGrid
        snapGrid={[16, 16]}
        proOptions={{ hideAttribution: true }}
        deleteKeyCode={canWrite ? ["Backspace", "Delete"] : []}
        onNodesDelete={(deleted) => {
          for (const node of deleted) void deleteCanvasNodeAction(node.id);
        }}
        className="h-full w-full"
        aria-label="Mappa del progetto"
      >
        <Background gap={20} size={1} color="var(--border)" />
        <Controls showInteractive={false} />
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
