"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ExternalLink } from "lucide-react";
import { toast } from "sonner";

import { SaveIndicator, type SaveState } from "@/components/common/save-indicator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PROJECT_HEALTHS, PROJECT_STATUSES } from "@/lib/domain/constants";
import { TOOL_KINDS } from "@/lib/domain/tool-kinds";
import { updateProjectAction } from "@/server/actions/projects";
import type { ProjectRow } from "@/types/database";

const TEXT_FIELDS = [
  { key: "vision", label: "Visione", column: "vision" },
  { key: "problem", label: "Problema", column: "problem" },
  { key: "solution", label: "Soluzione", column: "solution" },
  { key: "audience", label: "Utenti", column: "audience" },
  { key: "valueProposition", label: "Proposta di valore", column: "value_proposition" },
  { key: "scopeIn", label: "Ambito incluso", column: "scope_in" },
  { key: "scopeOut", label: "Ambito escluso", column: "scope_out" },
] as const;

/**
 * Progressive disclosure: the overview shows what matters at a glance,
 * the long form lives one click deeper.
 */
export function ProjectDetailsForm({ project }: { project: ProjectRow }) {
  const router = useRouter();
  const [state, setState] = React.useState<SaveState>("idle");
  const [websiteUrl, setWebsiteUrl] = React.useState(project.website_url ?? "");
  const [domain, setDomain] = React.useState(project.domain ?? "");
  const [values, setValues] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(
      TEXT_FIELDS.map((field) => [
        field.key,
        (project[field.column] as string | null) ?? "",
      ]),
    ),
  );

  const save = async (patch: Record<string, unknown>) => {
    setState("saving");
    const result = await updateProjectAction({ id: project.id, ...patch });
    if (!result.ok) {
      setState("error");
      toast.error(result.error);
      return;
    }
    setState("saved");
    setTimeout(() => setState("idle"), 1600);
    router.refresh();
  };

  return (
    <details className="surface-card group overflow-hidden [&[open]_svg]:rotate-180">
      <summary className="flex cursor-pointer list-none items-center justify-between p-4">
        <span className="font-display text-sm font-semibold">Dettagli del progetto</span>
        <ChevronDown className="size-4 text-muted-foreground transition-transform" aria-hidden />
      </summary>

      <div className="space-y-4 border-t border-border p-4">
        {project.tool_kind && <div className="space-y-1.5">
          <Label htmlFor="project-tool-kind">Tipo di strumento</Label>
          <select id="project-tool-kind" value={project.tool_kind} onChange={(event) => void save({ toolKind: event.target.value })} className="h-9 w-full rounded-[var(--radius-md)] border border-border bg-surface px-2 text-[13px] sm:max-w-xs">
            {TOOL_KINDS.map((kind) => <option key={kind.value} value={kind.value}>{kind.label}</option>)}
          </select>
        </div>}
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="project-status">Stato</Label>
            <select
              id="project-status"
              value={project.status}
              onChange={(event) => void save({ status: event.target.value })}
              className="h-9 w-full rounded-[var(--radius-md)] border border-border bg-surface px-2 text-[13px]"
            >
              {PROJECT_STATUSES.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="project-health">Salute</Label>
            <select
              id="project-health"
              value={project.health}
              onChange={(event) => void save({ health: event.target.value })}
              className="h-9 w-full rounded-[var(--radius-md)] border border-border bg-surface px-2 text-[13px]"
            >
              {PROJECT_HEALTHS.map((health) => (
                <option key={health.value} value={health.value}>
                  {health.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="project-progress">Avanzamento (%)</Label>
            <Input
              id="project-progress"
              type="number"
              min={0}
              max={100}
              defaultValue={project.progress}
              onBlur={(event) => {
                const value = Number(event.target.value);
                if (Number.isFinite(value) && value !== project.progress) {
                  void save({ progress: Math.max(0, Math.min(100, Math.round(value))) });
                }
              }}
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="project-context-scope">Ambito</Label>
            <Input id="project-context-scope" list="project-detail-scope-options" defaultValue={project.scope_in ?? ""} placeholder="Lavoro, personale, sport…" onBlur={(event) => {
              const next = event.target.value.trim();
              if (next !== (project.scope_in ?? "")) void save({ contextScope: next || null });
            }} />
            <datalist id="project-detail-scope-options"><option value="Lavoro" /><option value="Personale" /><option value="Sport" /><option value="Studio" /><option value="Salute" /><option value="Finanze" /><option value="Creatività" /></datalist>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="project-website-url">Link del progetto</Label>
            <div className="flex gap-2">
              <Input
                id="project-website-url"
                type="url"
                placeholder="https://esempio.it/progetto"
                value={websiteUrl}
                onChange={(event) => setWebsiteUrl(event.target.value)}
                onBlur={() => {
                  const next = websiteUrl.trim();
                  if (next !== (project.website_url ?? "")) void save({ websiteUrl: next || null });
                }}
              />
              {project.website_url && (
                <a href={project.website_url} target="_blank" rel="noreferrer" className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border" aria-label="Apri link del progetto">
                  <ExternalLink className="size-4" />
                </a>
              )}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="project-domain">Dominio</Label>
            <Input
              id="project-domain"
              placeholder="esempio.it"
              value={domain}
              onChange={(event) => setDomain(event.target.value.toLowerCase())}
              onBlur={() => {
                const next = domain.trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
                setDomain(next);
                if (next !== (project.domain ?? "")) void save({ domain: next || null });
              }}
            />
          </div>
        </div>

        {TEXT_FIELDS.map((field) => (
          <div key={field.key} className="space-y-1.5">
            <Label htmlFor={`project-${field.key}`}>{field.label}</Label>
            <Textarea
              id={`project-${field.key}`}
              rows={2}
              value={values[field.key]}
              onChange={(event) =>
                setValues((current) => ({ ...current, [field.key]: event.target.value }))
              }
              onBlur={() => {
                const next = values[field.key].trim();
                const previous = (project[field.column] as string | null) ?? "";
                if (next !== previous) void save({ [field.key]: next || null });
              }}
            />
          </div>
        ))}

        <SaveIndicator state={state} />
      </div>
    </details>
  );
}
