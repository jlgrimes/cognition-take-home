import { describe, expect, it } from "vitest";
import { createTestEnv } from "@internal/platform/testing";
import { flagsModule } from "./module";

const freshEnv = () => createTestEnv([flagsModule]);
import { applyTransition, availableTransitions } from "@internal/platform/workflow";
import { listAudit } from "@internal/platform/audit";
import { flagChangeWorkflow } from "./workflow";
import {
  approveChange, getFlag, listFlags, parseState, proposeProdChange, proposeRollback, updateNonProd,
} from "./service";

const state = (rollout_pct: number, enabled = true, targets: string[] = []) => ({ enabled, rollout_pct, targets });

describe("Feature flags: dev/staging", () => {
  it("lets an engineer change staging immediately and audits before/after", () => {
    const { db, as } = freshEnv();
    const before = getFlag(db, as("u_hana"), "new_checkout")!.envs.staging;
    const after = updateNonProd(db, as("u_hana"), { key: "new_checkout", env: "staging", state: state(80), expectedVersion: before.version });
    expect(after).toMatchObject({ enabled: true, rollout_pct: 80, version: before.version + 1 });
    const log = listAudit(db, { entityType: "flag", entityId: "new_checkout" })[0];
    expect(log).toMatchObject({ action: "flag.update_staging", actor_id: "u_hana" });
    expect(JSON.parse(log.before_json!)).toMatchObject({ "staging.rollout_pct": 50 });
    expect(JSON.parse(log.after_json!)).toMatchObject({ "staging.rollout_pct": 80 });
  });

  it("requires the engineer role to edit, even for approvers", () => {
    const { db, as } = freshEnv();
    expect(() => updateNonProd(db, as("u_gus"), { key: "new_checkout", env: "dev", state: state(0, false) })).toThrow(/flags.edit_nonprod/);
  });

  it("never lets a direct edit touch prod", () => {
    const { db, as } = freshEnv();
    expect(() => updateNonProd(db, as("u_hana"), { key: "new_checkout", env: "prod", state: state(100) })).toThrow(/change request/);
  });

  it("rejects stale edits (optimistic locking)", () => {
    const { db, as } = freshEnv();
    const v = getFlag(db, as("u_hana"), "same_day_ach")!.envs.dev.version;
    updateNonProd(db, as("u_hana"), { key: "same_day_ach", env: "dev", state: state(50), expectedVersion: v });
    expect(() => updateNonProd(db, as("u_ivan"), { key: "same_day_ach", env: "dev", state: state(0), expectedVersion: v })).toThrow(/changed by someone else/);
  });

  it("validates rollout % and merchant ids", () => {
    expect(() => parseState({ enabled: true, rolloutPct: 150, targets: "" })).toThrow(/0 to 100/);
    expect(() => parseState({ enabled: true, rolloutPct: 10, targets: "acct_1F9xQ2, drop table" })).toThrow(/not a merchant id/);
    expect(parseState({ enabled: true, rolloutPct: 10, targets: "acct_1F9xQ2,\nacct_1F9xQ2 acct_ZZZZ" }).targets).toEqual(["acct_1F9xQ2", "acct_ZZZZ"]);
  });

  it("hides the app from users without flags.view", () => {
    const { db, as } = freshEnv();
    expect(() => listFlags(db, as("u_ana"))).toThrow(/flags.view/);
  });
});

