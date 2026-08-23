"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MoreHorizontal } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MOBILE_NAV, SECONDARY_NAV, PRIMARY_NAV } from "./nav-items";
import type { SidebarCounts } from "./sidebar";

/** Mobile is for capture, reading and small updates — not for everything. */
export function MobileNav({ counts }: { counts: SidebarCounts }) {
  const pathname = usePathname();

  const more = [
    ...PRIMARY_NAV.filter((item) => !MOBILE_NAV.some((m) => m.href === item.href)),
    ...SECONDARY_NAV,
  ];

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur md:hidden"
      aria-label="Navigazione"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="grid grid-cols-5">
        {MOBILE_NAV.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const count = item.badge ? counts[item.badge] : 0;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-[10px] font-medium",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="size-5" aria-hidden />
                {item.label}
                {count > 0 && (
                  <span className="absolute right-1/4 top-2 size-1.5 rounded-full bg-primary" aria-hidden />
                )}
              </Link>
            </li>
          );
        })}
        <li>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex min-h-14 w-full flex-col items-center justify-center gap-0.5 text-[10px] font-medium text-muted-foreground"
                aria-label="Altre sezioni"
              >
                <MoreHorizontal className="size-5" aria-hidden />
                Altro
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top" className="mb-2">
              <DropdownMenuLabel>Altro</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {more.map((item) => {
                const Icon = item.icon;
                return (
                  <DropdownMenuItem key={item.href} asChild>
                    <Link href={item.href}>
                      <Icon /> {item.label}
                    </Link>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </li>
      </ul>
    </nav>
  );
}
