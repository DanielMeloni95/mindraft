"use client";

import { useActionState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updatePasswordAction } from "@/server/actions/auth";
import type { ActionResult } from "@/server/action-result";
import { SubmitButton } from "../login/login-form";

export function ResetPasswordForm() {
  const [state, formAction] = useActionState<ActionResult<undefined> | null, FormData>(
    updatePasswordAction,
    null,
  );

  return (
    <form action={formAction} className="mt-6 space-y-4" noValidate>
      {state && !state.ok && (
        <p role="alert" className="rounded-[var(--radius-md)] border border-rose-200 bg-rose-50 p-3 text-[13px] text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100">
          {state.error}
        </p>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="password">Nuova password</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} />
      </div>
      <SubmitButton label="Salva password" />
    </form>
  );
}
