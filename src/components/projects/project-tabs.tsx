"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const TABS = [
  { segment: "", label: "Overview" },
  { segment: "document", label: "Documento" },
  { segment: "agentic-document", label: "Documento agentico" },
  { segment: "canvas", label: "Canvas" },
  { segment: "subprojects", label: "Sottoprogetti" },
  { segment: "roadmap", label: "Roadmap" },
  { segment: "tasks", label: "Attività" },
  { segment: "decisions", label: "Decisioni" },
  { segment: "resources", label: "Risorse" },
  { segment: "collaboration", label: "Collaborazione" },
  { segment: "history", label: "Cronologia" },
] as const;

export function ProjectTabs({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  const base = `/projects/${projectId}`;

  return (
    <nav
      className="-mx-4 overflow-x-auto scrollbar-thin px-4 md:mx-0 md:px-0"
      aria-label="Sezioni del progetto"
    >
      <ul className="flex min-w-max gap-1 border-b border-border">
        {TABS.map((tab) => {
          const href = tab.segment ? `${base}/${tab.segment}` : base;
          const active = pathname === href;
          return (
            <li key={tab.segment || "overview"}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "-mb-px inline-block border-b-2 px-3 py-2 text-[13px] font-medium transition-colors",
                  active
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
