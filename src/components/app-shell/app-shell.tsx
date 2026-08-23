import Link from "next/link";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Logo } from "@/components/common/logo";
import { PLANS } from "@/lib/domain/plans";
import type { SessionContext } from "@/server/session";

import { CommandPalette } from "./command-palette";
import { MobileNav } from "./mobile-nav";
import { QuickCapture } from "./quick-capture";
import { Sidebar } from "./sidebar";
import { ThemeToggle } from "./theme-toggle";
import { UsageIndicator } from "./usage-indicator";
import { UserMenu } from "./user-menu";
import { WorkspaceSwitcher } from "./workspace-switcher";

export function AppShell({
  session,
  counts,
  projects,
  children,
}: {
  session: SessionContext;
  counts: { inbox: number; tasks: number };
  projects: Array<{ id: string; name: string; emoji: string | null }>;
  children: React.ReactNode;
}) {
  const planName = PLANS[session.plan].name;

  return (
    <div className="flex min-h-dvh bg-background">
      <Sidebar
        counts={counts}
        footer={
          <div className="space-y-1">
            <WorkspaceSwitcher
              workspaces={session.workspaces}
              activeId={session.workspace.id}
            />
            <UsageIndicator
              used={session.aiCreditsUsed}
              limit={session.aiCreditsLimit}
              planName={planName}
            />
            <UserMenu
              name={session.profile?.full_name ?? null}
              email={session.email}
            />
          </div>
        }
        footerCollapsed={
          <div className="space-y-2 py-1">
            <UsageIndicator
              used={session.aiCreditsUsed}
              limit={session.aiCreditsLimit}
              planName={planName}
              collapsed
            />
            <UserMenu
              name={session.profile?.full_name ?? null}
              email={session.email}
              collapsed
            />
          </div>
        }
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-background/85 px-4 backdrop-blur">
          <Link href="/home" className="flex items-center gap-2 md:hidden" aria-label="Mindraft">
            <Logo />
            <span className="font-display text-[15px] font-semibold">Mindraft</span>
          </Link>

          <Button
            variant="secondary"
            size="sm"
            asChild
            className="ml-auto hidden w-64 justify-start text-muted-foreground md:inline-flex"
          >
            <Link href="/search">
              <Search />
              <span className="flex-1 text-left">Cerca…</span>
              <kbd className="rounded border border-border bg-surface-muted px-1 text-[10px] font-medium">
                ⌘K
              </kbd>
            </Link>
          </Button>

          <div className="ml-auto flex items-center gap-1 md:ml-2">
            <Button variant="ghost" size="icon-sm" asChild className="md:hidden">
              <Link href="/search" aria-label="Cerca">
                <Search />
              </Link>
            </Button>
            <ThemeToggle compact />
            <div className="hidden md:block">
              <QuickCapture projects={projects} variant="dialog" />
            </div>
          </div>
        </header>

        <main
          id="contenuto"
          className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-5 md:px-6 md:pb-10"
        >
          {children}
        </main>
      </div>

      <div className="fixed bottom-20 right-4 z-40 md:hidden">
        <QuickCapture projects={projects} variant="fab" />
      </div>

      <MobileNav counts={counts} />
      <CommandPalette />
    </div>
  );
}
