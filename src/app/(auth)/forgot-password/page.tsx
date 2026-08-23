import Link from "next/link";

import { ForgotPasswordForm } from "./forgot-form";

export const metadata = { title: "Recupera password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="font-display text-2xl font-semibold tracking-tight">
        Recupera l&apos;accesso
      </h1>
      <p className="mt-1 text-[13px] text-muted-foreground">
        Ti mandiamo un link per impostare una nuova password.
      </p>
      <ForgotPasswordForm />
      <p className="mt-6 text-[13px] text-muted-foreground">
        <Link href="/login" className="font-medium text-primary hover:underline">
          Torna all&apos;accesso
        </Link>
      </p>
    </>
  );
}
