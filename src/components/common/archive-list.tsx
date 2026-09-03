"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { RelativeTime } from "@/components/common/relative-time";
import { Button } from "@/components/ui/button";
import { archiveIdeaAction } from "@/server/actions/ideas";
import { archiveInboxItemAction } from "@/server/actions/inbox";
import { archiveProjectAction } from "@/server/actions/projects";
import { archiveCanvasAction } from "@/server/actions/canvas";

export type ArchiveItem = {
  id: string;
  kind: "idea" | "project" | "inbox" | "canvas";
  label: string;
  updatedAt: string;
};

const KIND_LABEL: Record<ArchiveItem["kind"], string> = {
  idea: "Idea",
  project: "Progetto",
  inbox: "Inbox",
  canvas: "Canvas",
};

export function ArchiveList({ items }: { items: ArchiveItem[] }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  const restore = (item: ArchiveItem) =>
    startTransition(async () => {
      const result =
        item.kind === "idea"
          ? await archiveIdeaAction(item.id, true)
          : item.kind === "project"
            ? await archiveProjectAction(item.id, true)
            : item.kind === "canvas"
              ? await archiveCanvasAction(item.id, true)
              : await archiveInboxItemAction(item.id, true);

      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Ripristinato");
      router.refresh();
    });

  return (
    <ul className="surface-card divide-y divide-border">
      {items.map((item) => (
        <li key={`${item.kind}-${item.id}`} className="flex items-center gap-3 p-3.5">
          <span className="shrink-0 rounded-full bg-surface-muted px-2 py-0.5 text-[11px] text-muted-foreground">
            {KIND_LABEL[item.kind]}
          </span>
          <span className="min-w-0 flex-1 truncate text-[13px]">{item.label}</span>
          <RelativeTime
            value={item.updatedAt}
            className="hidden shrink-0 text-[11px] text-subtle-foreground sm:block"
          />
          <Button variant="secondary" size="sm" disabled={pending} onClick={() => restore(item)}>
            <RotateCcw /> Ripristina
          </Button>
        </li>
      ))}
    </ul>
  );
}
