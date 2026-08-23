"use client";

import { useActionState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestPasswordResetAction } from "@/server/actions/auth";
import type { ActionResult } from "@/server/action-result";
import { SubmitButton } from "../login/login-form";

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState<
    ActionResult<{ sent: boolean }> | null,
    FormData
  >(requestPasswordResetAction, null);

  if (state?.ok) {
    return (
      <p className="mt-6 rounded-[var(--radius-lg)] border border-border bg-surface p-4 text-[13px] leading-relaxed text-muted-foreground">
        Se esiste un account con quell&apos;indirizzo, il link è partito. Controlla anche
        lo spam.
      </p>
    );
  }

  return (
    <form action={formAction} className="mt-6 space-y-4" noValidate>
      {state && !state.ok && (
        <p role="alert" className="rounded-[var(--radius-md)] border border-rose-200 bg-rose-50 p-3 text-[13px] text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100">
          {state.error}
        </p>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <SubmitButton label="Invia il link" />
    </form>
  );
}
