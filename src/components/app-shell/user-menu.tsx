"use client";

import Link from "next/link";
import { HelpCircle, LogOut, Settings, User } from "lucide-react";

import { Avatar } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOutAction } from "@/server/actions/auth";
import { cn } from "@/lib/utils";

export function UserMenu({
  name,
  email,
  collapsed = false,
}: {
  name: string | null;
  email: string | null;
  collapsed?: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex w-full items-center gap-2 rounded-[var(--radius-md)] px-2 py-2 text-left transition-colors hover:bg-surface-muted",
        )}
        aria-label="Menu profilo"
      >
        <Avatar name={name ?? email} size="sm" />
        {!collapsed && (
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-medium">{name ?? "Profilo"}</span>
            {email && (
              <span className="block truncate text-[11px] text-muted-foreground">{email}</span>
            )}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>{name ?? email ?? "Profilo"}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <User /> Profilo
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings/billing">
            <Settings /> Piano e utilizzo
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings/feedback">
            <HelpCircle /> Aiuto e feedback
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <form action={signOutAction}>
          <button
            type="submit"
            className="flex w-full cursor-pointer items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1.5 text-sm text-foreground hover:bg-surface-muted"
          >
            <LogOut className="size-4 text-muted-foreground" /> Esci
          </button>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
