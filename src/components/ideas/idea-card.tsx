import Link from "next/link";
import { Star } from "lucide-react";

import { RelativeTime } from "@/components/common/relative-time";
import { StatusBadge } from "@/components/common/status-badge";
import { IDEA_MATURITY_MAP, IDEA_STATUS_MAP } from "@/lib/domain/constants";
import { QUADRANT_LABELS, matrixPosition } from "@/lib/domain/scoring";
import { truncate } from "@/lib/utils";
import type { IdeaListItem } from "@/server/queries/ideas";

export function IdeaCard({ idea }: { idea: IdeaListItem }) {
  const quadrant = matrixPosition(idea.scores).quadrant;

  return (
    <li className="surface-card transition-shadow hover:shadow-raised">
      <Link href={`/ideas/${idea.id}`} className="block p-4">
        <div className="flex items-start gap-2">
          <h3 className="min-w-0 flex-1 font-display text-[14px] font-semibold leading-snug">
            {idea.title}
          </h3>
          {idea.is_favorite && (
            <Star className="size-3.5 shrink-0 fill-amber-400 text-amber-400" aria-label="Preferita" />
          )}
        </div>

        <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
          {truncate(idea.summary ?? idea.original_content, 150)}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <StatusBadge descriptor={IDEA_STATUS_MAP[idea.status]} />
          <StatusBadge descriptor={IDEA_MATURITY_MAP[idea.maturity]} />
          {idea.category && (
            <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] text-muted-foreground">
              {idea.category}
            </span>
          )}
          {idea.project && (
            <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] text-muted-foreground">
              {idea.project.emoji ?? "🧩"} {idea.project.name}
            </span>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-border pt-2.5 text-[11px] text-subtle-foreground">
          <span>
            {idea.breakdown.total === null ? (
              "Non valutata"
            ) : (
              <>
                <span className="font-semibold tabular-nums text-foreground">
                  {idea.breakdown.total}
                </span>
                /100 · {QUADRANT_LABELS[quadrant]}
                {idea.breakdown.confidence === "low" && " · stima parziale"}
              </>
            )}
          </span>
          <RelativeTime value={idea.updated_at} />
        </div>
      </Link>
    </li>
  );
}
