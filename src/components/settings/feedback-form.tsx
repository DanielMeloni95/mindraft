"use client";

import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { sendFeedbackAction } from "@/server/actions/workspace";

const KINDS = [
  { value: "general", label: "Generale" },
  { value: "bug", label: "Qualcosa non funziona" },
  { value: "idea", label: "Proposta" },
  { value: "ai_quality", label: "Qualità delle proposte AI" },
] as const;

export function FeedbackForm() {
  const [kind, setKind] = React.useState<(typeof KINDS)[number]["value"]>("general");
  const [message, setMessage] = React.useState("");
  const [sent, setSent] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  if (sent) {
    return (
      <Card>
        <CardContent className="pt-4">
          <p className="text-[14px]">Ricevuto. Grazie: lo leggiamo davvero.</p>
          <Button variant="ghost" size="sm" className="mt-3" onClick={() => setSent(false)}>
            Scrivi altro
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-3 pt-4">
        <div className="space-y-1.5">
          <Label htmlFor="feedback-kind">Tipo</Label>
          <select
            id="feedback-kind"
            value={kind}
            onChange={(event) => setKind(event.target.value as typeof kind)}
            className="h-9 w-full max-w-xs rounded-[var(--radius-md)] border border-border bg-surface px-2 text-[13px]"
          >
            {KINDS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="feedback-message">Messaggio</Label>
          <Textarea
            id="feedback-message"
            rows={6}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Cosa è successo, cosa ti aspettavi…"
          />
        </div>

        <Button
          variant="primary"
          loading={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await sendFeedbackAction({ kind, message: message.trim() });
              if (!result.ok) {
                toast.error(result.error);
                return;
              }
              setMessage("");
              setSent(true);
            })
          }
        >
          Invia
        </Button>
      </CardContent>
    </Card>
  );
}
