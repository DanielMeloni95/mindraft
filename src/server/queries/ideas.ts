import "server-only";

import type { Supabase } from "@/lib/supabase/server";
import { computeScore, matrixPosition, type ScoreBreakdown } from "@/lib/domain/scoring";
import type {
  IdeaMaturity,
  IdeaRow,
  IdeaScoreRow,
  IdeaStatus,
} from "@/types/database";

export type IdeaFilters = {
  status?: IdeaStatus[] | null;
  maturity?: IdeaMaturity[] | null;
  category?: string | null;
  search?: string | null;
  favoritesOnly?: boolean;
  sort?: "recent" | "created" | "score" | "alpha";
  limit?: number;
  cursor?: string | null;
};

export type IdeaListItem = IdeaRow & {
  project: { id: string; name: string; emoji: string | null } | null;
  scores: Array<Pick<IdeaScoreRow, "criterion" | "value" | "weight">>;
  breakdown: ScoreBreakdown;
};

/**
 * The embed names the foreign key explicitly.
 *
 * `ideas` and `projects` are linked twice — `ideas.project_id` (the project
 * an idea belongs to) and `projects.source_idea_id` (the idea a project was
 * born from) — so PostgREST cannot guess which side to follow and refuses
 * the request. Here we want the first one.
 */
const LIST_SELECT =
  "*, project:projects!ideas_project_id_fkey(id, name, emoji), scores:idea_scores(criterion, value, weight)";

