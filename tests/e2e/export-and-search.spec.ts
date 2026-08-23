import { completeOnboarding, expect, test } from "./fixtures";

test.describe("ricerca ed esportazione", () => {
  test("la ricerca trova ciò che l'utente ha scritto", async ({ page }) => {
    await completeOnboarding(
      page,
      "Un cruscotto che ordina le idee per impatto e fattibilità, con parola chiave zafferano.",
    );

    await page.goto("/search?q=zafferano");
    await expect(page.getByRole("link", { name: /cruscotto/i }).first()).toBeVisible({
      timeout: 20_000,
    });

    await page.goto("/search?q=parolachenonesistemai");
    await expect(page.getByText(/Nessun risultato/)).toBeVisible();
  });

  test("l'esportazione JSON restituisce i contenuti con le relazioni", async ({ page }) => {
    await completeOnboarding(page, "Idea da esportare, con la parola pistacchio.");

    const response = await page.request.get("/api/export?format=json");
    expect(response.ok()).toBe(true);

    const payload = (await response.json()) as {
      ideas: Array<{ original_content: string }>;
      workspace: { id: string };
    };

    expect(payload.workspace.id).toBeTruthy();
    expect(
      payload.ideas.some((idea) => idea.original_content.includes("pistacchio")),
    ).toBe(true);
  });

  test("l'esportazione Markdown è leggibile", async ({ page }) => {
    await completeOnboarding(page, "Idea da esportare in markdown, parola cardamomo.");

    const response = await page.request.get("/api/export?format=markdown");
    expect(response.ok()).toBe(true);

    const markdown = await response.text();
    expect(markdown).toContain("# Mindraft");
    expect(markdown).toContain("cardamomo");
  });

  test("la command palette apre la ricerca con ⌘K", async ({ page }) => {
    await completeOnboarding(page);

    await page.goto("/home");
    await page.keyboard.press("Control+k");
    await expect(page.getByPlaceholder("Cerca o vai a…")).toBeVisible();

    await page.getByPlaceholder("Cerca o vai a…").fill("Progetti");
    await page.getByRole("option", { name: "Progetti" }).first().click();
    await page.waitForURL(/\/projects/);
  });
});
