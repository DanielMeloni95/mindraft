"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createProjectAction } from "@/server/actions/projects";

export function NewProjectButton({
  parentProjectId,
  parentProjectName,
}: {
  parentProjectId?: string;
  parentProjectName?: string;
} = {}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [emoji, setEmoji] = React.useState("🧩");
  const [contextScope, setContextScope] = React.useState("");
  const [websiteUrl, setWebsiteUrl] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="primary" size="sm">
          <Plus /> {parentProjectId ? "Nuovo sottoprogetto" : "Nuovo progetto"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{parentProjectId ? "Nuovo sottoprogetto" : "Nuovo progetto"}</DialogTitle>
          <DialogDescription>
            {parentProjectId
              ? `Sarà collegato a ${parentProjectName ?? "questo progetto"} ed erediterà contesto e dipendenze.`
              : "Nasce vuoto ma completo: documento, mappa e sezioni sono già pronti."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="w-16 space-y-1.5">
              <Label htmlFor="project-emoji">Icona</Label>
              <Input
                id="project-emoji"
                value={emoji}
                onChange={(event) => setEmoji(event.target.value.slice(0, 4))}
                className="text-center text-lg"
              />
            </div>
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="project-name">Nome</Label>
              <Input
                id="project-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoFocus
                aria-invalid={Boolean(errors.name)}
                placeholder="Radar delle idee"
              />
              {errors.name && <p className="text-[12px] text-danger">{errors.name[0]}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="project-context-scope">Ambito</Label>
            <Input id="project-context-scope" list="project-scope-options" value={contextScope} onChange={(event) => setContextScope(event.target.value)} placeholder="Lavoro, personale, sport…" />
            <datalist id="project-scope-options"><option value="Lavoro" /><option value="Personale" /><option value="Sport" /><option value="Studio" /><option value="Salute" /><option value="Finanze" /><option value="Creatività" /></datalist>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="project-description">Descrizione breve</Label>
            <Textarea
              id="project-description"
              rows={2}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Una riga per ricordarti di cosa si tratta."
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="project-url">URL</Label>
            <Input
              id="project-url"
              type="url"
              value={websiteUrl}
              onChange={(event) => setWebsiteUrl(event.target.value)}
              placeholder="https://esempio.it"
              aria-invalid={Boolean(errors.websiteUrl)}
            />
            {errors.websiteUrl && <p className="text-[12px] text-danger">{errors.websiteUrl[0]}</p>}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            Annulla
          </Button>
          <Button
            variant="primary"
            loading={pending}
            onClick={() =>
              startTransition(async () => {
                setErrors({});
                const result = await createProjectAction({
                  name: name.trim(),
                  shortDescription: description.trim() || undefined,
                  emoji: emoji.trim() || undefined,
                  parentProjectId,
                  contextScope: contextScope.trim() || undefined,
                  websiteUrl: websiteUrl.trim() || undefined,
                });

                if (!result.ok) {
                  setErrors(result.fieldErrors ?? {});
                  if (!result.fieldErrors) toast.error(result.error);
                  return;
                }

                setOpen(false);
                setName("");
                setDescription("");
                setContextScope("");
                setWebsiteUrl("");
                router.push(`/projects/${result.data.id}`);
              })
            }
          >
            Crea progetto
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
