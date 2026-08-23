"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { switchWorkspaceAction } from "@/server/actions/auth";
import { cn } from "@/lib/utils";

export function WorkspaceSwitcher({
  workspaces,
  activeId,
  collapsed = false,
}: {
  workspaces: Array<{ id: string; name: string; is_personal: boolean }>;
  activeId: string;
  collapsed?: boolean;
}) {
  const [pending, startTransition] = React.useTransition();
  const active = workspaces.find((w) => w.id === activeId);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex w-full items-center gap-2 rounded-[var(--radius-md)] px-2 py-2 text-left text-[13px] transition-colors hover:bg-surface-muted",
          pending && "opacity-60",
        )}
        aria-label="Cambia spazio di lavoro"
      >
        <span className="flex size-6 shrink-0 items-center justify-center rounded-[7px] bg-accent-500/15 text-[11px] font-semibold text-accent-700 dark:text-accent-300">
          {(active?.name ?? "M").slice(0, 1).toUpperCase()}
        </span>
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1 truncate font-medium">{active?.name ?? "Spazio"}</span>
            <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Spazi di lavoro</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {workspaces.map((workspace) => (
          <DropdownMenuItem
            key={workspace.id}
            onSelect={() => {
              if (workspace.id === activeId) return;
              startTransition(() => switchWorkspaceAction(workspace.id));
            }}
          >
            <span className="flex-1 truncate">{workspace.name}</span>
            {workspace.id === activeId && <Check className="size-3.5" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
