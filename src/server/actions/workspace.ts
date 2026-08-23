"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { deriveTitle } from "@/lib/utils";
import {
  feedbackSchema,
  onboardingSchema,
  savedViewSchema,
  weeklyReviewSchema,
} from "@/lib/validation/schemas";
import { fail, guard, ok, parseInput, type ActionResult } from "@/server/action-result";
import { requireWriteSession } from "@/server/session";
import type { Json } from "@/types/database";

export async function completeOnboardingAction(
  input: unknown,
): Promise<ActionResult<{ ideaId: string | null }>> {
  return guard(async () => {
    const parsed = parseInput(onboardingSchema, input);
    if (!parsed.ok) return parsed.result;

    const session = await requireWriteSession();
    const d = parsed.data;

    const { error } = await session.supabase
      .from("profiles")
      .update({
        full_name: d.fullName,
        primary_use: d.primaryUse ?? null,
        focus_areas: d.focusAreas,
        guidance_level: d.guidanceLevel,
        onboarding_completed_at: new Date().toISOString(),
        onboarding_step: 5,
      })
      .eq("id", session.userId);

    if (error) return fail(`Profilo non salvato: ${error.message}`);

    let ideaId: string | null = null;
    if (d.firstIdea && d.firstIdea.trim().length > 3) {
      const { data } = await session.supabase
        .from("ideas")
        .insert({
          workspace_id: session.workspace.id,
          created_by: session.userId,
          title: deriveTitle(d.firstIdea),
          original_content: d.firstIdea.trim(),
          status: "to_explore",
        })
        .select("id")
        .single();
      ideaId = data?.id ?? null;
    }

    revalidatePath("/", "layout");
    return ok({ ideaId });
  });
}

export async function saveOnboardingStepAction(step: number): Promise<ActionResult<undefined>> {
  return guard(async () => {
    const session = await requireWriteSession();
    await session.supabase
      .from("profiles")
      .update({ onboarding_step: Math.max(0, Math.min(9, Math.trunc(step))) })
      .eq("id", session.userId);
    return ok();
  });
}

export async function skipOnboardingAction(): Promise<void> {
  const session = await requireWriteSession();
  await session.supabase
    .from("profiles")
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq("id", session.userId);
  revalidatePath("/", "layout");
  redirect("/home");
}

export async function seedDemoWorkspaceAction(): Promise<ActionResult<{ workspaceId: string }>> {
  return guard(async () => {
    const session = await requireWriteSession();
    const { data, error } = await session.supabase.rpc("seed_demo_workspace");
    if (error || !data) return fail(`Spazio dimostrativo non creato: ${error?.message}`);

    revalidatePath("/", "layout");
    return ok({ workspaceId: data });
  });
}

export async function removeDemoWorkspaceAction(): Promise<ActionResult<undefined>> {
  return guard(async () => {
    const session = await requireWriteSession();
    const { error } = await session.supabase.rpc("remove_demo_workspace");
    if (error) return fail(`Rimozione non riuscita: ${error.message}`);
    revalidatePath("/", "layout");
    return ok();
  });
}

export async function updateDashboardModulesAction(
  modules: Record<string, boolean>,
): Promise<ActionResult<undefined>> {
  return guard(async () => {
    const session = await requireWriteSession();
    const clean = Object.fromEntries(
      Object.entries(modules)
        .slice(0, 20)
        .map(([key, value]) => [key.slice(0, 40), Boolean(value)]),
    );

    const { error } = await session.supabase
      .from("profiles")
      .update({ dashboard_modules: clean as unknown as Json })
      .eq("id", session.userId);

    if (error) return fail(`Preferenze non salvate: ${error.message}`);
    revalidatePath("/home");
    return ok();
  });
}

export async function updateProfileAction(
  input: { fullName?: string; guidanceLevel?: "minimal" | "balanced" | "guided" },
): Promise<ActionResult<undefined>> {
  return guard(async () => {
    const session = await requireWriteSession();
    const name = input.fullName?.trim();
    if (name !== undefined && (name.length < 1 || name.length > 80)) {
      return fail("Il nome deve avere da 1 a 80 caratteri.");
    }
    const payload = {
      ...(name !== undefined ? { full_name: name } : {}),
      ...(input.guidanceLevel ? { guidance_level: input.guidanceLevel } : {}),
    };
    if (Object.keys(payload).length === 0) return ok();

    const { error } = await session.supabase
      .from("profiles")
      .update(payload)
      .eq("id", session.userId);

    if (error) return fail(`Profilo non salvato: ${error.message}`);
    revalidatePath("/settings");
    revalidatePath("/", "layout");
    return ok();
  });
}

export async function saveWeeklyReviewAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return guard(async () => {
    const parsed = parseInput(weeklyReviewSchema, input);
    if (!parsed.ok) return parsed.result;

    const session = await requireWriteSession();
    const { data, error } = await session.supabase
      .from("weekly_reviews")
      .upsert(
        {
          workspace_id: session.workspace.id,
          user_id: session.userId,
          week_start: parsed.data.weekStart,
          summary: parsed.data.summary,
          focus_items: parsed.data.focusItems as unknown as Json,
          completed_at: new Date().toISOString(),
        },
        { onConflict: "workspace_id,user_id,week_start" },
      )
      .select("id")
      .single();

    if (error || !data) return fail(`Revisione non salvata: ${error?.message}`);

    revalidatePath("/review");
    revalidatePath("/home");
    return ok({ id: data.id });
  });
}

export async function saveViewAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return guard(async () => {
    const parsed = parseInput(savedViewSchema, input);
    if (!parsed.ok) return parsed.result;

    const session = await requireWriteSession();
    const { data, error } = await session.supabase
      .from("saved_views")
      .upsert(
        {
          workspace_id: session.workspace.id,
          user_id: session.userId,
          scope: parsed.data.scope,
          name: parsed.data.name,
          filters: parsed.data.filters as unknown as Json,
        },
        { onConflict: "workspace_id,user_id,scope,name" },
      )
      .select("id")
      .single();

    if (error || !data) return fail(`Vista non salvata: ${error?.message}`);
    revalidatePath("/ideas");
    revalidatePath("/tasks");
    return ok({ id: data.id });
  });
}

export async function deleteSavedViewAction(id: string): Promise<ActionResult<undefined>> {
  return guard(async () => {
    const session = await requireWriteSession();
    const { error } = await session.supabase
      .from("saved_views")
      .delete()
      .eq("id", id)
      .eq("user_id", session.userId);
    if (error) return fail(`Vista non eliminata: ${error.message}`);
    revalidatePath("/ideas");
    return ok();
  });
}

export async function sendFeedbackAction(input: unknown): Promise<ActionResult<undefined>> {
  return guard(async () => {
    const parsed = parseInput(feedbackSchema, input);
    if (!parsed.ok) return parsed.result;

    const session = await requireWriteSession();
    const { error } = await session.supabase.from("feedback").insert({
      workspace_id: session.workspace.id,
      user_id: session.userId,
      kind: parsed.data.kind,
      message: parsed.data.message,
    });

    if (error) return fail(`Feedback non inviato: ${error.message}`);
    return ok();
  });
}
