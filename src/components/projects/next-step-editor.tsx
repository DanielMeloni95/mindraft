"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateProjectAction } from "@/server/actions/projects";

/** One line, the single most useful field on the page. */
export function NextStepEditor({
  projectId,
  value,
}: {
  projectId: string;
  value: string | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(value ?? "");
  const [pending, startTransition] = React.useTransition();

  const save = () =>
    startTransition(async () => {
      const next = draft.trim();
      const result = await updateProjectAction({
        id: projectId,
        nextStep: next || null,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setEditing(false);
      router.refresh();
    });

  if (!editing) {
    return (
      <div className="flex items-start gap-2">
        <p className="min-w-0 flex-1 text-[15px] leading-relaxed">
          {value ?? (
            <span className="text-muted-foreground">
              Nessun prossimo passo scritto. È il campo che tiene vivo un progetto.
            </span>
          )}
        </p>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setEditing(true)}
          aria-label="Modifica il prossimo passo"
        >
          <Pencil />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        value={draft}
        autoFocus
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") save();
          if (event.key === "Escape") {
            setDraft(value ?? "");
            setEditing(false);
          }
        }}
        placeholder="Verificare il problema con tre persone"
        aria-label="Prossimo passo"
      />
      <Button variant="primary" size="icon-sm" onClick={save} loading={pending} aria-label="Salva">
        <Check />
      </Button>
    </div>
  );
}
