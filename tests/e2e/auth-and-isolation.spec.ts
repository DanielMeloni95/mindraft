import {
  completeOnboarding,
  expect,
  newAccount,
  signUp,
  test,
} from "./fixtures";

test.describe("autenticazione e isolamento", () => {
  test("registrazione, logout e nuovo accesso", async ({ page, account }) => {
    await completeOnboarding(page);
    await expect(page).toHaveURL(/\/home/);

    await page.getByLabel("Menu profilo").click();
    await page.getByRole("button", { name: "Esci" }).click();
    await page.waitForURL(/\/login/);

    // The private area is not reachable once signed out.
    await page.goto("/home");
    await page.waitForURL(/\/login/);

    await page.getByLabel("Email").fill(account.email);
    await page.getByLabel("Password").fill(account.password);
    await page.getByRole("button", { name: "Accedi" }).click();
    await page.waitForURL(/\/home/, { timeout: 30_000 });
  });

  test("due account non vedono i dati l'uno dell'altro", async ({ page, browser }) => {
    // First account creates content.
    await completeOnboarding(page, "Idea riservata del primo account.");
    await page.waitForURL(/\/ideas\/[0-9a-f-]{36}/);
    const privateIdeaUrl = page.url();

    // Second account, separate browser context.
    const context = await browser.newContext();
    const other = await context.newPage();
    const secondAccount = newAccount("e2e-b");
    await signUp(other, secondAccount);
    await completeOnboarding(other);

    await other.goto("/ideas");
    await expect(other.getByText("Idea riservata del primo account.")).toHaveCount(0);

    // Direct access by URL is refused by RLS, not just by the interface.
    await other.goto(privateIdeaUrl);
    await expect(other.getByText(/404|non trovat/i).first()).toBeVisible({
      timeout: 15_000,
    });

    await context.close();
  });

  test("credenziali errate mostrano un messaggio comprensibile", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("nessuno@mindraft.test");
    await page.getByLabel("Password").fill("passwordSbagliata1");
    await page.getByRole("button", { name: "Accedi" }).click();

    await expect(page.getByRole("alert")).toContainText(/non corretti|Email o password/i);
  });
});
