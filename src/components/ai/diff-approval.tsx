"use client";

import * as React from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  CONFIDENCE_LABEL,
  isOverwrite,
  type ProposalSection,
} from "@/lib/domain/proposals";

/**
 * Per-section approval with a readable diff.
 *
 * Two rules drive this component:
 * 1. nothing is pre-approved when it would overwrite something the user
 *    wrote — those start unticked and are marked;
 * 2. the current value is always shown next to the proposal, so
 *    "approve" never means "trust me".
 */
export function DiffApproval({
  sections,
  selected,
  onToggle,
}: {
  sections: ProposalSection[];
  selected: Set<string>;
  onToggle: (key: string, next: boolean) => void;
}) {
  return (
    <ul className="space-y-2.5">
      {sections.map((section) => {
        const checked = selected.has(section.key);
        const overwrite = isOverwrite(section);
        const id = `section-${section.key}`;

        return (
          <li
            key={section.key}
            className={cn(
              "rounded-[var(--radius-lg)] border p-3 transition-colors",
              checked ? "border-primary/60 bg-brand-50/50 dark:bg-brand-900/20" : "border-border bg-surface",
            )}
          >
            <div className="flex items-start gap-3">
              <Checkbox
                id={id}
                checked={checked}
                onCheckedChange={(value) => onToggle(section.key, value === true)}
                className="mt-1"
                aria-describedby={`${id}-desc`}
              />
              <div className="min-w-0 flex-1">
                <label htmlFor={id} className="flex flex-wrap items-center gap-2">
                  <span className="text-[13px] font-medium text-foreground">{section.label}</span>
                  <span
                    className={cn(
                      "rounded-full border px-1.5 py-0.5 text-[10px] font-medium",
                      section.confidence === "high"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200"
                        : section.confidence === "medium"
                          ? "border-border bg-surface-muted text-muted-foreground"
                          : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200",
                    )}
                  >
                    {CONFIDENCE_LABEL[section.confidence]}
                  </span>
                  {overwrite && (
                    <span className="rounded-full border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[10px] font-medium text-rose-700 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-200">
                      sostituisce il tuo testo
                    </span>
                  )}
                </label>

                {section.rationale && (
                  <p id={`${id}-desc`} className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                    {section.rationale}
                  </p>
                )}

                <div className="mt-2 space-y-2">
                  {section.current.trim().length > 0 && (
                    <div className="rounded-[var(--radius-sm)] border border-border bg-surface-muted p-2">
                      <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-subtle-foreground">
                        Ora
                      </span>
                      <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-muted-foreground line-through decoration-1">
                        {section.current}
                      </p>
                    </div>
                  )}
                  <div className="rounded-[var(--radius-sm)] border border-teal-200 bg-teal-50/60 p-2 dark:border-teal-800 dark:bg-teal-900/20">
                    <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-teal-700 dark:text-teal-300">
                      Proposta
                    </span>
                    <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-foreground">
                      {section.proposed}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Sections that would overwrite user text start unchecked. */
export function defaultSelection(sections: ProposalSection[]): Set<string> {
  return new Set(sections.filter((s) => !isOverwrite(s)).map((s) => s.key));
}
