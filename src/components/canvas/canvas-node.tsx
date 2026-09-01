"use client";

import * as React from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { ExternalLink } from "lucide-react";

import { CANVAS_NODE_STYLES } from "@/lib/domain/constants";
import { cn } from "@/lib/utils";
import type { CanvasNodeType, EntityType } from "@/types/database";

export type MindraftNodeData = {
  label: string;
  body: string | null;
  nodeType: CanvasNodeType;
  entityType: EntityType | null;
  entityId: string | null;
  dimmed: boolean;
  icon: string | null;
  variant: "default" | "subproject" | "tool";
  color: string | null;
  onRename: (id: string, label: string) => void;
  origin?: string | null;
};

export type MindraftNode = Node<MindraftNodeData, "mindraft">;

const HREF: Partial<Record<EntityType, (id: string) => string>> = {
  idea: (id) => `/ideas/${id}`,
  project: (id) => `/projects/${id}`,
};

/**
 * A node is a view of something real whenever entityType is set: the
 * label edits through to the entity, and the link opens it.
 */
export function CanvasNodeCard({ id, data, selected }: NodeProps<MindraftNode>) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(data.label);
  const style = CANVAS_NODE_STYLES[data.nodeType];

  React.useEffect(() => setDraft(data.label), [data.label]);

  const commit = () => {
    setEditing(false);
    const next = draft.trim();
    if (next && next !== data.label) data.onRename(id, next);
    else setDraft(data.label);
  };

  const href = data.entityType && data.entityId ? HREF[data.entityType]?.(data.entityId) : null;

  return (
    <div
      className={cn(
        "group min-w-48 max-w-72 rounded-xl border bg-surface p-3 shadow-soft transition-[opacity,box-shadow,transform] hover:-translate-y-0.5 hover:shadow-raised",
        selected ? "ring-2 ring-primary ring-offset-2 ring-offset-background shadow-raised" : "",
        data.dimmed ? "opacity-25" : "opacity-100",
      )}
      style={{
        borderColor: data.color ?? style.accent,
        backgroundColor: data.color ? `${data.color}1A` : style.surface,
      }}
      onDoubleClick={() => setEditing(true)}
    >
      <Handle id="top" type="source" position={Position.Top} className={cn("!size-3 !border-2 !border-surface !bg-primary transition-opacity", selected ? "opacity-100" : "opacity-0 group-hover:opacity-100")} />
      <Handle id="right" type="source" position={Position.Right} className={cn("!size-3 !border-2 !border-surface !bg-primary transition-opacity", selected ? "opacity-100" : "opacity-0 group-hover:opacity-100")} />
      <Handle id="left" type="source" position={Position.Left} className={cn("!size-3 !border-2 !border-surface !bg-primary transition-opacity", selected ? "opacity-100" : "opacity-0 group-hover:opacity-100")} />

      <div className="flex items-center gap-1.5">
        {data.icon && <span className="text-xl leading-none" aria-hidden>{data.icon}</span>}
        <span
          className="inline-block size-2 shrink-0 rounded-full"
          style={{ backgroundColor: data.color ?? style.accent }}
          aria-hidden
        />
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {data.variant === "subproject" ? "Sottoprogetto" : data.variant === "tool" ? "Strumento" : style.label}
        </span>
        {href && (
          <a
            href={href}
            className="nodrag ml-auto text-muted-foreground hover:text-foreground"
            aria-label={`Apri ${data.label}`}
            onClick={(event) => event.stopPropagation()}
          >
            <ExternalLink className="size-3" />
          </a>
        )}
      </div>

      {editing ? (
        <input
          value={draft}
          autoFocus
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") commit();
            if (event.key === "Escape") {
              setDraft(data.label);
              setEditing(false);
            }
          }}
          aria-label="Etichetta del nodo"
          className="nodrag mt-1 w-full rounded-[var(--radius-sm)] border border-border bg-surface px-1.5 py-1 text-[13px]"
        />
      ) : (
        <p className="mt-1 break-words text-[13px] font-medium leading-snug text-foreground">
          {data.label || "Senza titolo"}
        </p>
      )}

      {data.body && (
        <p className="mt-1 line-clamp-3 break-words text-[11px] leading-relaxed text-muted-foreground">
          {data.body}
        </p>
      )}

      <Handle id="bottom" type="source" position={Position.Bottom} className={cn("!size-3 !border-2 !border-surface !bg-primary transition-opacity", selected ? "opacity-100" : "opacity-0 group-hover:opacity-100")} />
    </div>
  );
}
