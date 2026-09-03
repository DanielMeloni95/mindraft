"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Button } from "@/components/ui/button";
import { archiveProjectAction } from "@/server/actions/projects";

export function DeleteProjectButton({ projectId, isSubproject }: { projectId: string; isSubproject: boolean }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const label = isSubproject ? "sottoprogetto" : "progetto";

  return <>
    <Button variant="ghost" size="sm" className="text-danger hover:text-danger" onClick={() => setOpen(true)}>
      <Trash2 /> Elimina
    </Button>
    <ConfirmDialog
      open={open}
      onOpenChange={setOpen}
      title={`Eliminare questo ${label}?`}
      description={`Il ${label} finirà nell'archivio e potrà essere ripristinato. Attività, documento agentico, canvas e contenuti collegati non verranno distrutti.`}
      confirmLabel={`Elimina ${label}`}
      destructive
      onConfirm={async () => {
        const result = await archiveProjectAction(projectId);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success(`${isSubproject ? "Sottoprogetto" : "Progetto"} eliminato`, {
          action: { label: "Annulla", onClick: () => void archiveProjectAction(projectId, true).then(() => router.refresh()) },
        });
        router.push(isSubproject ? "/subprojects" : "/projects");
        router.refresh();
      }}
    />
  </>;
}
