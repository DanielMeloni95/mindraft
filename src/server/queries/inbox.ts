import "server-only";

import type { Supabase } from "@/lib/supabase/server";
import type { InboxItemRow, InboxStatus } from "@/types/database";

export type InboxListFilters = {
  status?: InboxStatus | "all";
  projectId?: string | null;
  search?: string;
  limit?: number;
  cursor?: string | null;
};

export type InboxItemWithProject = InboxItemRow & {
  project: { id: string; name: string; emoji: string | null } | null;
};

export async function listInboxItems(
  supabase: Supabase,
  workspaceId: string,
  filters: InboxListFilters = {},
): Promise<{ items: InboxItemWithProject[]; nextCursor: string | null }> {
  const limit = Math.min(filters.limit ?? 30, 100);

  let query = supabase
    .from("inbox_items")
    .select("*, project:projects(id, name, emoji)")
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit + 1);

  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }
  if (filters.projectId) {
    query = query.eq("project_id", filters.projectId);
  }
  if (filters.search && filters.search.trim().length > 1) {
    query = query.ilike("content", `%${filters.search.trim()}%`);
  }
  if (filters.cursor) {
    query = query.lt("created_at", filters.cursor);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Inbox non disponibile: ${error.message}`);

  const rows = (data ?? []) as unknown as InboxItemWithProject[];
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;

  return {
    items,
    nextCursor: hasMore ? items[items.length - 1]?.created_at ?? null : null,
  };
}

export async function countUnprocessed(
  supabase: Supabase,
  workspaceId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("inbox_items")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("status", "unprocessed")
    .is("deleted_at", null);

  if (error) return 0;
  return count ?? 0;
}
