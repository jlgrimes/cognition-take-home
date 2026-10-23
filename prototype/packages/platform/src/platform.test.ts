import { describe, expect, it } from "vitest";
import { createTestEnv } from "./testing";
import { can } from "./auth";
import { listAudit, writeAudit } from "./audit";
import type { AppModule } from "./types";

const demoApp: AppModule = {
  id: "demo", name: "Demo", description: "", href: "/demo", navPermission: "demo.view",
  roles: { kyc_analyst: ["demo.view"], finance_manager: ["demo.view", "demo.approve"] },
  migrate() {}, seed() {},
};

describe("platform: audit log", () => {
  it("is append-only at the database level", () => {
    const { db } = createTestEnv([]);
    writeAudit(db, { actorId: "u_gus", app: "test", action: "x", entityType: "t", entityId: "1" });
    expect(() => db.prepare("UPDATE audit_log SET action = 'tampered'").run()).toThrow(/append-only/);
    expect(() => db.prepare("DELETE FROM audit_log").run()).toThrow(/append-only/);
    expect(listAudit(db)[0].action).toBe("x");
  });
});

describe("platform: RBAC", () => {
  it("derives permissions from roles contributed by each app", () => {
    const { as } = createTestEnv([demoApp]);
    expect(can(as("u_ana"), "demo.view")).toBe(true);
    expect(can(as("u_ana"), "demo.approve")).toBe(false);
    expect(can(as("u_dev"), "demo.view")).toBe(false);
    expect(can(as("u_fay"), "demo.approve")).toBe(true);
    expect(can(as("u_gus"), "audit.view")).toBe(true);
  });
});
