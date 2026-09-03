"use server";

import { z } from "zod";

import { getStripeConfig, publicEnv } from "@/lib/env";
import { fail, guard, ok, parseInput, type ActionResult } from "@/server/action-result";
import { requireWriteSession } from "@/server/session";

const paidPlan = z.enum(["personal", "pro"]);

async function stripePost(path: string, values: URLSearchParams, idempotencyKey: string) {
  const config = getStripeConfig();
  if (!config.enabled || !config.secretKey) throw new Error("Stripe non è configurato.");
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${config.secretKey}:`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Idempotency-Key": idempotencyKey,
    },
    body: values,
    cache: "no-store",
  });
  const payload = await response.json() as { url?: string; error?: { message?: string } };
  if (!response.ok || !payload.url) throw new Error(payload.error?.message ?? "Stripe non ha restituito un collegamento valido.");
  return payload.url;
}

function requireBillingRole(role: string): ActionResult<never> | null {
  return role === "owner" || role === "admin" ? null : fail("Solo Owner e Admin possono gestire l'abbonamento.");
}

export async function createCheckoutSessionAction(input: unknown): Promise<ActionResult<{ url: string }>> {
  return guard(async () => {
    const parsed = parseInput(paidPlan, input); if (!parsed.ok) return parsed.result;
    const session = await requireWriteSession(); const denied = requireBillingRole(session.role); if (denied) return denied;
    if (session.plan === parsed.data) return fail("Questo è già il piano attivo.");
    const config = getStripeConfig(); const price = config.prices[parsed.data];
    if (!price) return fail(`Prezzo Stripe del piano ${parsed.data} non configurato.`);
    const { data: subscription } = await session.supabase.from("subscriptions").select("stripe_customer_id").eq("workspace_id",session.workspace.id).maybeSingle();
    const values = new URLSearchParams({
      mode:"subscription", "line_items[0][price]":price, "line_items[0][quantity]":"1",
      success_url:`${publicEnv.siteUrl}/settings/billing?checkout=success`, cancel_url:`${publicEnv.siteUrl}/settings/billing?checkout=cancelled`,
      client_reference_id:session.workspace.id, "metadata[workspace_id]":session.workspace.id,
      "subscription_data[metadata][workspace_id]":session.workspace.id,
      allow_promotion_codes:"true",
    });
    if (session.email) values.set("customer_email",session.email);
    if (subscription?.stripe_customer_id) { values.delete("customer_email"); values.set("customer",subscription.stripe_customer_id); }
    const url = await stripePost("checkout/sessions", values, `checkout:${session.workspace.id}:${parsed.data}:${Date.now()}`);
    return ok({ url });
  });
}

export async function createCustomerPortalAction(): Promise<ActionResult<{ url: string }>> {
  return guard(async () => {
    const session = await requireWriteSession(); const denied = requireBillingRole(session.role); if (denied) return denied;
    const { data: subscription } = await session.supabase.from("subscriptions").select("stripe_customer_id").eq("workspace_id",session.workspace.id).maybeSingle();
    if (!subscription?.stripe_customer_id) return fail("Nessun cliente Stripe collegato a questo workspace.");
    const values = new URLSearchParams({ customer:subscription.stripe_customer_id, return_url:`${publicEnv.siteUrl}/settings/billing` });
    return ok({ url:await stripePost("billing_portal/sessions",values,`portal:${session.workspace.id}:${Date.now()}`) });
  });
}

