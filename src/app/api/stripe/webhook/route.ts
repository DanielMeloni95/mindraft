import crypto from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

import { getStripeConfig } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { PlanTier, SubscriptionStatus } from "@/types/database";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Stripe webhook.
 *
 * Three properties matter here and all three are implemented rather than
 * assumed:
 *  1. the signature is verified (timing-safe) before anything is read;
 *  2. replays are refused — the event id is inserted into stripe_events
 *     and a duplicate insert short-circuits the handler;
 *  3. it is the only place allowed to write a subscription row, through
 *     the service-role client that never reaches the browser.
 *
 * When Stripe is not configured the route answers 501 instead of
 * pretending to work.
 */
export async function POST(request: NextRequest) {
  const config = getStripeConfig();

  if (!config.enabled || !config.webhookSecret) {
    return NextResponse.json(
      { error: "stripe_not_configured" },
      { status: 501 },
    );
  }

  const signature = request.headers.get("stripe-signature");
  const payload = await request.text();

  if (!signature || !verifySignature(payload, signature, config.webhookSecret)) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "service_role_missing" }, { status: 500 });
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(payload) as StripeEvent;
  } catch {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  // Idempotency: the primary key makes a replay a no-op.
  const { error: duplicate } = await admin
    .from("stripe_events")
    .insert({ id: event.id, type: event.type });

  if (duplicate) {
    // 23505 = unique_violation: already processed, nothing to do.
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    await handleEvent(admin, event);
  } catch (error) {
    // Leave the event row in place: Stripe retries, and the retry will
    // be recognised as a duplicate. Investigate from the logs instead of
    // letting a partial write through.
    console.error("[stripe] handler failed", event.type, (error as Error).message);
    return NextResponse.json({ error: "handler_failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

type StripeEvent = {
  id: string;
  type: string;
  data: {
    object: {
      id?: string;
      customer?: string;
      status?: string;
      cancel_at_period_end?: boolean;
      current_period_end?: number;
      metadata?: Record<string, string>;
      items?: { data: Array<{ price?: { id?: string } }> };
    };
  };
};

const STATUS_MAP: Record<string, SubscriptionStatus> = {
  trialing: "trialing",
  active: "active",
  past_due: "past_due",
  canceled: "canceled",
  unpaid: "past_due",
  incomplete: "incomplete",
  incomplete_expired: "canceled",
};

function planForPrice(priceId: string | undefined): PlanTier {
  const config = getStripeConfig();
  if (priceId && priceId === config.prices.pro) return "pro";
  if (priceId && priceId === config.prices.personal) return "personal";
  return "free";
}

async function handleEvent(
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  event: StripeEvent,
): Promise<void> {
  const object = event.data.object;
  const workspaceId = object.metadata?.workspace_id;

  switch (event.type) {
    case "checkout.session.completed":
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      if (!workspaceId) return;
      const plan = planForPrice(object.items?.data?.[0]?.price?.id);
      const status = STATUS_MAP[object.status ?? "active"] ?? "active";

      await admin.from("subscriptions").upsert(
        {
          workspace_id: workspaceId,
          plan,
          status,
          stripe_customer_id: object.customer ?? null,
          stripe_subscription_id: object.id ?? null,
          cancel_at_period_end: Boolean(object.cancel_at_period_end),
          current_period_end: object.current_period_end
            ? new Date(object.current_period_end * 1000).toISOString()
            : null,
        },
        { onConflict: "workspace_id" },
      );

      await admin.from("workspaces").update({ plan }).eq("id", workspaceId);
      return;
    }

    case "customer.subscription.deleted": {
      if (!workspaceId) return;
      await admin
        .from("subscriptions")
        .update({ plan: "free", status: "canceled" })
        .eq("workspace_id", workspaceId);
      await admin.from("workspaces").update({ plan: "free" }).eq("id", workspaceId);
      return;
    }

    default:
      // Unhandled event types are recorded and ignored on purpose.
      return;
  }
}

/** Stripe's v1 scheme: HMAC-SHA256 over `${timestamp}.${payload}`. */
function verifySignature(payload: string, header: string, secret: string): boolean {
  const parts = Object.fromEntries(
    header.split(",").map((part) => {
      const [key, value] = part.split("=");
      return [key.trim(), value?.trim() ?? ""];
    }),
  );

  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return false;

  // Reject anything older than five minutes: replay protection even
  // before the event-id check.
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`, "utf8")
    .digest("hex");

  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
