import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = fs.readFileSync(path.resolve("supabase/migrations/0017_ai_credit_lifecycle.sql"), "utf8");
const runner = fs.readFileSync(path.resolve("src/lib/ai/index.ts"), "utf8");

describe("ciclo crediti AI v1.1", () => {
  it("serializza le prenotazioni mensili e impedisce doppie riserve", () => {
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("usage_ledger_idempotent_state_idx");
    expect(migration).toMatch(/state='reserved'/);
  });

  it("mantiene il ledger append-only usando una compensazione negativa", () => {
    expect(migration).toContain("event_amount := -abs(p_amount)");
    expect(migration).not.toMatch(/update public\.usage_ledger/i);
  });

  it("registra versioni, hash e configurazione senza prompt completi", () => {
    expect(runner).toContain("prompt_template_version");
    expect(runner).toContain("schema_version");
    expect(runner).toContain("input_hash");
    expect(runner).toContain("output_hash");
    expect(runner).not.toMatch(/prompt:\s*(system|user)/);
  });

  it("consuma sul successo e rimborsa il fallimento", () => {
    expect(runner).toContain('p_outcome:"consumed"');
    expect(runner).toContain('p_outcome:"refunded"');
  });
});
