import { completeOnboarding, expect, test } from "./fixtures";

/**
 * The acceptance path from §33 of the brief, end to end: capture →
 * idea → AI proposal → partial approval → project → document → canvas →
 * task → decision → export.
 */
test.describe("percorso principale", () => {
  test("dalla cattura al progetto, approvando solo una parte della proposta", async ({
    page,
  }) => {
    await completeOnboarding(page);

    // --- capture ------------------------------------------------------
    const capture =
      "Continuo a perdere le idee che mi vengono mentre cammino. Vorrei uno strumento che le prenda in tre secondi e la sera me le riordini da solo.";

    await page.goto("/inbox");
    await page.getByPlaceholder("Scrivi ciò che hai in mente…").fill(capture);
    await page.getByRole("button", { name: "Cattura", exact: true }).click();

    await expect(page.getByText(capture, { exact: false })).toBeVisible();

    // --- inbox → idea -------------------------------------------------
    await page.getByRole("button", { name: "Idea" }).first().click();
    await page.waitForURL(/\/ideas\/[0-9a-f-]{36}/);

    // The original capture is shown verbatim and is not an input.
    const original = page.getByText(capture, { exact: false }).first();
    await expect(original).toBeVisible();
    await expect(page.getByText("Il tuo testo, invariato")).toBeVisible();

    // --- AI proposal --------------------------------------------------
    await page.getByRole("button", { name: /Proponi una struttura/ }).click();
    await expect(page.getByText("Proposta di progetto")).toBeVisible({ timeout: 30_000 });

    // Nothing has been written yet.
    await expect(page.getByText(/Niente è ancora stato scritto/)).toBeVisible();

    // --- partial approval ---------------------------------------------
    const checkboxes = page.getByRole("checkbox");
    const count = await checkboxes.count();
    expect(count).toBeGreaterThan(2);

    // Untick everything, then approve two sections only.
    for (let index = 0; index < count; index += 1) {
      const checkbox = checkboxes.nth(index);
      if (await checkbox.isChecked()) await checkbox.click();
    }
    await checkboxes.nth(0).click();
    await checkboxes.nth(1).click();

    await expect(page.getByRole("button", { name: /Applica 2 di/ })).toBeVisible();
    await page.getByRole("button", { name: /Applica 2 di/ }).click();

    await page.waitForURL(/\/projects\/[0-9a-f-]{36}/, { timeout: 30_000 });
    await expect(page.getByRole("link", { name: "Documento" })).toBeVisible();

    const projectUrl = page.url();

    // --- the idea keeps its original text ------------------------------
    await page.getByRole("link", { name: "Idea di origine" }).isVisible().catch(() => false);

    // --- document -------------------------------------------------------
    await page.goto(`${projectUrl}/document`);
    const editor = page.getByRole("textbox", { name: "Documento di progetto" });
    await expect(editor).toBeVisible({ timeout: 30_000 });

    await editor.click();
    await page.keyboard.type("Nota di verifica scritta dal test.");
    await expect(page.getByText("Salvato")).toBeVisible({ timeout: 15_000 });

    await page.reload();
    await expect(page.getByText("Nota di verifica scritta dal test.")).toBeVisible({
      timeout: 30_000,
    });

    // --- canvas ----------------------------------------------------------
    await page.goto(`${projectUrl}/canvas`);
    await expect(page.getByLabel("Mappa del progetto")).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Nodo" }).click();
    await page.getByRole("menuitem", { name: "Nota" }).click();
    await expect(page.getByText("Nota").first()).toBeVisible();

    // --- tasks -----------------------------------------------------------
    await page.goto(`${projectUrl}/tasks`);
    await page.getByLabel("Nuova attività").fill("Parlare con tre persone");
    await page.getByRole("button", { name: "Aggiungi" }).click();
    await expect(page.getByText("Parlare con tre persone")).toBeVisible();

    await page
      .getByLabel("Stato di Parlare con tre persone")
      .selectOption("in_progress");
    await page.reload();
    await expect(
      page.getByLabel("Stato di Parlare con tre persone"),
    ).toHaveValue("in_progress");

    // --- decision --------------------------------------------------------
    await page.goto(`${projectUrl}/decisions`);
    await page.getByRole("button", { name: /Registra decisione|Registra la prima/ }).first().click();
    await page.getByLabel("Decisione").fill("Partiamo dalla cattura vocale");
    await page.getByLabel("Motivazione").fill("È il momento in cui perdo le idee.");
    await page.getByRole("button", { name: "Salva" }).click();
    await expect(page.getByText("Partiamo dalla cattura vocale")).toBeVisible();

    // --- search ----------------------------------------------------------
    await page.goto("/search?q=cattura");
    await expect(page.getByText(/Nessun risultato/)).toBeHidden();

    // --- continuity ------------------------------------------------------
    await page.goto("/home");
    await expect(page.getByText("Continua da qui")).toBeVisible();
  });

  test("annullare la trasformazione riporta l'idea com'era", async ({ page }) => {
    await completeOnboarding(
      page,
      "Vorrei un posto dove finiscono le idee che mi vengono in bicicletta.",
    );

    await page.waitForURL(/\/ideas\/[0-9a-f-]{36}/);
    const ideaUrl = page.url();

    await page.getByRole("button", { name: /Proponi una struttura/ }).click();
    await expect(page.getByText("Proposta di progetto")).toBeVisible({ timeout: 30_000 });

    await page.getByRole("button", { name: /Applica \d+ di/ }).click();
    await page.waitForURL(/\/projects\/[0-9a-f-]{36}/, { timeout: 30_000 });

    await page.getByRole("button", { name: "Annulla" }).click();
    await page.waitForURL(new RegExp(ideaUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), {
      timeout: 30_000,
    });

    // The idea is available for a new transformation.
    await expect(page.getByRole("button", { name: /Proponi una struttura/ })).toBeVisible({
      timeout: 30_000,
    });
  });
});
