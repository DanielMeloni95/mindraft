"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateProjectAction } from "@/server/actions/projects";

type EditableProject = {
  id: string;
  name: string;
  emoji: string | null;
  color: string | null;
  short_description: string | null;
  context_scope: string | null;
  website_url: string | null;
};

export function EditProjectButton({ project }: { project: EditableProject }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [name, setName] = React.useState(project.name);
  const [emoji, setEmoji] = React.useState(project.emoji ?? "🧩");
  const [color, setColor] = React.useState(project.color ?? "#5B5CE2");
  const [description, setDescription] = React.useState(project.short_description ?? "");
  const [scope, setScope] = React.useState(project.context_scope ?? "");
  const [url, setUrl] = React.useState(project.website_url ?? "");

  return <>
    <Button variant="secondary" size="sm" onClick={() => setOpen(true)}><Pencil /> Modifica</Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Modifica progetto</DialogTitle>
          <DialogDescription>Aggiorna le informazioni mostrate nelle pagine e nella Mappa globale.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-[72px_1fr_72px] gap-3">
            <div className="space-y-1.5"><Label htmlFor="edit-project-emoji">Icona</Label><Input id="edit-project-emoji" value={emoji} onChange={(event) => setEmoji(event.target.value.slice(0, 8))} className="text-center text-lg" /></div>
            <div className="space-y-1.5"><Label htmlFor="edit-project-name">Nome</Label><Input id="edit-project-name" value={name} onChange={(event) => setName(event.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="edit-project-color">Colore</Label><Input id="edit-project-color" type="color" value={color} onChange={(event) => setColor(event.target.value)} className="p-1" /></div>
          </div>
          <div className="space-y-1.5"><Label htmlFor="edit-project-scope">Ambito / area</Label><Input id="edit-project-scope" list="edit-project-scope-options" value={scope} onChange={(event) => setScope(event.target.value)} placeholder="Lavoro, personale, sport, studio…" /><datalist id="edit-project-scope-options"><option value="Lavoro" /><option value="Personale" /><option value="Sport" /><option value="Studio" /><option value="Salute" /><option value="Finanze" /><option value="Creatività" /></datalist></div>
          <div className="space-y-1.5"><Label htmlFor="edit-project-url">URL</Label><Input id="edit-project-url" type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://esempio.it" /></div>
          <div className="space-y-1.5"><Label htmlFor="edit-project-description">Descrizione breve</Label><Textarea id="edit-project-description" rows={3} value={description} onChange={(event) => setDescription(event.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>Annulla</Button>
          <Button variant="primary" loading={pending} onClick={() => startTransition(async () => {
            const result = await updateProjectAction({ id: project.id, name: name.trim(), emoji: emoji.trim() || null, color, shortDescription: description.trim() || null, contextScope: scope.trim() || null, websiteUrl: url.trim() || null });
            if (!result.ok) {
              toast.error(result.error);
              return;
            }
            setOpen(false);
            toast.success("Dettagli aggiornati");
            router.refresh();
          })}>Salva modifiche</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}
