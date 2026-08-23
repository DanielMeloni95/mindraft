import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import { requireSupabasePublicEnv } from "@/lib/env";
import type { Database } from "@/types/database";

export type Supabase = SupabaseClient<Database>;

/**
 * Request-scoped Supabase client. Reads and refreshes the auth cookies,
 * so every query it makes runs as the signed-in user and is filtered by
 * the RLS policies — the app never holds elevated privileges here.
 */
export async function createSupabaseServerClient(): Promise<Supabase> {
  // cookies() first: reading it marks the route dynamic, so a build
  // without Supabase credentials fails with the setup screen instead of
  // a prerender error.
  const cookieStore = await cookies();
  const { url, anonKey } = requireSupabasePublicEnv();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component: the middleware already
          // refreshed the session, so this is safe to ignore.
        }
      },
    },
  });
}
