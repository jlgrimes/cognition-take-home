import { describe, expect, it } from "vitest";
import { freshEnv } from "./helpers";
import { can } from "@/platform/auth";
import { listAudit, writeAudit } from "@/platform/audit";

describe("platform: audit log", () => {
  it("is append-only at the database level", () => {
    const { db } = freshEnv();
    writeAudit(db, { actorId: "u_gus", app: "test", action: "x", entityType: "t", entityId: "1" });
    expect(() => db.prepare("UPDATE audit_log SET action = 'tampered'").run()).toThrow(/append-only/);
    expect(() => db.prepare("DELETE FROM audit_log").run()).toThrow(/append-only/);
    expect(listAudit(db)[0].action).toBe("x");
  });
});

describe("platform: RBAC", () => {
  it("derives permissions from roles contributed by each app", () => {
    const { as } = freshEnv();
    expect(can(as("u_ana"), "kyc.decide")).toBe(true);
    expect(can(as("u_ana"), "refunds.view")).toBe(false);
    expect(can(as("u_dev"), "kyc.view")).toBe(false);
    expect(can(as("u_fay"), "refunds.approve")).toBe(true);
    expect(can(as("u_gus"), "audit.view")).toBe(true);
    expect(can(as("u_gus"), "kyc.decide")).toBe(false);
  });
});
