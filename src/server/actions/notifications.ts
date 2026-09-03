"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { fail, guard, ok, parseInput, type ActionResult } from "@/server/action-result";
import { requireSession } from "@/server/session";

export async function markNotificationReadAction(id: string): Promise<ActionResult> {
  return guard(async () => {
    const parsed = parseInput(z.string().uuid(), id);
    if (!parsed.ok) return parsed.result;
    const session = await requireSession();
    const { error } = await session.supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", parsed.data)
      .eq("user_id", session.userId);
    if (error) return fail(error.message);
    revalidatePath("/notifications");
    revalidatePath("/home", "layout");
    return ok();
  });
}

export async function markAllNotificationsReadAction(): Promise<ActionResult> {
  return guard(async () => {
    const session = await requireSession();
    const { error } = await session.supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", session.userId)
      .eq("workspace_id", session.workspace.id)
      .is("read_at", null);
    if (error) return fail(error.message);
    revalidatePath("/notifications");
    revalidatePath("/home", "layout");
    return ok();
  });
}
