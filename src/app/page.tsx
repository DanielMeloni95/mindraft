import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, GitBranch, Layers, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Logo } from "@/components/common/logo";
import { isSupabaseConfigured } from "@/lib/env";
import { getSessionContext } from "@/server/session";

export default async function LandingPage() {
  if (!isSupabaseConfigured) redirect("/setup");

  const session = await getSessionContext();
  if (session) redirect("/home");

  return (
    <div className="min-h-dvh bg-background">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
        <span className="flex items-center gap-2">
          <Logo />
          <span className="font-display text-[15px] font-semibold">Mindraft</span>
        </span>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/login">Accedi</Link>
          </Button>
          <Button variant="primary" size="sm" asChild>
            <Link href="/signup">Inizia</Link>
          </Button>
        </div>
      </header>

      <main id="contenuto" className="mx-auto max-w-5xl px-5 pb-20 pt-10">
        <p className="text-[13px] font-medium uppercase tracking-[0.18em] text-accent-600">
          Where ideas take shape
        </p>
        <h1 className="mt-3 max-w-3xl font-display text-3xl font-semibold leading-tight tracking-tight text-balance sm:text-5xl">
          Trasforma pensieri disordinati in progetti chiari, visuali e realizzabili.
        </h1>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
          Mindraft non è un blocco note e non è un project manager. È il posto dove
          un&apos;intuizione diventa un progetto senza perdere il motivo per cui ti era
          venuta in mente.
        </p>

        <div className="mt-7 flex flex-wrap gap-3">
          <Button variant="primary" size="lg" asChild>
            <Link href="/signup">
              Crea il tuo spazio <ArrowRight />
            </Link>
          </Button>
          <Button variant="secondary" size="lg" asChild>
            <Link href="/login">Ho già un account</Link>
          </Button>
        </div>

        <section className="mt-14 grid gap-4 sm:grid-cols-3">
          <Feature
            icon={<Sparkles className="size-5" />}
            title="Cattura in tre secondi"
            body="Una casella, nessun campo obbligatorio. Il testo originale resta intatto per sempre."
          />
          <Feature
            icon={<Layers className="size-5" />}
            title="Idea → Progetto"
            body="L'AI propone una struttura. Tu approvi sezione per sezione, o rifiuti tutto."
          />
          <Feature
            icon={<GitBranch className="size-5" />}
            title="Mappa che lavora"
            body="I nodi sono cose vere: modifichi la mappa e cambia il progetto."
          />
        </section>
      </main>
    </div>
  );
}

function Feature({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="surface-card p-5">
      <span className="flex size-9 items-center justify-center rounded-[10px] bg-brand-50 text-brand-600 dark:bg-brand-900/40 dark:text-brand-200">
        {icon}
      </span>
      <h2 className="mt-3 font-display text-sm font-semibold">{title}</h2>
      <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}
