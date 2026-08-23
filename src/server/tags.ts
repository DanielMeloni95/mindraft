import "server-only";

import type { Supabase } from "@/lib/supabase/server";
import type { EntityType } from "@/types/database";

/**
 * Tags are created on demand inside the workspace and linked through the
 * polymorphic bridge table. Kept out of the "use server" modules on
 * purpose: it takes a Supabase client, so it must not become a callable
 * server action endpoint.
 */
export async function attachTags(
  supabase: Supabase,
  workspaceId: string,
  entityType: EntityType,
  entityId: string,
  tagNames: string[],
): Promise<void> {
  const names = Array.from(new Set(tagNames.map((t) => t.trim()).filter(Boolean))).slice(0, 12);
  if (names.length === 0) return;

  const { data: existing } = await supabase
    .from("tags")
    .select("id, name")
    .eq("workspace_id", workspaceId)
    .in("name", names);

  const known = new Map((existing ?? []).map((t) => [t.name, t.id]));
  const missing = names.filter((n) => !known.has(n));

  if (missing.length > 0) {
    const { data: created } = await supabase
      .from("tags")
      .insert(missing.map((name) => ({ workspace_id: workspaceId, name })))
      .select("id, name");
    for (const tag of created ?? []) known.set(tag.name, tag.id);
  }

  const rows = names
    .map((name) => known.get(name))
    .filter((id): id is string => Boolean(id))
    .map((tagId) => ({
      workspace_id: workspaceId,
      tag_id: tagId,
      entity_type: entityType,
      entity_id: entityId,
    }));

  if (rows.length > 0) {
    await supabase.from("entity_tags").upsert(rows, {
      onConflict: "tag_id,entity_type,entity_id",
      ignoreDuplicates: true,
    });
  }
}

export async function listWorkspaceTags(
  supabase: Supabase,
  workspaceId: string,
): Promise<Array<{ id: string; name: string; color: string | null }>> {
  const { data } = await supabase
    .from("tags")
    .select("id, name, color")
    .eq("workspace_id", workspaceId)
    .order("name");
  return data ?? [];
}
