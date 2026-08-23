"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, PanelLeft } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/ui/tooltip";
import { Logo } from "@/components/common/logo";
import { PRIMARY_NAV, SECONDARY_NAV, type NavItem } from "./nav-items";

const STORAGE_KEY = "mindraft.sidebar.collapsed";

export type SidebarCounts = { inbox: number; tasks: number };

export function Sidebar({
  counts,
  footer,
  footerCollapsed,
}: {
  counts: SidebarCounts;
  footer: React.ReactNode;
  footerCollapsed: React.ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = React.useState(false);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      /* storage can be unavailable; the default is fine */
    }
    setReady(true);
  }, []);

  const toggle = React.useCallback(() => {
    setCollapsed((value) => {
      const next = !value;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  return (
    <aside
      data-collapsed={collapsed}
      className={cn(
        "hidden shrink-0 flex-col border-r border-border bg-surface md:flex",
        collapsed ? "w-16" : "w-60",
        ready ? "transition-[width] duration-200" : "",
      )}
      aria-label="Navigazione principale"
    >
      <div className="flex h-14 items-center gap-2 px-3">
        <Link
          href="/home"
          className="flex min-w-0 items-center gap-2 rounded-md px-1 py-1"
          aria-label="Mindraft, vai alla home"
        >
          <Logo />
          {!collapsed && (
            <span className="truncate font-display text-[15px] font-semibold tracking-tight">
              Mindraft
            </span>
          )}
        </Link>
        <Button
          variant="ghost"
          size="icon-sm"
          className="ml-auto"
          onClick={toggle}
          aria-label={collapsed ? "Espandi la barra laterale" : "Comprimi la barra laterale"}
          aria-expanded={!collapsed}
        >
          {collapsed ? <PanelLeft /> : <ChevronLeft />}
        </Button>
      </div>

      <nav className="flex-1 overflow-y-auto scrollbar-thin px-2 pb-4">
        <ul className="space-y-0.5">
          {PRIMARY_NAV.map((item) => (
            <SidebarLink
              key={item.href}
              item={item}
              collapsed={collapsed}
              active={isActive(pathname, item.href)}
              count={item.badge ? counts[item.badge] : 0}
            />
          ))}
        </ul>

        <div className="my-3 h-px bg-border" />

        <ul className="space-y-0.5">
          {SECONDARY_NAV.map((item) => (
            <SidebarLink
              key={item.href}
              item={item}
              collapsed={collapsed}
              active={isActive(pathname, item.href)}
              count={0}
            />
          ))}
        </ul>
      </nav>

      <div className={cn("border-t border-border p-2", collapsed && "px-1")}>
        {collapsed ? footerCollapsed : footer}
      </div>
    </aside>
  );
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/home") return pathname === "/home";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function SidebarLink({
  item,
  collapsed,
  active,
  count,
}: {
  item: NavItem;
  collapsed: boolean;
  active: boolean;
  count: number;
}) {
  const Icon = item.icon;

  const link = (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex items-center gap-2.5 rounded-[var(--radius-md)] px-2.5 py-2 text-[13px] font-medium transition-colors",
        active
          ? "bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-100"
          : "text-muted-foreground hover:bg-surface-muted hover:text-foreground",
        collapsed && "justify-center px-0",
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      {!collapsed && <span className="truncate">{item.label}</span>}
      {!collapsed && count > 0 && (
        <span className="ml-auto rounded-full bg-brand-100 px-1.5 text-[11px] font-semibold text-brand-700 dark:bg-brand-800 dark:text-brand-100">
          {count > 99 ? "99+" : count}
        </span>
      )}
      {collapsed && count > 0 && (
        <span className="absolute ml-6 -mt-4 size-2 rounded-full bg-primary" aria-hidden />
      )}
    </Link>
  );

  return (
    <li className="relative">
      {collapsed ? (
        <Hint label={count > 0 ? `${item.label} (${count})` : item.label}>{link}</Hint>
      ) : (
        link
      )}
    </li>
  );
}
