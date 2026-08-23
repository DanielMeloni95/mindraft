"use client";

import * as React from "react";
import { Download, FileJson, FileText, Sheet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const FORMATS = [
  {
    format: "json",
    label: "JSON completo",
    icon: FileJson,
    description: "Ogni entità con i suoi identificativi: le relazioni restano intatte.",
  },
  {
    format: "markdown",
    label: "Markdown",
    icon: FileText,
    description: "Idee e progetti leggibili, documenti inclusi.",
  },
  {
    format: "csv",
    label: "CSV",
    icon: Sheet,
    description: "Elenco piatto di idee, progetti, attività e decisioni.",
  },
] as const;

export function DataSettings() {
  const [pending, setPending] = React.useState<string | null>(null);

  const download = async (format: string) => {
    setPending(format);
    try {
      window.location.href = `/api/export?format=${format}`;
    } finally {
      setTimeout(() => setPending(null), 1500);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Esportazione</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {FORMATS.map((option) => {
              const Icon = option.icon;
              return (
                <li key={option.format} className="flex items-start gap-3">
                  <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-medium">{option.label}</span>
                    <span className="block text-[12px] text-muted-foreground">
                      {option.description}
                    </span>
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={pending === option.format}
                    onClick={() => void download(option.format)}
                  >
                    <Download /> Scarica
                  </Button>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cosa vede il provider AI</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            Quando chiedi una proposta, viene inviato al provider solo il contenuto
            dell&apos;elemento su cui stai lavorando (e, per il confronto, delle idee che
            selezioni). Non vengono inviati né i tuoi dati di account né gli altri
            workspace.
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
            Di ogni esecuzione conserviamo solo dati tecnici — funzione, provider, durata,
            esito, crediti — mai i prompt né le risposte.
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
            Se non configuri una chiave, il provider è locale e deterministico: nessun
            contenuto lascia il tuo server.
          </p>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Eliminazione dell&apos;account</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            L&apos;eliminazione definitiva dell&apos;account richiede una conferma via
            email e cancella tutti i workspace di cui sei proprietario. Scrivi a{" "}
            <a href="mailto:privacy@mindraft.app" className="text-primary hover:underline">
              privacy@mindraft.app
            </a>{" "}
            dall&apos;indirizzo dell&apos;account: la procedura automatica è nel backlog e
            preferiamo dirtelo invece di mostrarti un pulsante che non fa nulla.
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
            Prima di procedere, scarica l&apos;esportazione JSON qui sopra.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
