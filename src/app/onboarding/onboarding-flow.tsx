"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Logo } from "@/components/common/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  completeOnboardingAction,
  saveOnboardingStepAction,
  skipOnboardingAction,
} from "@/server/actions/workspace";

const FOCUS_AREAS = [
  "Lavoro",
  "Studio",
  "Startup",
  "Contenuti",
  "Progetti personali",
  "Altro",
];

const GUIDANCE = [
  { value: "minimal", label: "Poca guida", hint: "So già cosa voglio fare." },
  { value: "balanced", label: "Guida equilibrata", hint: "Suggerimenti quando servono." },
  { value: "guided", label: "Guida attiva", hint: "Accompagnami passo per passo." },
] as const;

const STEPS = 4;

/**
 * Four screens, skippable, resumable. No tooltip tour: the last step is
 * a real capture that ends up in the real Inbox.
 */
export function OnboardingFlow({
  defaultName,
  startStep,
}: {
  defaultName: string;
  startStep: number;
}) {
  const router = useRouter();
  const [step, setStep] = React.useState(Math.min(startStep, STEPS - 1));
  const [fullName, setFullName] = React.useState(defaultName);
  const [primaryUse, setPrimaryUse] = React.useState("");
  const [focusAreas, setFocusAreas] = React.useState<string[]>([]);
  const [guidanceLevel, setGuidanceLevel] =
    React.useState<(typeof GUIDANCE)[number]["value"]>("balanced");
  const [firstIdea, setFirstIdea] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  const goTo = (next: number) => {
    setStep(next);
    void saveOnboardingStepAction(next);
  };

  const finish = () => {
    startTransition(async () => {
      const result = await completeOnboardingAction({
        fullName: fullName.trim(),
        primaryUse: primaryUse.trim() || undefined,
        focusAreas,
        guidanceLevel,
        firstIdea: firstIdea.trim() || undefined,
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      if (result.data.ideaId) {
        router.push(`/ideas/${result.data.ideaId}?welcome=1`);
      } else {
        router.push("/home");
      }
    });
  };

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <span className="flex items-center gap-2">
          <Logo />
          <span className="font-display text-[15px] font-semibold">Mindraft</span>
        </span>
        <form action={skipOnboardingAction}>
          <Button type="submit" variant="ghost" size="sm">
            Salta
          </Button>
        </form>
      </div>

      <div className="mb-6 flex gap-1.5" aria-hidden>
        {Array.from({ length: STEPS }).map((_, index) => (
          <span
            key={index}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors",
              index <= step ? "bg-primary" : "bg-border",
            )}
          />
        ))}
      </div>
      <p className="sr-only" aria-live="polite">
        Passo {step + 1} di {STEPS}
      </p>

      {step === 0 && (
        <section className="space-y-5">
          <Header
            title="Come ti chiamiamo?"
            body="Serve solo per parlarti come una persona, non come un sistema."
          />
          <div className="space-y-1.5">
            <Label htmlFor="fullName">Nome</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              autoFocus
              placeholder="Daniel"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="primaryUse">A cosa ti serve, in una riga?</Label>
            <Input
              id="primaryUse"
              value={primaryUse}
              onChange={(event) => setPrimaryUse(event.target.value)}
              placeholder="Portare avanti i miei progetti senza perderli per strada"
            />
          </div>
        </section>
      )}

      {step === 1 && (
        <section className="space-y-5">
          <Header
            title="Di cosa ti occupi?"
            body="Puoi sceglierne più di uno. Serve a decidere cosa mostrarti per primo."
          />
          <div className="flex flex-wrap gap-2">
            {FOCUS_AREAS.map((area) => {
              const selected = focusAreas.includes(area);
              return (
                <button
                  key={area}
                  type="button"
                  aria-pressed={selected}
                  onClick={() =>
                    setFocusAreas((current) =>
                      current.includes(area)
                        ? current.filter((a) => a !== area)
                        : [...current, area],
                    )
                  }
                  className={cn(
                    "rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors",
                    selected
                      ? "border-primary bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-100"
                      : "border-border bg-surface text-muted-foreground hover:border-border-strong",
                  )}
                >
                  {selected && <Check className="mr-1 inline size-3.5" aria-hidden />}
                  {area}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="space-y-5">
          <Header
            title="Quanta guida vuoi?"
            body="Puoi cambiarlo quando vuoi dalle impostazioni."
          />
          <div className="space-y-2">
            {GUIDANCE.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={guidanceLevel === option.value}
                onClick={() => setGuidanceLevel(option.value)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-[var(--radius-lg)] border p-3.5 text-left transition-colors",
                  guidanceLevel === option.value
                    ? "border-primary bg-brand-50 dark:bg-brand-900/30"
                    : "border-border bg-surface hover:border-border-strong",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
                    guidanceLevel === option.value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border-strong",
                  )}
                  aria-hidden
                >
                  {guidanceLevel === option.value && <Check className="size-3" />}
                </span>
                <span>
                  <span className="block text-[13px] font-medium text-foreground">
                    {option.label}
                  </span>
                  <span className="block text-[12px] text-muted-foreground">{option.hint}</span>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="space-y-5">
          <Header
            title="Scrivi il primo pensiero"
            body="Una frase basta. Diventa un'idea vera, e da lì ti mostro come si trasforma in progetto."
          />
          <Textarea
            value={firstIdea}
            onChange={(event) => setFirstIdea(event.target.value)}
            rows={5}
            autoFocus
            placeholder="Vorrei un posto dove finiscono tutte le cose che mi vengono in mente mentre cammino…"
          />
          <p className="flex items-start gap-2 text-[12px] leading-relaxed text-muted-foreground">
            <Sparkles className="mt-0.5 size-3.5 shrink-0 text-accent-600" aria-hidden />
            Il testo che scrivi resta com&apos;è, per sempre. Le proposte dell&apos;AI
            vivono in campi separati e le approvi tu.
          </p>
        </section>
      )}

      <div className="mt-8 flex items-center justify-between gap-3">
        <Button
          variant="ghost"
          onClick={() => goTo(Math.max(0, step - 1))}
          disabled={step === 0 || pending}
        >
          <ArrowLeft /> Indietro
        </Button>

        {step < STEPS - 1 ? (
          <Button
            variant="primary"
            onClick={() => goTo(step + 1)}
            disabled={step === 0 && fullName.trim().length === 0}
          >
            Avanti <ArrowRight />
          </Button>
        ) : (
          <Button variant="primary" onClick={finish} loading={pending}>
            Entra in Mindraft <ArrowRight />
          </Button>
        )}
      </div>
    </div>
  );
}

function Header({ title, body }: { title: string; body: string }) {
  return (
    <div className="space-y-1">
      <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="text-[13px] leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}
