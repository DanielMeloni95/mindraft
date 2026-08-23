import { NextResponse, type NextRequest } from "next/server";

import { searchWorkspace } from "@/server/queries/search";
import { getSessionContext } from "@/server/session";
import { checkRateLimit } from "@/server/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Used by the command palette. Returns only what the caller can see:
 * the query runs as the signed-in user and RLS does the filtering.
 */
export async function GET(request: NextRequest) {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const limiter = checkRateLimit(`${session.userId}:search`, {
    limit: 60,
    windowMs: 60_000,
  });
  if (!limiter.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(limiter.retryAfterSeconds) } },
    );
  }

  const query = request.nextUrl.searchParams.get("q") ?? "";
  const limit = Number(request.nextUrl.searchParams.get("limit") ?? 10);

  try {
    const results = await searchWorkspace(session.supabase, session.workspace.id, query, {
      limit: Number.isFinite(limit) ? Math.min(Math.max(1, limit), 25) : 10,
    });
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ error: "search_failed", results: [] }, { status: 500 });
  }
}
