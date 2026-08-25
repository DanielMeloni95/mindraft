import { z } from "zod";

/**
 * Environment access in one place.
 *
 * Nothing here throws at import time: a freshly cloned repository without
 * a .env.local must still boot and show the setup screen instead of a
 * stack trace. Server-only secrets are read lazily and never leak into a
 * client bundle (they are not prefixed with NEXT_PUBLIC_ and this module
 * only touches them inside server-side functions).
 */

const publicSchema = z.object({
  supabaseUrl: z.string().url().optional(),
  supabaseAnonKey: z.string().min(20).optional(),
  siteUrl: z.string().url(),
});

function readSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) {
    const normalized = /^https?:\/\//i.test(explicit)
      ? explicit
      : `https://${explicit}`;
    const parsed = z.string().url().safeParse(normalized.replace(/\/$/, ""));
    if (parsed.success) return parsed.data;
  }
  if (process.env.NEXT_PUBLIC_VERCEL_URL) {
    return `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`;
  }
  return "http://localhost:3000";
}

const parsedUrl = z.string().url().safeParse(process.env.NEXT_PUBLIC_SUPABASE_URL);
const parsedKey = z.string().min(20).safeParse(
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);

export const publicEnv = publicSchema.parse({
  supabaseUrl: parsedUrl.success ? parsedUrl.data : undefined,
  supabaseAnonKey: parsedKey.success ? parsedKey.data : undefined,
  siteUrl: readSiteUrl(),
});

/** True when both Supabase public credentials are present and well formed. */
export const isSupabaseConfigured =
  Boolean(publicEnv.supabaseUrl) && Boolean(publicEnv.supabaseAnonKey);

export function requireSupabasePublicEnv(): {
  url: string;
  anonKey: string;
} {
  if (!publicEnv.supabaseUrl || !publicEnv.supabaseAnonKey) {
    throw new Error(
      "Supabase non è configurato: imposta NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local",
    );
  }
  return { url: publicEnv.supabaseUrl, anonKey: publicEnv.supabaseAnonKey };
}

/* ------------------------------------------------------------------ */
/* Server-only                                                         */
/* ------------------------------------------------------------------ */

export type AiProviderName = "mock" | "openai";

export function getAiConfig(): {
  provider: AiProviderName;
  apiKey: string | null;
  model: string;
  baseUrl: string | null;
  timeoutMs: number;
} {
  const explicit = process.env.AI_PROVIDER as AiProviderName | undefined;
  const apiKey = process.env.OPENAI_API_KEY ?? null;
  // Without a key the mock provider is used. It is a real, deterministic
  // implementation — not a fake success — so every AI flow stays testable.
  const provider: AiProviderName =
    explicit === "openai" || (!explicit && apiKey) ? "openai" : "mock";

  return {
    provider: provider === "openai" && !apiKey ? "mock" : provider,
    apiKey,
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    baseUrl: process.env.OPENAI_BASE_URL ?? null,
    timeoutMs: Number(process.env.AI_TIMEOUT_MS ?? 45_000),
  };
}

export function getServiceRoleKey(): string | null {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ?? null;
}

export function getStripeConfig(): {
  enabled: boolean;
  secretKey: string | null;
  webhookSecret: string | null;
  prices: Record<string, string | undefined>;
} {
  const secretKey = process.env.STRIPE_SECRET_KEY ?? null;
  return {
    enabled: Boolean(secretKey),
    secretKey,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? null,
    prices: {
      personal: process.env.STRIPE_PRICE_PERSONAL,
      pro: process.env.STRIPE_PRICE_PRO,
    },
  };
}

export const isProduction = process.env.NODE_ENV === "production";
export const isTestEnv =
  process.env.NODE_ENV === "test" || process.env.MINDRAFT_E2E === "1";
