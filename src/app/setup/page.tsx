import { redirect } from "next/navigation";
import { Database, KeyRound, Terminal } from "lucide-react";

import { Logo } from "@/components/common/logo";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata = { title: "Configurazione" };

/**
 * Shown when the app boots without Supabase credentials. Better than a
 * stack trace: it says exactly what is missing and how to fix it.
 */
export default function SetupPage() {
  if (isSupabaseConfigured) redirect("/home");

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center px-5 py-12">
      <main id="contenuto">
        <span className="flex items-center gap-2">
          <Logo />
          <span className="font-display text-[15px] font-semibold">Mindraft</span>
        </span>

        <h1 className="mt-6 font-display text-2xl font-semibold tracking-tight">
          Manca la configurazione di Supabase
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
          L&apos;applicazione è installata correttamente, ma non sa a quale database
          parlare. Servono due variabili d&apos;ambiente e un minuto di lavoro.
        </p>

        <ol className="mt-8 space-y-5">
          <Step
            icon={<Database className="size-4" />}
            title="Crea un progetto Supabase"
            body="Da supabase.com, piano gratuito. Annota URL del progetto e chiave anon."
          />
          <Step
            icon={<KeyRound className="size-4" />}
            title="Copia .env.example in .env.local"
            body="Compila NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY. Le altre variabili sono opzionali."
          />
          <Step
            icon={<Terminal className="size-4" />}
            title="Applica le migrazioni"
            body="supabase link --project-ref <ref> && supabase db push — oppure incolla i file di supabase/migrations nell'editor SQL, in ordine."
          />
        </ol>

        <p className="mt-8 rounded-[var(--radius-lg)] border border-border bg-surface p-4 text-[13px] leading-relaxed text-muted-foreground">
          Senza chiave AI l&apos;app funziona lo stesso: il provider{" "}
          <code className="rounded bg-surface-muted px-1">mock</code> è locale e
          deterministico, e ogni proposta è etichettata come tale.
        </p>
      </main>
    </div>
  );
}

function Step({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-muted text-muted-foreground">
        {icon}
      </span>
      <span>
        <span className="block font-display text-sm font-semibold">{title}</span>
        <span className="mt-0.5 block text-[13px] leading-relaxed text-muted-foreground">
          {body}
        </span>
      </span>
    </li>
  );
}
