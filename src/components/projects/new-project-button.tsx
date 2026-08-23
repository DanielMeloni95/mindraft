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

export function NewProjectButton() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [emoji, setEmoji] = React.useState("🧩");
  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="primary" size="sm">
          <Plus /> Nuovo progetto
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuovo progetto</DialogTitle>
          <DialogDescription>
            Nasce vuoto ma completo: documento, mappa e sezioni sono già pronti.
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
            <Label htmlFor="project-description">Descrizione breve</Label>
            <Textarea
              id="project-description"
              rows={2}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Una riga per ricordarti di cosa si tratta."
            />
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
                });

                if (!result.ok) {
                  setErrors(result.fieldErrors ?? {});
                  if (!result.fieldErrors) toast.error(result.error);
                  return;
                }

                setOpen(false);
                setName("");
                setDescription("");
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
