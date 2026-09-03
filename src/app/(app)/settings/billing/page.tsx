import Link from "next/link";
import { Check } from "lucide-react";

import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { BillingActions, CustomerPortalButton } from "@/components/settings/billing-actions";
import { PLANS } from "@/lib/domain/plans";
import { getStripeConfig } from "@/lib/env";
import { requireSession } from "@/server/session";

export const metadata = { title: "Piano e utilizzo" };

export default async function BillingPage() {
  const session = await requireSession();
  const stripe = getStripeConfig();
  const plan = PLANS[session.plan];
  const { data: subscription } = await session.supabase.from("subscriptions").select("stripe_customer_id,status,current_period_end,cancel_at_period_end").eq("workspace_id",session.workspace.id).maybeSingle();
  const canManage = session.role === "owner" || session.role === "admin";

  const [{ count: projectCount }, { count: ideaCount }] = await Promise.all([
    session.supabase
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", session.workspace.id)
      .is("deleted_at", null)
      .neq("status", "archived"),
    session.supabase
      .from("ideas")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", session.workspace.id)
      .is("deleted_at", null),
  ]);

  const usage = [
    {
      label: "Crediti AI questo mese",
      used: session.aiCreditsUsed,
      limit: plan.limits.aiCreditsPerMonth,
    },
    { label: "Progetti attivi", used: projectCount ?? 0, limit: plan.limits.projects },
    { label: "Idee", used: ideaCount ?? 0, limit: plan.limits.ideas },
  ];

  return (
    <>
      <PageHeader
        title="Piano e utilizzo"
        description={`Sei sul piano ${plan.name}. I limiti sono applicati lato server, non solo nell'interfaccia.`}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Utilizzo</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-4">
              {usage.map((row) => {
                const unlimited = row.limit < 0;
                const percent = unlimited ? 0 : Math.min(100, (row.used / Math.max(1, row.limit)) * 100);
                return (
                  <li key={row.label}>
                    <div className="flex items-center justify-between text-[13px]">
                      <span>{row.label}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {row.used}/{unlimited ? "∞" : row.limit}
                      </span>
                    </div>
                    <Progress value={percent} className="mt-1.5" label={row.label} />
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Piani</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-4">
              {Object.values(PLANS).map((option) => (
                <li key={option.tier} className="rounded-[var(--radius-lg)] border border-border p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-display text-sm font-semibold">{option.name}</span>
                    <span className="text-[13px] text-muted-foreground">
                      {option.priceMonthly === null
                        ? "in arrivo"
                        : option.priceMonthly === 0
                          ? "gratuito"
                          : `${option.priceMonthly} €/mese`}
                    </span>
                  </div>
                  <p className="mt-1 text-[12px] text-muted-foreground">{option.description}</p>
                  <ul className="mt-2 space-y-1">
                    {option.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-1.5 text-[12px]">
                        <Check className="mt-0.5 size-3 shrink-0 text-accent-600" aria-hidden />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  {option.tier === session.plan && (
                    <p className="mt-2 text-[12px] font-medium text-primary">Piano attuale</p>
                  )}
                  <BillingActions plan={option.tier} currentPlan={session.plan} hasCustomer={Boolean(subscription?.stripe_customer_id)} enabled={stripe.enabled && Boolean(stripe.prices[option.tier])} canManage={canManage} />
                </li>
              ))}
            </ul>

            <div className="mt-4 rounded-[var(--radius-md)] bg-surface-muted p-3 text-[12px] leading-relaxed text-muted-foreground">
              {stripe.enabled ? (
                <>I pagamenti sono attivi. Il cambio piano avviene tramite Stripe Checkout.</>
              ) : (
                <>
                  Stripe non è configurato in questo ambiente, quindi il cambio piano è
                  disattivato: preferiamo un pulsante assente a un pulsante che finge di
                  funzionare. Per attivarlo imposta <code>STRIPE_SECRET_KEY</code> e le
                  variabili dei prezzi.
                </>
              )}
            </div>

            {subscription?.stripe_customer_id && <div className="mt-3 space-y-2 rounded-[var(--radius-md)] border border-border p-3 text-[12px] text-muted-foreground">
              <p>Abbonamento Stripe: <strong className="text-foreground">{subscription.status}</strong>{subscription.current_period_end ? ` · rinnovo ${new Date(subscription.current_period_end).toLocaleDateString("it-IT")}` : ""}{subscription.cancel_at_period_end ? " · cancellazione programmata" : ""}</p>
              <CustomerPortalButton enabled={stripe.enabled} canManage={canManage} />
            </div>}

            <Button variant="ghost" size="sm" className="mt-3" asChild>
              <Link href="/settings/data">Esporta i tuoi dati</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
