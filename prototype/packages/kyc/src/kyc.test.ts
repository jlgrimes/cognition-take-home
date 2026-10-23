import { describe, expect, it } from "vitest";
import { createTestEnv } from "@internal/platform/testing";
import { kycModule } from "./module";

const freshEnv = () => createTestEnv([kycModule]);
import { applyTransition, availableTransitions } from "@internal/platform/workflow";
import { kycWorkflow, HIGH_RISK, type KycCase } from "./workflow";
import { getCase, listCases } from "./data";
import { listAudit } from "@internal/platform/audit";
import { PolicyError } from "@internal/platform/types";

const pick = (db: ReturnType<typeof freshEnv>["db"], highRisk: boolean) =>
  db.prepare(`SELECT * FROM kyc_cases WHERE status='pending' AND risk_score ${highRisk ? ">=" : "<"} ? LIMIT 1`).get(HIGH_RISK) as KycCase;

describe("KYC workflow", () => {
  it("lets only one analyst claim a case (optimistic concurrency)", () => {
    const { db, as } = freshEnv();
    const c = pick(db, false);
    applyTransition(db, kycWorkflow, { id: c.id, transitionId: "claim", user: as("u_ana"), expectedVersion: c.version });
    expect(() =>
      applyTransition(db, kycWorkflow, { id: c.id, transitionId: "claim", user: as("u_ben"), expectedVersion: c.version }),
    ).toThrow(PolicyError);
  });

  it("only the assignee can decide, and decisions are audited", () => {
    const { db, as } = freshEnv();
    const c = pick(db, false);
    applyTransition(db, kycWorkflow, { id: c.id, transitionId: "claim", user: as("u_ana") });
    expect(() => applyTransition(db, kycWorkflow, { id: c.id, transitionId: "approve", user: as("u_ben") })).toThrow(/assigned analyst/);
    const after = applyTransition(db, kycWorkflow, { id: c.id, transitionId: "approve", user: as("u_ana") });
    expect(after.status).toBe("approved");
    const log = listAudit(db, { entityType: "kyc_case", entityId: c.id });
    expect(log.map((l) => l.action)).toEqual(["kyc_case.approve", "kyc_case.claim"]);
    expect(JSON.parse(log[0].after_json!)).toMatchObject({ status: "approved", decided_by: "u_ana" });
  });

  it("forces high-risk cases through escalation with four-eyes", () => {
    const { db, as } = freshEnv();
    const c = pick(db, true);
    applyTransition(db, kycWorkflow, { id: c.id, transitionId: "claim", user: as("u_cara") });
    expect(() => applyTransition(db, kycWorkflow, { id: c.id, transitionId: "approve", user: as("u_cara") })).toThrow(/escalated/);
    expect(() => applyTransition(db, kycWorkflow, { id: c.id, transitionId: "escalate", user: as("u_cara") })).toThrow(/reason/);
    applyTransition(db, kycWorkflow, { id: c.id, transitionId: "escalate", user: as("u_cara"), reason: "OFAC hit" });
    // Cara escalated it, so Cara can't also be the senior who approves it.
    expect(() =>
      applyTransition(db, kycWorkflow, { id: c.id, transitionId: "senior_approve", user: as("u_cara"), reason: "ok" }),
    ).toThrow(/Four-eyes/);
    // Plain analysts lack the permission entirely.
    expect(() =>
      applyTransition(db, kycWorkflow, { id: c.id, transitionId: "senior_approve", user: as("u_ana"), reason: "ok" }),
    ).toThrow(/permission/);
  });

  it("rejects transitions from the wrong state", () => {
    const { db, as } = freshEnv();
    const c = pick(db, false);
    expect(() => applyTransition(db, kycWorkflow, { id: c.id, transitionId: "approve", user: as("u_ana") })).toThrow(/pending/);
  });

  it("shows blocked actions with a reason rather than hiding them", () => {
    const { db, as } = freshEnv();
    const c = pick(db, true);
    const claimed = applyTransition(db, kycWorkflow, { id: c.id, transitionId: "claim", user: as("u_ana") });
    const approve = availableTransitions(kycWorkflow, claimed, as("u_ana")).find((t) => t.id === "approve");
    expect(approve?.blockedReason).toMatch(/escalated/);
  });
});

describe("KYC PII masking", () => {
  it("masks PII by default and audits every reveal", () => {
    const { db, as } = freshEnv();
    const id = listCases(db, as("u_ana"), {})[0].id;
    const masked = getCase(db, as("u_ana"), id)!;
    expect(masked.ssn).toMatch(/^•••-••-\d{4}$/);
    expect(masked._masked).toBe(true);
    expect(() => getCase(db, as("u_ana"), id, true)).toThrow(/may not reveal/);
    const revealed = getCase(db, as("u_cara"), id, true)!;
    expect(revealed.ssn).toMatch(/^\d{3}-\d{2}-\d{4}$/);
    expect(listAudit(db, { entityId: id })[0]).toMatchObject({ action: "pii.reveal", actor_id: "u_cara" });
  });

  it("never writes unrelated PII into the audit log", () => {
    const { db, as } = freshEnv();
    const c = pick(db, false);
    applyTransition(db, kycWorkflow, { id: c.id, transitionId: "claim", user: as("u_ana") });
    const row = listAudit(db, { entityId: c.id })[0];
    expect(`${row.before_json}${row.after_json}`).not.toContain(c.ssn);
  });

  it("blocks users without the app permission", () => {
    const { db, as } = freshEnv();
    expect(() => listCases(db, as("u_dev"), {})).toThrow(/kyc.view/);
  });
});
