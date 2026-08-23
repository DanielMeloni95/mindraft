import { Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Marks anything that came out of the AI layer, and says which engine
 * produced it. "mock" is a real, local, deterministic implementation —
 * calling it out keeps the user from mistaking a heuristic for a model.
 */
export function AiBadge({
  provider,
  className,
}: {
  provider?: string | null;
  className?: string;
}) {
  const isMock = provider === "mock";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        isMock
          ? "border-border bg-surface-muted text-muted-foreground"
          : "border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-800 dark:bg-teal-900/30 dark:text-teal-200",
        className,
      )}
      title={
        isMock
          ? "Provider locale deterministico: nessuna chiamata a un modello esterno"
          : "Generato da un modello esterno"
      }
    >
      <Sparkles className="size-3" aria-hidden />
      {isMock ? "assistente locale" : "AI"}
    </span>
  );
}

export function AssumptionList({
  assumptions,
  questions,
}: {
  assumptions: string[];
  questions: string[];
}) {
  if (assumptions.length === 0 && questions.length === 0) return null;

  return (
    <div className="mt-3 space-y-3 rounded-[var(--radius-md)] bg-surface-muted p-3">
      {assumptions.length > 0 && (
        <div>
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-subtle-foreground">
            Su cosa mi sono basato
          </h4>
          <ul className="mt-1 space-y-1">
            {assumptions.map((assumption, index) => (
              <li key={index} className="text-[12px] leading-relaxed text-muted-foreground">
                · {assumption}
              </li>
            ))}
          </ul>
        </div>
      )}
      {questions.length > 0 && (
        <div>
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-subtle-foreground">
            Cosa mi manca
          </h4>
          <ul className="mt-1 space-y-1">
            {questions.map((question, index) => (
              <li key={index} className="text-[12px] leading-relaxed text-muted-foreground">
                · {question}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
