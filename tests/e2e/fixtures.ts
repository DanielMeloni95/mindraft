import { test as base, expect, type Page } from "@playwright/test";

/**
 * Every spec runs as a brand-new account, so the tests never depend on
 * data left behind by an earlier run and RLS is exercised for real.
 *
 * Requirements on the Supabase project:
 *  - email confirmation disabled (Authentication → Providers → Email),
 *    otherwise sign-up cannot produce a session in a headless run;
 *  - the migrations in supabase/migrations applied.
 */

export const hasSupabase = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
    (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
);

export type TestAccount = { email: string; password: string; name: string };

export function newAccount(prefix = "e2e"): TestAccount {
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    email: `${prefix}-${unique}@mindraft.test`,
    password: "MindraftTest!2026",
    name: "Tester",
  };
}

export async function signUp(page: Page, account: TestAccount): Promise<void> {
  await page.goto("/signup");
  await page.getByLabel("Come ti chiami").fill(account.name);
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password").fill(account.password);
  await page.getByRole("button", { name: "Crea account" }).click();
  await page.waitForURL(/\/onboarding/, { timeout: 30_000 });
}

export async function completeOnboarding(page: Page, firstIdea?: string): Promise<void> {
  await page.getByRole("button", { name: "Avanti" }).click();
  await page.getByRole("button", { name: "Avanti" }).click();
  await page.getByRole("button", { name: "Avanti" }).click();

  if (firstIdea) {
    await page.getByRole("textbox").fill(firstIdea);
  }

  await page.getByRole("button", { name: /Entra in Mindraft/ }).click();
  await page.waitForURL(/\/(home|ideas)/, { timeout: 30_000 });
}

export const test = base.extend<{ account: TestAccount }>({
  account: async ({ page }, use) => {
    const account = newAccount();
    await signUp(page, account);
    await use(account);
  },
});

test.beforeAll(() => {
  test.skip(
    !hasSupabase,
    "Supabase non configurato: imposta NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY per eseguire i test end-to-end.",
  );
});

export { expect };
