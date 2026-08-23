import "server-only";

import type { Supabase } from "@/lib/supabase/server";
import type { EntityType } from "@/types/database";

/**
 * Append-only trail behind the "Cronologia" tab and the continuity
 * features. Failures here must never break the user's action, so the
 * error is swallowed after being logged.
 */
export async function logActivity(
  supabase: Supabase,
  params: {
    workspaceId: string;
    actorId: string;
    action: string;
    entityType: EntityType;
    entityId: string;
    summary?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  const { error } = await supabase.from("activity_log").insert({
    workspace_id: params.workspaceId,
    actor_id: params.actorId,
    action: params.action,
    entity_type: params.entityType,
    entity_id: params.entityId,
    summary: params.summary ?? null,
    metadata: (params.metadata ?? {}) as never,
  });

  if (error && process.env.NODE_ENV !== "test") {
    console.warn("[activity]", error.message);
  }
}

export async function touchProject(
  supabase: Supabase,
  projectId: string,
): Promise<void> {
  await supabase
    .from("projects")
    .update({ last_activity_at: new Date().toISOString() })
    .eq("id", projectId);
}
