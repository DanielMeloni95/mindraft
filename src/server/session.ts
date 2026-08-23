import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import { createSupabaseServerClient, type Supabase } from "@/lib/supabase/server";
import { PLANS } from "@/lib/domain/plans";
import type {
  PlanTier,
  ProfileRow,
  WorkspaceRole,
  WorkspaceRow,
} from "@/types/database";

export type SessionContext = {
  supabase: Supabase;
  userId: string;
  email: string | null;
  profile: ProfileRow | null;
  workspace: WorkspaceRow;
  workspaces: Array<Pick<WorkspaceRow, "id" | "name" | "slug" | "is_personal">>;
  role: WorkspaceRole;
  plan: PlanTier;
  canWrite: boolean;
  aiCreditsUsed: number;
  aiCreditsLimit: number;
};

const WORKSPACE_COOKIE = "mindraft.workspace";

/**
 * Loads everything a private page needs, once per request.
 *
 * Note that this is convenience, not security: each of the queries below
 * already runs under RLS as the signed-in user, and every mutation
 * re-checks the role server-side.
 */
export const getSessionContext = cache(async (): Promise<SessionContext | null> => {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // Repairs accounts created before the trigger, no-op otherwise.
  const { data: workspaceId } = await supabase.rpc("ensure_workspace");

  const [{ data: profile }, { data: memberships }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase
      .from("workspace_members")
      .select("role, workspace:workspaces(id, name, slug, is_personal, plan, owner_id, settings, created_at, updated_at, deleted_at)")
      .eq("user_id", user.id),
  ]);

  type MembershipRow = {
    role: WorkspaceRole;
    workspace: WorkspaceRow | null;
  };

  const rows = ((memberships ?? []) as unknown as MembershipRow[]).filter(
    (m): m is MembershipRow & { workspace: WorkspaceRow } =>
      Boolean(m.workspace) && m.workspace?.deleted_at === null,
  );

  if (rows.length === 0) return null;

  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  const preferred = cookieStore.get(WORKSPACE_COOKIE)?.value;

  const active =
    rows.find((m) => m.workspace.id === preferred) ??
    rows.find((m) => m.workspace.id === workspaceId) ??
    rows.find((m) => m.workspace.is_personal) ??
    rows[0];

  const plan = active.workspace.plan;

  const { data: usage } = await supabase
    .from("usage_ledger")
    .select("amount")
    .eq("workspace_id", active.workspace.id)
    .eq("kind", "ai_credits")
    .gte("occurred_at", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString());

  const aiCreditsUsed = (usage ?? []).reduce((sum, row) => sum + row.amount, 0);

  return {
    supabase,
    userId: user.id,
    email: user.email ?? null,
    profile: profile ?? null,
    workspace: active.workspace,
    workspaces: rows.map((m) => ({
      id: m.workspace.id,
      name: m.workspace.name,
      slug: m.workspace.slug,
      is_personal: m.workspace.is_personal,
    })),
    role: active.role,
    plan,
    canWrite: active.role === "owner" || active.role === "admin" || active.role === "editor",
    aiCreditsUsed,
    aiCreditsLimit: PLANS[plan].limits.aiCreditsPerMonth,
  };
});

/** For pages: redirects to /login when there is no session. */
export async function requireSession(): Promise<SessionContext> {
  const session = await getSessionContext();
  if (!session) redirect("/login");
  return session;
}

/** For server actions: throws instead of redirecting. */
export async function requireWriteSession(): Promise<SessionContext> {
  const session = await getSessionContext();
  if (!session) throw new Error("Sessione scaduta. Accedi di nuovo.");
  if (!session.canWrite) {
    throw new Error("Il tuo ruolo in questo spazio non consente modifiche.");
  }
  return session;
}

export { WORKSPACE_COOKIE };
