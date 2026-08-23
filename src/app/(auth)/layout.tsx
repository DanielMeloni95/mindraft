import Link from "next/link";

import { Logo } from "@/components/common/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.1fr]">
      <div className="flex flex-col justify-center px-5 py-10 sm:px-10">
        <Link href="/" className="mb-8 flex items-center gap-2" aria-label="Mindraft">
          <Logo />
          <span className="font-display text-[15px] font-semibold">Mindraft</span>
        </Link>
        <main id="contenuto" className="w-full max-w-sm">
          {children}
        </main>
      </div>

      <aside className="hidden flex-col justify-center bg-ink-900 px-12 text-white lg:flex">
        <blockquote className="max-w-md">
          <p className="font-display text-2xl font-semibold leading-snug tracking-tight text-balance">
            «Avevo quaranta idee in tre app diverse. Il problema non era averle:
            era ricordarmi perché mi interessavano.»
          </p>
          <footer className="mt-4 text-[13px] text-white/60">
            Il motivo per cui esiste Mindraft
          </footer>
        </blockquote>

        <ul className="mt-10 space-y-3 text-[13px] text-white/70">
          <li>· Il testo che scrivi non viene mai riscritto da una macchina.</li>
          <li>· Ogni proposta dell&apos;AI si approva sezione per sezione.</li>
          <li>· I tuoi dati escono in Markdown e JSON quando vuoi.</li>
        </ul>
      </aside>
    </div>
  );
}
