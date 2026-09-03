import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const actions = fs.readFileSync(path.resolve("src/server/actions/billing.ts"),"utf8");
const webhook = fs.readFileSync(path.resolve("src/app/api/stripe/webhook/route.ts"),"utf8");

describe("contratto Stripe", () => {
  it("lega checkout e subscription al workspace e usa URL di ritorno controllati", () => {
    expect(actions).toContain('"metadata[workspace_id]"');
    expect(actions).toContain('"subscription_data[metadata][workspace_id]"');
    expect(actions).toContain("publicEnv.siteUrl");
  });
  it("limita la gestione a owner e admin", () => {
    expect(actions).toContain('role === "owner" || role === "admin"');
  });
  it("rilascia l'evento quando il webhook fallisce così Stripe può ritentare", () => {
    expect(webhook).toContain('.delete().eq("id", event.id)');
  });
});
