import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getServiceRoleKey, publicEnv } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Service-role client. It bypasses RLS, so it exists for exactly one
 * caller: the Stripe webhook, which has no user session and must update
 * a subscription row that end users are not allowed to write.
 *
 * It is never imported from a client component (the module is marked
 * server-only) and the key is never exposed to the browser.
 */
export function createSupabaseAdminClient(): SupabaseClient<Database> | null {
  const key = getServiceRoleKey();
  if (!key || !publicEnv.supabaseUrl) return null;

  return createClient<Database>(publicEnv.supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
