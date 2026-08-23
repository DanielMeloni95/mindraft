import Link from "next/link";
import { redirect } from "next/navigation";

import { isSupabaseConfigured } from "@/lib/env";
import { getSessionContext } from "@/server/session";
import { SignUpForm } from "./signup-form";

export const metadata = { title: "Crea account" };

export default async function SignUpPage() {
  if (!isSupabaseConfigured) redirect("/setup");
  const session = await getSessionContext();
  if (session) redirect("/home");

  return (
    <>
      <h1 className="font-display text-2xl font-semibold tracking-tight">
        Crea il tuo spazio
      </h1>
      <p className="mt-1 text-[13px] text-muted-foreground">
        Bastano trenta secondi. Il primo pensiero lo scrivi subito dopo.
      </p>

      <SignUpForm />

      <p className="mt-6 text-[13px] text-muted-foreground">
        Hai già un account?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Accedi
        </Link>
      </p>
    </>
  );
}
