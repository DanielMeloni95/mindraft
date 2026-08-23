"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { publicEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { credentialsSchema, signUpSchema } from "@/lib/validation/schemas";
import { fail, guard, ok, parseInput, type ActionResult } from "@/server/action-result";
import { WORKSPACE_COOKIE } from "@/server/session";

function friendlyAuthError(message: string): string {
  const normalized = message.toLowerCase();
  if (normalized.includes("invalid login credentials")) {
    return "Email o password non corretti.";
  }
  if (normalized.includes("already registered")) {
    return "Esiste già un account con questa email.";
  }
  if (normalized.includes("email not confirmed")) {
    return "Devi confermare l'email prima di accedere.";
  }
  if (normalized.includes("rate limit")) {
    return "Troppi tentativi ravvicinati. Riprova fra poco.";
  }
  return message;
}

export async function signInAction(
  _prev: ActionResult<undefined> | null,
  formData: FormData,
): Promise<ActionResult<undefined>> {
  return guard(async () => {
    const parsed = parseInput(credentialsSchema, {
      email: formData.get("email"),
      password: formData.get("password"),
    });
    if (!parsed.ok) return parsed.result;

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    if (error) return fail(friendlyAuthError(error.message));

    const next = String(formData.get("next") ?? "/home");
    // Only same-origin relative paths: never redirect to a supplied host.
    const target = next.startsWith("/") && !next.startsWith("//") ? next : "/home";
    revalidatePath("/", "layout");
    redirect(target);
  });
}

export async function signUpAction(
  _prev: ActionResult<{ needsConfirmation: boolean }> | null,
  formData: FormData,
): Promise<ActionResult<{ needsConfirmation: boolean }>> {
  return guard(async () => {
    const parsed = parseInput(signUpSchema, {
      email: formData.get("email"),
      password: formData.get("password"),
      fullName: formData.get("fullName"),
    });
    if (!parsed.ok) return parsed.result;

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        data: { full_name: parsed.data.fullName },
        emailRedirectTo: `${publicEnv.siteUrl}/auth/callback?next=/onboarding`,
      },
    });

    if (error) return fail(friendlyAuthError(error.message));

    // With email confirmation on, there is no session yet.
    if (!data.session) return ok({ needsConfirmation: true });

    revalidatePath("/", "layout");
    redirect("/onboarding");
  });
}

export async function signOutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  const cookieStore = await cookies();
  cookieStore.delete(WORKSPACE_COOKIE);
  revalidatePath("/", "layout");
  redirect("/login");
}

export async function requestPasswordResetAction(
  _prev: ActionResult<{ sent: boolean }> | null,
  formData: FormData,
): Promise<ActionResult<{ sent: boolean }>> {
  return guard(async () => {
    const email = String(formData.get("email") ?? "").trim();
    if (!email.includes("@")) return fail("Indirizzo email non valido.");

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${publicEnv.siteUrl}/auth/callback?next=/reset-password`,
    });
    if (error) return fail(friendlyAuthError(error.message));

    // Deliberately identical answer whether or not the address exists.
    return ok({ sent: true });
  });
}

export async function updatePasswordAction(
  _prev: ActionResult<undefined> | null,
  formData: FormData,
): Promise<ActionResult<undefined>> {
  return guard(async () => {
    const password = String(formData.get("password") ?? "");
    if (password.length < 8) return fail("La password deve avere almeno 8 caratteri.");

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return fail(friendlyAuthError(error.message));

    revalidatePath("/", "layout");
    redirect("/home");
  });
}

export async function switchWorkspaceAction(workspaceId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (data) {
    const cookieStore = await cookies();
    cookieStore.set(WORKSPACE_COOKIE, workspaceId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  revalidatePath("/", "layout");
  redirect("/home");
}
