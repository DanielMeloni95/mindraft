"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  CheckCircle2,
  ExternalLink,
  Lightbulb,
  ListChecks,
  MoreHorizontal,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { RelativeTime } from "@/components/common/relative-time";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createIdeaAction } from "@/server/actions/ideas";
import {
  archiveInboxItemAction,
  setInboxStatusAction,
  updateInboxItemAction,
} from "@/server/actions/inbox";
import { organizeCaptureAction } from "@/server/actions/ai";
import type { InboxItemWithProject } from "@/server/queries/inbox";

import { OrganizeDialog } from "./organize-dialog";

export function InboxList({
  items,
  projects,
}: {
  items: InboxItemWithProject[];
  projects: Array<{ id: string; name: string; emoji: string | null }>;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [organizing, setOrganizing] = React.useState<{
    item: InboxItemWithProject;
    result: Awaited<ReturnType<typeof organizeCaptureAction>>;
  } | null>(null);

  const withBusy = async (id: string, fn: () => Promise<void>) => {
    setBusyId(id);
    try {
      await fn();
    } finally {
      setBusyId(null);
    }
  };

  const convert = (item: InboxItemWithProject) =>
    withBusy(item.id, async () => {
      const result = await createIdeaAction({
        originalContent: item.content || item.url_title || item.url || "",
        sourceInboxItemId: item.id,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Diventata un'idea");
      router.push(`/ideas/${result.data.id}`);
    });

  const archive = (item: InboxItemWithProject) =>
    withBusy(item.id, async () => {
      const result = await archiveInboxItemAction(item.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.refresh();
      toast.success("Eliminato", {
        action: {
          label: "Annulla",
          onClick: () => {
            void archiveInboxItemAction(item.id, true).then(() => router.refresh());
          },
        },
      });
    });

  return (
    <>
      <ul className="space-y-2.5">
        {items.map((item) => {
          const busy = busyId === item.id;
          return (
            <li
              key={item.id}
              className={`surface-card p-3.5 transition-opacity ${busy ? "opacity-60" : ""}`}
            >
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  {item.url && (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="mb-1 inline-flex items-center gap-1 text-[12px] font-medium text-primary hover:underline"
                    >
                      {item.url_title ?? item.url}
                      <ExternalLink className="size-3" aria-hidden />
                    </a>
                  )}
                  <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-foreground">
                    {item.content}
                  </p>
                  <p className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-subtle-foreground">
                    <RelativeTime value={item.created_at} />
                    {item.project && (
                      <span className="rounded-full bg-surface-muted px-2 py-0.5">
                        {item.project.emoji ?? "🧩"} {item.project.name}
                      </span>
                    )}
                    {item.status === "processed" && (
                      <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="size-3" aria-hidden /> elaborato
                      </span>
                    )}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={busy}
                    onClick={() => convert(item)}
                  >
                    <Lightbulb /> Idea
                  </Button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label="Altre azioni">
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onSelect={() =>
                          void withBusy(item.id, async () => {
                            const result = await organizeCaptureAction(item.id);
                            if (!result.ok) {
                              toast.error(result.error);
                              return;
                            }
                            setOrganizing({ item, result });
                          })
                        }
                      >
                        <Sparkles /> Organizza con l&apos;assistente
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() =>
                          void withBusy(item.id, async () => {
                            const result = await setInboxStatusAction(
                              item.id,
                              item.status === "processed" ? "unprocessed" : "processed",
                            );
                            if (!result.ok) toast.error(result.error);
                            else router.refresh();
                          })
                        }
                      >
                        <ListChecks />
                        {item.status === "processed"
                          ? "Segna da elaborare"
                          : "Segna elaborato"}
                      </DropdownMenuItem>
                      {projects.length > 0 && (
                        <>
                          <DropdownMenuSeparator />
                          {projects.slice(0, 6).map((project) => (
                            <DropdownMenuItem
                              key={project.id}
                              onSelect={() =>
                                void withBusy(item.id, async () => {
                                  const result = await updateInboxItemAction({
                                    id: item.id,
                                    projectId: project.id,
                                  });
                                  if (!result.ok) toast.error(result.error);
                                  else {
                                    router.refresh();
                                    toast.success(`Collegato a ${project.name}`);
                                  }
                                })
                              }
                            >
                              <span className="text-base leading-none">
                                {project.emoji ?? "🧩"}
                              </span>
                              {project.name}
                            </DropdownMenuItem>
                          ))}
                        </>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onSelect={() =>
                          void withBusy(item.id, async () => {
                            const result = await setInboxStatusAction(item.id, "archived");
                            if (!result.ok) toast.error(result.error);
                            else router.refresh();
                          })
                        }
                      >
                        <Archive /> Archivia
                      </DropdownMenuItem>
                      <DropdownMenuItem destructive onSelect={() => void archive(item)}>
                        <Trash2 /> Elimina
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {organizing?.result.ok && (
        <OrganizeDialog
          open
          onOpenChange={() => setOrganizing(null)}
          item={organizing.item}
          result={organizing.result.data}
        />
      )}
    </>
  );
}
