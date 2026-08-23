"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import { requireSupabasePublicEnv } from "@/lib/env";
import type { Database } from "@/types/database";

let cached: SupabaseClient<Database> | null = null;

/** Browser client. Only ever sees the publishable anon key. */
export function createSupabaseBrowserClient(): SupabaseClient<Database> {
  if (cached) return cached;
  const { url, anonKey } = requireSupabasePublicEnv();
  cached = createBrowserClient<Database>(url, anonKey);
  return cached;
}
