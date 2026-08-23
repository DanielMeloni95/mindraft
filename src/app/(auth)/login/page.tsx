import Link from "next/link";
import { redirect } from "next/navigation";

import { isSupabaseConfigured } from "@/lib/env";
import { getSessionContext } from "@/server/session";
import { LoginForm } from "./login-form";

export const metadata = { title: "Accedi" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  if (!isSupabaseConfigured) redirect("/setup");
  const session = await getSessionContext();
  if (session) redirect("/home");

  const params = await searchParams;

  return (
    <>
      <h1 className="font-display text-2xl font-semibold tracking-tight">Bentornato</h1>
      <p className="mt-1 text-[13px] text-muted-foreground">
        Riprendi da dove ti eri fermato.
      </p>

      {params.error === "invalid_code" && (
        <p role="alert" className="mt-4 rounded-[var(--radius-md)] border border-rose-200 bg-rose-50 p-3 text-[13px] text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100">
          Il link non è più valido. Richiedine uno nuovo.
        </p>
      )}

      <LoginForm next={params.next ?? "/home"} />

      <p className="mt-6 text-[13px] text-muted-foreground">
        Non hai un account?{" "}
        <Link href="/signup" className="font-medium text-primary hover:underline">
          Crea il tuo spazio
        </Link>
      </p>
    </>
  );
}