export async function listIdeas(
  supabase: Supabase,
  workspaceId: string,
  filters: IdeaFilters = {},
): Promise<{ items: IdeaListItem[]; nextCursor: string | null }> {
  const limit = Math.min(filters.limit ?? 40, 100);
  const sort = filters.sort ?? "recent";

  let query = supabase
    .from("ideas")
    .select(LIST_SELECT)
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .limit(limit + 1);

  if (filters.status && filters.status.length > 0) {
    query = query.in("status", filters.status);
  } else {
    query = query.neq("status", "archived");
  }
  if (filters.maturity && filters.maturity.length > 0) {
    query = query.in("maturity", filters.maturity);
  }
  if (filters.category) query = query.eq("category", filters.category);
  if (filters.favoritesOnly) query = query.eq("is_favorite", true);
  if (filters.search && filters.search.trim().length > 1) {
    const term = filters.search.trim();
    query = query.or(
      `title.ilike.%${term}%,original_content.ilike.%${term}%,summary.ilike.%${term}%`,
    );
  }

  if (sort === "alpha") {
    query = query.order("title", { ascending: true });
  } else if (sort === "created") {
    query = query.order("created_at", { ascending: false });
    if (filters.cursor) query = query.lt("created_at", filters.cursor);
  } else {
    query = query.order("updated_at", { ascending: false });
    if (filters.cursor) query = query.lt("updated_at", filters.cursor);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Idee non disponibili: ${error.message}`);

  type Raw = IdeaRow & {
    project: { id: string; name: string; emoji: string | null } | null;
    scores: Array<Pick<IdeaScoreRow, "criterion" | "value" | "weight">> | null;
  };

  let items: IdeaListItem[] = ((data ?? []) as unknown as Raw[]).map((row) => ({
    ...row,
    scores: row.scores ?? [],
    breakdown: computeScore(row.scores ?? []),
  }));

  // Score ordering happens here: it is derived, not stored, so that
  // changing a weight never requires a migration.
  if (sort === "score") {
    items = items.sort((a, b) => (b.breakdown.total ?? -1) - (a.breakdown.total ?? -1));
  }

  const hasMore = items.length > limit;
  const page = hasMore ? items.slice(0, limit) : items;
  const last = page[page.length - 1];

  return {
    items: page,
    nextCursor:
      hasMore && last ? (sort === "created" ? last.created_at : last.updated_at) : null,
  };
}

export type IdeaDetail = IdeaListItem & {
  matrix: ReturnType<typeof matrixPosition>;
  tags: Array<{ id: string; name: string; color: string | null }>;
  relatedIdeas: Array<{ id: string; title: string; relation: string }>;
  resources: Array<{ id: string; title: string; url: string | null; kind: string }>;
};

export async function getIdea(
  supabase: Supabase,
  workspaceId: string,
  ideaId: string,
): Promise<IdeaDetail | null> {
  const { data, error } = await supabase
    .from("ideas")
    .select(LIST_SELECT)
    .eq("workspace_id", workspaceId)
    .eq("id", ideaId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw new Error(`Idea non disponibile: ${error.message}`);
  if (!data) return null;

  const row = data as unknown as IdeaRow & {
    project: { id: string; name: string; emoji: string | null } | null;
    scores: Array<Pick<IdeaScoreRow, "criterion" | "value" | "weight">> | null;
  };

  const [{ data: tagRows }, { data: relations }, { data: resources }] = await Promise.all([
    supabase
      .from("entity_tags")
      .select("tag:tags(id, name, color)")
      .eq("entity_type", "idea")
      .eq("entity_id", ideaId),
    supabase
      .from("entity_relations")
      .select("relation, source_type, source_id, target_type, target_id")
      .eq("workspace_id", workspaceId)
      .or(`and(source_type.eq.idea,source_id.eq.${ideaId}),and(target_type.eq.idea,target_id.eq.${ideaId})`),
    supabase
      .from("resources")
      .select("id, title, url, kind")
      .eq("idea_id", ideaId)
      .is("deleted_at", null),
  ]);

  const otherIdeaIds: Array<{ id: string; relation: string }> = [];
  for (const relation of relations ?? []) {
    if (relation.source_type === "idea" && relation.source_id === ideaId) {
      if (relation.target_type === "idea") {
        otherIdeaIds.push({ id: relation.target_id, relation: relation.relation });
      }
    } else if (relation.target_type === "idea" && relation.target_id === ideaId) {
      if (relation.source_type === "idea") {
        otherIdeaIds.push({ id: relation.source_id, relation: relation.relation });
      }
    }
  }

  let relatedIdeas: Array<{ id: string; title: string; relation: string }> = [];
  if (otherIdeaIds.length > 0) {
    const { data: others } = await supabase
      .from("ideas")
      .select("id, title")
      .in("id", otherIdeaIds.map((o) => o.id));
    relatedIdeas = (others ?? []).map((o) => ({
      id: o.id,
      title: o.title,
      relation: otherIdeaIds.find((x) => x.id === o.id)?.relation ?? "relates_to",
    }));
  }

  const scores = row.scores ?? [];

  return {
    ...row,
    scores,
    breakdown: computeScore(scores),
    matrix: matrixPosition(scores),
    tags: ((tagRows ?? []) as unknown as Array<{ tag: { id: string; name: string; color: string | null } | null }>)
      .map((t) => t.tag)
      .filter((t): t is { id: string; name: string; color: string | null } => t !== null),
    relatedIdeas,
    resources: (resources ?? []) as Array<{ id: string; title: string; url: string | null; kind: string }>,
  };
}

export async function getIdeasByIds(
  supabase: Supabase,
  workspaceId: string,
  ids: string[],
): Promise<IdeaListItem[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("ideas")
    .select(LIST_SELECT)
    .eq("workspace_id", workspaceId)
    .in("id", ids)
    .is("deleted_at", null);

  if (error) throw new Error(`Idee non disponibili: ${error.message}`);

  type Raw = IdeaRow & {
    project: { id: string; name: string; emoji: string | null } | null;
    scores: Array<Pick<IdeaScoreRow, "criterion" | "value" | "weight">> | null;
  };

  return ((data ?? []) as unknown as Raw[]).map((row) => ({
    ...row,
    scores: row.scores ?? [],
    breakdown: computeScore(row.scores ?? []),
  }));
}

export async function ideaCounts(
  supabase: Supabase,
  workspaceId: string,
): Promise<Record<string, number>> {
  const { data } = await supabase
    .from("ideas")
    .select("status")
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null);

  return (data ?? []).reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = (acc[row.status] ?? 0) + 1;
    return acc;
  }, {});
}

export async function listCategories(
  supabase: Supabase,
  workspaceId: string,
): Promise<string[]> {
  const { data } = await supabase
    .from("ideas")
    .select("category")
    .eq("workspace_id", workspaceId)
    .not("category", "is", null)
    .is("deleted_at", null);

  return Array.from(
    new Set((data ?? []).map((r) => r.category).filter((c): c is string => Boolean(c))),
  ).sort();
}
