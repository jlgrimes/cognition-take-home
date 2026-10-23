import { describe, expect, it } from "vitest";
import { createTestEnv } from "@internal/platform/testing";
import { flagsModule } from "./module";
import { bucket, evaluateFlag, evaluateFlags } from "./evaluate";
import { approveChange, proposeProdChange, updateNonProd } from "./service";

const freshEnv = () => createTestEnv([flagsModule]);
const merchants = Array.from({ length: 2000 }, (_, i) => `acct_m${i.toString().padStart(5, "0")}`);

describe("Feature flags: evaluation", () => {
  it("is off when disabled, even for targeted merchants", () => {
    expect(evaluateFlag("f", { enabled: false, rollout_pct: 100, targets: ["acct_1F9xQ2"] }, "acct_1F9xQ2")).toEqual({ enabled: false, reason: "disabled" });
  });

  it("turns targeted merchants on at 0% rollout", () => {
    expect(evaluateFlag("f", { enabled: true, rollout_pct: 0, targets: ["acct_1F9xQ2"] }, "acct_1F9xQ2")).toEqual({ enabled: true, reason: "targeted" });
  });

  it("puts roughly rollout% of merchants in, and keeps them in as the % grows", () => {
    const on = (pct: number) => new Set(merchants.filter((m) => evaluateFlag("new_checkout", { enabled: true, rollout_pct: pct, targets: [] }, m).enabled));
    const at10 = on(10);
    const at50 = on(50);
    expect(at10.size / merchants.length).toBeGreaterThan(0.07);
    expect(at10.size / merchants.length).toBeLessThan(0.13);
    expect([...at10].every((m) => at50.has(m))).toBe(true);
    expect(on(0).size).toBe(0);
    expect(on(100).size).toBe(merchants.length);
  });

  it("buckets per flag, so the same merchants aren't always first in", () => {
    const same = merchants.filter((m) => (bucket("a", m) < 10) === (bucket("b", m) < 10)).length;
    expect(same).toBeLessThan(merchants.length);
  });

  it("reads the seeded per-environment state", () => {
    const { db } = freshEnv();
    const [prod] = evaluateFlags(db, { env: "prod", merchantId: "acct_1F9xQ2", key: "instant_payouts" });
    expect(prod).toMatchObject({ enabled: true, reason: "targeted" });
    const [dev] = evaluateFlags(db, { env: "prod", merchantId: "acct_any123", key: "same_day_ach" });
    expect(dev).toMatchObject({ enabled: false, reason: "disabled" });
    expect(evaluateFlags(db, { env: "staging", merchantId: "acct_any123" }).length).toBeGreaterThan(1);
  });

  it("reflects a staging edit immediately, and a prod change only after approval", () => {
    const { db, as } = freshEnv();
    const m = "acct_any123";
    updateNonProd(db, as("u_hana"), { key: "same_day_ach", env: "staging", state: { enabled: true, rollout_pct: 100, targets: [] } });
    expect(evaluateFlags(db, { env: "staging", merchantId: m, key: "same_day_ach" })[0].enabled).toBe(true);
    const cr = proposeProdChange(db, as("u_hana"), { key: "same_day_ach", state: { enabled: true, rollout_pct: 100, targets: [] }, reason: "launch" });
    expect(evaluateFlags(db, { env: "prod", merchantId: m, key: "same_day_ach" })[0].enabled).toBe(false);
    approveChange(db, as("u_ivan"), cr.id, cr.version);
    expect(evaluateFlags(db, { env: "prod", merchantId: m, key: "same_day_ach" })[0].enabled).toBe(true);
  });

  it("rejects bad input", () => {
    const { db } = freshEnv();
    expect(() => evaluateFlags(db, { env: "qa", merchantId: "acct_any123" })).toThrow(/env must be/);
    expect(() => evaluateFlags(db, { env: "prod", merchantId: "bob" })).toThrow(/merchant/);
    expect(() => evaluateFlags(db, { env: "prod", merchantId: "acct_any123", key: "nope" })).toThrow(/not found/);
  });
});
