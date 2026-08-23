"use client";

import Link from "next/link";

import { matrixPosition } from "@/lib/domain/scoring";
import type { IdeaListItem } from "@/server/queries/ideas";

/**
 * Impact × feasibility. Ideas without those two criteria are listed
 * underneath rather than dropped at (0,0), which would be a lie.
 */
export function IdeaMatrix({ ideas }: { ideas: IdeaListItem[] }) {
  const positioned = ideas
    .map((idea) => ({ idea, position: matrixPosition(idea.scores) }))
    .filter((entry) => entry.position.quadrant !== "unknown");

  const unpositioned = ideas.filter(
    (idea) => matrixPosition(idea.scores).quadrant === "unknown",
  );

  return (
    <div className="space-y-4">
      <div className="surface-card p-4">
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface-muted/40">
          <div className="absolute inset-x-0 top-1/2 h-px bg-border" aria-hidden />
          <div className="absolute inset-y-0 left-1/2 w-px bg-border" aria-hidden />

          <span className="absolute left-3 top-2 text-[11px] font-medium text-subtle-foreground">
            Scommesse grandi
          </span>
          <span className="absolute right-3 top-2 text-[11px] font-medium text-subtle-foreground">
            Vittorie rapide
          </span>
          <span className="absolute bottom-2 left-3 text-[11px] font-medium text-subtle-foreground">
            Da evitare per ora
          </span>
          <span className="absolute bottom-2 right-3 text-[11px] font-medium text-subtle-foreground">
            Riempitivi
          </span>

          {positioned.map(({ idea, position }) => (
            <Link
              key={idea.id}
              href={`/ideas/${idea.id}`}
              className="absolute -translate-x-1/2 translate-y-1/2 rounded-full border border-primary bg-surface px-2 py-1 text-[11px] font-medium shadow-soft transition-transform hover:z-10 hover:scale-105"
              style={{
                left: `${8 + (position.feasibility / 10) * 84}%`,
                bottom: `${8 + (position.impact / 10) * 84}%`,
              }}
              title={`Impatto ${position.impact}/10 · Fattibilità ${position.feasibility}/10`}
            >
              {idea.title.length > 26 ? `${idea.title.slice(0, 25)}…` : idea.title}
            </Link>
          ))}
        </div>

        <p className="mt-3 text-[12px] text-muted-foreground">
          Asse orizzontale: fattibilità. Asse verticale: impatto. Entrambi vengono dai
          valori che hai inserito tu.
        </p>
      </div>

      {unpositioned.length > 0 && (
        <div className="surface-card p-4">
          <h3 className="font-display text-sm font-semibold">Non posizionabili</h3>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Manca impatto o fattibilità: senza quei due valori il punto sarebbe inventato.
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {unpositioned.map((idea) => (
              <li key={idea.id}>
                <Link
                  href={`/ideas/${idea.id}`}
                  className="rounded-full border border-border bg-surface px-2.5 py-1 text-[12px] hover:border-border-strong"
                >
                  {idea.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
