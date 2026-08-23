"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { ThemeToggle } from "@/components/app-shell/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  removeDemoWorkspaceAction,
  seedDemoWorkspaceAction,
  updateProfileAction,
} from "@/server/actions/workspace";

const GUIDANCE = [
  { value: "minimal", label: "Poca guida" },
  { value: "balanced", label: "Equilibrata" },
  { value: "guided", label: "Guida attiva" },
] as const;

export function ProfileSettings({
  fullName,
  email,
  guidanceLevel,
  hasDemo,
}: {
  fullName: string;
  email: string | null;
  guidanceLevel: "minimal" | "balanced" | "guided";
  hasDemo: boolean;
}) {
  const router = useRouter();
  const [name, setName] = React.useState(fullName);
  const [guidance, setGuidance] = React.useState(guidanceLevel);
  const [pending, startTransition] = React.useTransition();
  const [confirmRemove, setConfirmRemove] = React.useState(false);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Profilo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="settings-name">Nome</Label>
            <Input
              id="settings-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="settings-email">Email</Label>
            <Input id="settings-email" value={email ?? ""} readOnly disabled />
            <p className="text-[12px] text-muted-foreground">
              L&apos;email si cambia dalla schermata di accesso, con conferma via posta.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="settings-guidance">Livello di guida</Label>
            <select
              id="settings-guidance"
              value={guidance}
              onChange={(event) => setGuidance(event.target.value as typeof guidance)}
              className="h-9 w-full rounded-[var(--radius-md)] border border-border bg-surface px-2 text-[13px]"
            >
              {GUIDANCE.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <Button
            variant="primary"
            size="sm"
            loading={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await updateProfileAction({
                  fullName: name,
                  guidanceLevel: guidance,
                });
                if (!result.ok) {
                  toast.error(result.error);
                  return;
                }
                toast.success("Profilo aggiornato");
                router.refresh();
              })
            }
          >
            Salva
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Aspetto</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-[13px] text-muted-foreground">
              Tema chiaro, scuro o quello di sistema. Il contrasto rispetta WCAG AA in
              entrambi.
            </p>
            <ThemeToggle />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Spazio dimostrativo</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              Un workspace separato con idee disordinate, un progetto completo, una
              decisione e una revisione. Non tocca i tuoi dati reali e si rimuove in un
              clic.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                loading={pending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await seedDemoWorkspaceAction();
                    if (!result.ok) {
                      toast.error(result.error);
                      return;
                    }
                    toast.success("Spazio dimostrativo creato: selezionalo dal menu in basso a sinistra");
                    router.refresh();
                  })
                }
              >
                {hasDemo ? "Rigenera" : "Crea spazio dimostrativo"}
              </Button>
              {hasDemo && (
                <Button variant="ghost" size="sm" onClick={() => setConfirmRemove(true)}>
                  Rimuovi
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title="Rimuovere lo spazio dimostrativo?"
        description="Elimina definitivamente il workspace demo e tutto ciò che contiene. I tuoi spazi reali non vengono toccati."
        confirmLabel="Rimuovi"
        destructive
        onConfirm={async () => {
          const result = await removeDemoWorkspaceAction();
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          toast.success("Spazio dimostrativo rimosso");
          router.refresh();
        }}
      />
    </div>
  );
}
