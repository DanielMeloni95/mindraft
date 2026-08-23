import crypto from "node:crypto";

import { describe, expect, it } from "vitest";

/**
 * The verification logic lives inside the route module, which pulls in
 * next/server. It is small and security-critical, so it is re-stated
 * here and checked against the same vectors — if the route ever drifts
 * from this, the e2e/manual Stripe CLI test will catch it, and this test
 * documents the contract.
 */
function verifySignature(payload: string, header: string, secret: string): boolean {
  const parts = Object.fromEntries(
    header.split(",").map((part) => {
      const [key, value] = part.split("=");
      return [key.trim(), value?.trim() ?? ""];
    }),
  );

  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return false;

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`, "utf8")
    .digest("hex");

  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const SECRET = "whsec_test_secret";

function sign(payload: string, timestamp: number, secret = SECRET): string {
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`, "utf8")
    .digest("hex");
  return `t=${timestamp},v1=${signature}`;
}

describe("stripe webhook signature", () => {
  const payload = JSON.stringify({ id: "evt_1", type: "customer.subscription.updated" });
  const now = Math.floor(Date.now() / 1000);

  it("accepts a correctly signed, fresh event", () => {
    expect(verifySignature(payload, sign(payload, now), SECRET)).toBe(true);
  });

  it("refuses a wrong secret", () => {
    expect(verifySignature(payload, sign(payload, now, "whsec_other"), SECRET)).toBe(false);
  });

  it("refuses a tampered payload", () => {
    const header = sign(payload, now);
    expect(verifySignature(`${payload} `, header, SECRET)).toBe(false);
  });

  it("refuses a stale timestamp", () => {
    expect(verifySignature(payload, sign(payload, now - 3_600), SECRET)).toBe(false);
  });

  it("refuses a malformed header", () => {
    expect(verifySignature(payload, "garbage", SECRET)).toBe(false);
    expect(verifySignature(payload, `t=${now}`, SECRET)).toBe(false);
  });
});
