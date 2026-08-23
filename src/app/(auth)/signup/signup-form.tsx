"use client";

import { useActionState } from "react";
import { MailCheck } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signUpAction } from "@/server/actions/auth";
import type { ActionResult } from "@/server/action-result";
import { SubmitButton } from "../login/login-form";

export function SignUpForm() {
  const [state, formAction] = useActionState<
    ActionResult<{ needsConfirmation: boolean }> | null,
    FormData
  >(signUpAction, null);

  if (state?.ok && state.data.needsConfirmation) {
    return (
      <div className="mt-6 rounded-[var(--radius-lg)] border border-border bg-surface p-4">
        <MailCheck className="size-5 text-accent-600" aria-hidden />
        <h2 className="mt-2 font-display text-sm font-semibold">Controlla la posta</h2>
        <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
          Ti abbiamo inviato un link di conferma. Aprilo e torni qui già dentro il tuo
          spazio.
        </p>
      </div>
    );
  }

  const fieldErrors = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <form action={formAction} className="mt-6 space-y-4" noValidate>
      {state && !state.ok && !fieldErrors && (
        <p role="alert" className="rounded-[var(--radius-md)] border border-rose-200 bg-rose-50 p-3 text-[13px] text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100">
          {state.error}
        </p>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="fullName">Come ti chiami</Label>
        <Input id="fullName" name="fullName" autoComplete="name" required aria-invalid={Boolean(fieldErrors?.fullName)} />
        {fieldErrors?.fullName && <p className="text-[12px] text-danger">{fieldErrors.fullName[0]}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required aria-invalid={Boolean(fieldErrors?.email)} />
        {fieldErrors?.email && <p className="text-[12px] text-danger">{fieldErrors.email[0]}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          aria-invalid={Boolean(fieldErrors?.password)}
          aria-describedby="password-hint"
        />
        <p id="password-hint" className="text-[12px] text-muted-foreground">
          Almeno 8 caratteri.
        </p>
        {fieldErrors?.password && <p className="text-[12px] text-danger">{fieldErrors.password[0]}</p>}
      </div>

      <SubmitButton label="Crea account" />
    </form>
  );
}
