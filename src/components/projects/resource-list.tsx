"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ExternalLink, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SEVERITY_LEVELS, SEVERITY_MAP } from "@/lib/domain/constants";
import {
  deleteResourceAction,
  deleteRiskAction,
  saveResourceAction,
  saveRiskAction,
} from "@/server/actions/planning";
import type { ResourceRow, RiskRow, SeverityLevel } from "@/types/database";

export function ResourceList({
  projectId,
  resources,
  risks,
  canWrite,
}: {
  projectId: string;
  resources: ResourceRow[];
  risks: RiskRow[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [addingResource, setAddingResource] = React.useState(false);
  const [addingRisk, setAddingRisk] = React.useState(false);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Risorse e fonti</CardTitle>
          {canWrite && (
            <Button variant="ghost" size="sm" onClick={() => setAddingResource(true)}>
              <Plus /> Aggiungi
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {resources.length === 0 ? (
            <EmptyState
              title="Nessuna risorsa"
              description="Link, persone, strumenti: tutto ciò che ti servirà ritrovare."
              className="border-0 bg-transparent px-0"
            />
          ) : (
            <ul className="space-y-2.5">
              {resources.map((resource) => (
                <li key={resource.id} className="flex items-start gap-2">
                  <span className="min-w-0 flex-1">
                    {resource.url ? (
                      <a
                        href={resource.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="inline-flex items-center gap-1 text-[13px] font-medium text-primary hover:underline"
                      >
                        {resource.title}
                        <ExternalLink className="size-3" aria-hidden />
                      </a>
                    ) : (
                      <span className="text-[13px] font-medium">{resource.title}</span>
                    )}
                    {resource.notes && (
                      <span className="mt-0.5 block text-[12px] text-muted-foreground">
                        {resource.notes}
                      </span>
                    )}
                  </span>
                  {canWrite && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Elimina ${resource.title}`}
                      onClick={() =>
                        void deleteResourceAction(resource.id).then((result) => {
                          if (!result.ok) toast.error(result.error);
                          else router.refresh();
                        })
                      }
                    >
                      <Trash2 />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-warning" aria-hidden /> Rischi
          </CardTitle>
          {canWrite && (
            <Button variant="ghost" size="sm" onClick={() => setAddingRisk(true)}>
              <Plus /> Aggiungi
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {risks.length === 0 ? (
            <EmptyState
              title="Nessun rischio registrato"
              description="Un rischio scritto è già mezzo mitigato."
              className="border-0 bg-transparent px-0"
            />
          ) : (
            <ul className="space-y-3">
              {risks.map((risk) => (
                <li key={risk.id}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[13px] font-medium">{risk.title}</span>
                    <StatusBadge
                      descriptor={SEVERITY_MAP[risk.likelihood]}
                      title={`Probabilità ${SEVERITY_MAP[risk.likelihood].label.toLowerCase()}`}
                    />
                    <StatusBadge
                      descriptor={SEVERITY_MAP[risk.impact]}
                      title={`Impatto ${SEVERITY_MAP[risk.impact].label.toLowerCase()}`}
                    />
                    {canWrite && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="ml-auto"
                        aria-label={`Elimina ${risk.title}`}
                        onClick={() =>
                          void deleteRiskAction(risk.id).then((result) => {
                            if (!result.ok) toast.error(result.error);
                            else router.refresh();
                          })
                        }
                      >
                        <Trash2 />
                      </Button>
                    )}
                  </div>
                  {risk.mitigation && (
                    <p className="mt-0.5 text-[12px] text-muted-foreground">
                      Mitigazione: {risk.mitigation}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {addingResource && (
        <SimpleDialog
          title="Nuova risorsa"
          open
          onOpenChange={() => setAddingResource(false)}
          fields={[
            { key: "title", label: "Titolo", required: true },
            { key: "url", label: "URL", placeholder: "https://" },
            { key: "notes", label: "Note", textarea: true },
          ]}
          onSubmit={async (values) => {
            const result = await saveResourceAction({
              projectId,
              title: values.title,
              url: values.url || undefined,
              notes: values.notes || undefined,
            });
            if (!result.ok) {
              toast.error(result.error);
              return false;
            }
            router.refresh();
            return true;
          }}
        />
      )}

      {addingRisk && (
        <RiskDialog
          projectId={projectId}
          open
          onOpenChange={() => setAddingRisk(false)}
          onSaved={() => router.refresh()}
        />
      )}
    </div>
  );
}

function SimpleDialog({
  title,
  open,
  onOpenChange,
  fields,
  onSubmit,
}: {
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fields: Array<{
    key: string;
    label: string;
    required?: boolean;
    placeholder?: string;
    textarea?: boolean;
  }>;
  onSubmit: (values: Record<string, string>) => Promise<boolean>;
}) {
  const [values, setValues] = React.useState<Record<string, string>>({});
  const [pending, startTransition] = React.useTransition();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {fields.map((field) => (
            <div key={field.key} className="space-y-1.5">
              <Label htmlFor={`field-${field.key}`}>{field.label}</Label>
              {field.textarea ? (
                <Textarea
                  id={`field-${field.key}`}
                  rows={2}
                  value={values[field.key] ?? ""}
                  onChange={(event) =>
                    setValues((current) => ({ ...current, [field.key]: event.target.value }))
                  }
                />
              ) : (
                <Input
                  id={`field-${field.key}`}
                  value={values[field.key] ?? ""}
                  placeholder={field.placeholder}
                  onChange={(event) =>
                    setValues((current) => ({ ...current, [field.key]: event.target.value }))
                  }
                />
              )}
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            Annulla
          </Button>
          <Button
            variant="primary"
            loading={pending}
            onClick={() =>
              startTransition(async () => {
                const done = await onSubmit(values);
                if (done) onOpenChange(false);
              })
            }
          >
            Salva
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RiskDialog({
  projectId,
  open,
  onOpenChange,
  onSaved,
}: {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [mitigation, setMitigation] = React.useState("");
  const [likelihood, setLikelihood] = React.useState<SeverityLevel>("medium");
  const [impact, setImpact] = React.useState<SeverityLevel>("medium");
  const [pending, startTransition] = React.useTransition();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuovo rischio</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="risk-title">Rischio</Label>
            <Input
              id="risk-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="risk-description">Descrizione</Label>
            <Textarea
              id="risk-description"
              rows={2}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="risk-likelihood">Probabilità</Label>
              <select
                id="risk-likelihood"
                value={likelihood}
                onChange={(event) => setLikelihood(event.target.value as SeverityLevel)}
                className="h-9 w-full rounded-[var(--radius-md)] border border-border bg-surface px-2 text-[13px]"
              >
                {SEVERITY_LEVELS.map((level) => (
                  <option key={level.value} value={level.value}>
                    {level.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="risk-impact">Impatto</Label>
              <select
                id="risk-impact"
                value={impact}
                onChange={(event) => setImpact(event.target.value as SeverityLevel)}
                className="h-9 w-full rounded-[var(--radius-md)] border border-border bg-surface px-2 text-[13px]"
              >
                {SEVERITY_LEVELS.map((level) => (
                  <option key={level.value} value={level.value}>
                    {level.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="risk-mitigation">Mitigazione</Label>
            <Textarea
              id="risk-mitigation"
              rows={2}
              value={mitigation}
              onChange={(event) => setMitigation(event.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            Annulla
          </Button>
          <Button
            variant="primary"
            loading={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await saveRiskAction({
                  projectId,
                  title: title.trim(),
                  description: description.trim() || undefined,
                  mitigation: mitigation.trim() || undefined,
                  likelihood,
                  impact,
                });
                if (!result.ok) {
                  toast.error(result.error);
                  return;
                }
                onOpenChange(false);
                onSaved();
              })
            }
          >
            Salva
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
