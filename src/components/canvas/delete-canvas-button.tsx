"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Button } from "@/components/ui/button";
import { archiveCanvasAction } from "@/server/actions/canvas";

export function DeleteCanvasButton({ canvasId, projectId }: { canvasId: string; projectId: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  return <>
    <Button variant="ghost" size="sm" className="text-danger hover:text-danger" onClick={() => setOpen(true)}><Trash2 /> Elimina canvas</Button>
    <ConfirmDialog open={open} onOpenChange={setOpen} title="Eliminare questo canvas?" description="Il canvas finirà nell'archivio. Nodi e collegamenti resteranno conservati e torneranno disponibili se lo ripristini." confirmLabel="Elimina canvas" destructive onConfirm={async () => {
      const result = await archiveCanvasAction(canvasId);
      if (!result.ok) return void toast.error(result.error);
      toast.success("Canvas eliminato", { action: { label: "Annulla", onClick: () => void archiveCanvasAction(canvasId, true).then(() => router.refresh()) } });
      router.push(`/projects/${projectId}`);
      router.refresh();
    }} />
  </>;
}
