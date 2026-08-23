import { completeOnboarding, expect, test } from "./fixtures";

/**
 * Mobile is for capture, reading and small updates. These checks make
 * sure the three things that matter there actually work — and that the
 * page never scrolls sideways.
 */
test.describe("comportamento su smartphone", () => {
  test("la bottom navigation e la cattura rapida sono raggiungibili", async ({ page }) => {
    await completeOnboarding(page);
    await page.goto("/home");

    const nav = page.getByRole("navigation", { name: "Navigazione" });
    await expect(nav).toBeVisible();
    await expect(nav.getByRole("link", { name: "Inbox" })).toBeVisible();

    // The desktop sidebar must not be rendered here.
    await expect(page.getByRole("complementary", { name: "Navigazione principale" })).toBeHidden();

    await page.getByRole("button", { name: "Cattura rapida" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    await dialog
      .getByPlaceholder("Scrivi ciò che hai in mente…")
      .fill("Pensiero catturato dal telefono.");
    await dialog.getByRole("button", { name: "Cattura", exact: true }).click();

    await page.goto("/inbox");
    await expect(page.getByText("Pensiero catturato dal telefono.")).toBeVisible();
  });

  test("nessuno scorrimento orizzontale nelle schermate principali", async ({ page }) => {
    await completeOnboarding(page);

    for (const path of ["/home", "/inbox", "/ideas", "/projects", "/tasks"]) {
      await page.goto(path);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `scorrimento orizzontale su ${path}`).toBeLessThanOrEqual(1);
    }
  });
});