describe("Feature flags: prod change requests", () => {
  it("requires a reason and the engineer role to propose", () => {
    const { db, as } = freshEnv();
    expect(() => proposeProdChange(db, as("u_hana"), { key: "same_day_ach", state: state(10), reason: " " })).toThrow(/reason/);
    expect(() => proposeProdChange(db, as("u_gus"), { key: "same_day_ach", state: state(10), reason: "x" })).toThrow(/flags.propose_prod/);
  });

  it("does not change prod until approved, then applies it with an audit entry", () => {
    const { db, as } = freshEnv();
    const cr = proposeProdChange(db, as("u_hana"), { key: "same_day_ach", state: state(10), reason: "Pilot with 10% of Plus merchants" });
    expect(cr.status).toBe("pending_approval");
    expect(getFlag(db, as("u_hana"), "same_day_ach")!.envs.prod.enabled).toBe(false);
    const done = approveChange(db, as("u_gus"), cr.id, cr.version);
    expect(done).toMatchObject({ status: "applied", reviewed_by: "u_gus" });
    expect(getFlag(db, as("u_hana"), "same_day_ach")!.envs.prod).toMatchObject({ enabled: true, rollout_pct: 10 });
    const log = listAudit(db, { entityType: "flag", entityId: "same_day_ach" })[0];
    expect(log).toMatchObject({ action: "flag.update_prod", actor_id: "u_gus", reason: "Pilot with 10% of Plus merchants" });
    expect(JSON.parse(log.metadata_json!)).toMatchObject({ changeRequest: cr.id, requestedBy: "u_hana" });
    expect(listAudit(db, { entityType: "flag_change_request", entityId: cr.id }).map((l) => l.action)).toEqual([
      "flag_change_request.mark_applied", "flag_change_request.approve", "flag_change_request.propose",
    ]);
  });

  it("blocks self-approval even when the proposer holds flag_approver (maker-checker)", () => {
    const { db, as } = freshEnv();
    const cr = proposeProdChange(db, as("u_ivan"), { key: "same_day_ach", state: state(10), reason: "Pilot" });
    expect(() => approveChange(db, as("u_ivan"), cr.id)).toThrow(/Maker-checker/);
    expect(availableTransitions(flagChangeWorkflow, cr, as("u_ivan")).find((t) => t.id === "approve")?.blockedReason).toMatch(/Maker-checker/);
    expect(getFlag(db, as("u_ivan"), "same_day_ach")!.envs.prod.enabled).toBe(false);
  });

  it("requires flag_approver to approve", () => {
    const { db, as } = freshEnv();
    const cr = proposeProdChange(db, as("u_ivan"), { key: "same_day_ach", state: state(10), reason: "Pilot" });
    expect(() => approveChange(db, as("u_hana"), cr.id)).toThrow(/flags.approve/);
  });

  it("lets an approver reject with a reason and leaves prod unchanged", () => {
    const { db, as } = freshEnv();
    const cr = proposeProdChange(db, as("u_hana"), { key: "same_day_ach", state: state(10), reason: "Pilot" });
    expect(() => applyTransition(db, flagChangeWorkflow, { id: cr.id, transitionId: "reject", user: as("u_gus") })).toThrow(/requires a reason/);
    const r = applyTransition(db, flagChangeWorkflow, { id: cr.id, transitionId: "reject", user: as("u_gus"), reason: "Wait for bank cutoff fix" });
    expect(r).toMatchObject({ status: "rejected", reviewed_by: "u_gus" });
    expect(getFlag(db, as("u_hana"), "same_day_ach")!.envs.prod.enabled).toBe(false);
  });

  it("allows only one open request per flag", () => {
    const { db, as } = freshEnv();
    // new_checkout is seeded with a pending request (FC-1002).
    expect(() => proposeProdChange(db, as("u_ivan"), { key: "new_checkout", state: state(1), reason: "x" })).toThrow(/FC-1002/);
  });

  it("rolls back the last applied prod change via a new approved request", () => {
    const { db, as } = freshEnv();
    // Seeded FC-1001 took instant_payouts prod from 10% to 25%.
    expect(getFlag(db, as("u_hana"), "instant_payouts")!.envs.prod.rollout_pct).toBe(25);
    const rb = proposeRollback(db, as("u_hana"), { key: "instant_payouts" });
    expect(rb).toMatchObject({ kind: "rollback", rollback_of: "FC-1001", reason: "Roll back FC-1001", status: "pending_approval" });
    expect(getFlag(db, as("u_hana"), "instant_payouts")!.envs.prod.rollout_pct).toBe(25);
    approveChange(db, as("u_gus"), rb.id);
    expect(getFlag(db, as("u_hana"), "instant_payouts")!.envs.prod).toMatchObject({ rollout_pct: 10, targets: ["acct_1F9xQ2", "acct_7KpL0m"] });
  });

  it("refuses to apply a request if prod drifted since it was proposed", () => {
    const { db, as } = freshEnv();
    const cr = proposeProdChange(db, as("u_hana"), { key: "same_day_ach", state: state(10), reason: "Pilot" });
    db.prepare("UPDATE flag_envs SET rollout_pct = 99 WHERE flag_key = 'same_day_ach' AND env = 'prod'").run();
    expect(() => approveChange(db, as("u_gus"), cr.id)).toThrow(/Prod changed/);
    // The whole approval rolled back, so the request is still pending.
    expect(db.prepare("SELECT status FROM flag_change_requests WHERE id = ?").get(cr.id)).toEqual({ status: "pending_approval" });
  });
});
