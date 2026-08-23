import "server-only";

import type { Supabase } from "@/lib/supabase/server";
import type { EntityType, SearchResultRow } from "@/types/database";

export type SearchOptions = {
  types?: EntityType[] | null;
  limit?: number;
};

/**
 * Postgres full-text search, ranked and highlighted, executed through a
 * SECURITY INVOKER function so RLS still decides what is visible.
 *
 * The semantic layer (pgvector) is planned as a *complement*: a second
 * ranked list merged with this one, never a replacement — see the
 * backlog in README.
 */
export async function searchWorkspace(
  supabase: Supabase,
  workspaceId: string,
  query: string,
  options: SearchOptions = {},
): Promise<SearchResultRow[]> {
  const term = query.trim();
  if (term.length < 2) return [];

  const { data, error } = await supabase.rpc("search_workspace", {
    p_workspace_id: workspaceId,
    p_query: term,
    p_types: options.types ?? null,
    p_limit: options.limit ?? 40,
  });

  if (error) throw new Error(`Ricerca non disponibile: ${error.message}`);
  return (data ?? []) as SearchResultRow[];
}

export { hrefForResult } from "@/lib/search-href";
