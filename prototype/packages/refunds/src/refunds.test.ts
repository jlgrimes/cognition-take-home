import { describe, expect, it } from "vitest";
import { createTestEnv } from "@internal/platform/testing";
import { refundsModule } from "./module";
import { mockStripeSchema } from "@internal/platform/connectors/payments";

const freshEnv = () => createTestEnv([mockStripeSchema, refundsModule]);
import { approveRefund, requestRefund, executeRefund } from "./service";
import { applyTransition } from "@internal/platform/workflow";
import { refundWorkflow } from "./workflow";
import type { Charge } from "@internal/platform/connectors/payments";

const bigCharge = (db: ReturnType<typeof freshEnv>["db"]) =>
  db.prepare("SELECT * FROM mock_stripe_charges WHERE amount_refunded_cents = 0 AND amount_cents >= 49900 ORDER BY id DESC LIMIT 1").get() as Charge;

describe("Refunds", () => {
  it("auto-executes refunds within the requester's limit", async () => {
    const { db, as, payments } = freshEnv();
    const c = db.prepare("SELECT * FROM mock_stripe_charges WHERE amount_refunded_cents = 0 AND amount_cents <= 9900 LIMIT 1").get() as Charge;
    const r = await requestRefund(db, payments, as("u_dev"), { chargeId: c.id, amountCents: c.amount_cents, reasonCode: "duplicate" });
    expect(r.status).toBe("succeeded");
    expect(r.stripe_refund_id).toMatch(/^re_/);
  });

  it("routes over-limit refunds to approval and enforces maker-checker", async () => {
    const { db, as, payments } = freshEnv();
    const c2 = bigCharge(db);
    const req = await requestRefund(db, payments, as("u_dev"), { chargeId: c2.id, amountCents: c2.amount_cents, reasonCode: "fraudulent" });
    expect(req.status).toBe("pending_approval");
    await expect(approveRefund(db, payments, as("u_eli"), req.id)).rejects.toThrow(/permission/);
    const done = await approveRefund(db, payments, as("u_fay"), req.id);
    expect(done.status).toBe("succeeded");
    expect(done.approved_by).toBe("u_fay");
  });

  it("blocks self-approval", async () => {
    const { db, as } = freshEnv();
    const seeded = db.prepare("SELECT id FROM refund_requests WHERE status='pending_approval' LIMIT 1").get() as { id: string };
    // Give the requester approval rights to prove the guard, not the permission, is what blocks them.
    const requester = db.prepare("SELECT requested_by FROM refund_requests WHERE id = ?").get(seeded.id) as { requested_by: string };
    db.prepare("INSERT INTO user_roles (user_id, role) VALUES (?, 'finance_manager')").run(requester.requested_by);
    expect(() => applyTransition(db, refundWorkflow, { id: seeded.id, transitionId: "approve", user: as(requester.requested_by) })).toThrow(/Maker-checker/);
  });

  it("is idempotent: retrying execution never refunds twice", async () => {
    const { db, as, payments } = freshEnv();
    const c = bigCharge(db);
    const req = await requestRefund(db, payments, as("u_dev"), { chargeId: c.id, amountCents: 5000, reasonCode: "duplicate" });
    expect(req.status).toBe("succeeded");
    // Simulate a retry after a timeout: same idempotency key.
    const again = await payments.createRefund({ chargeId: c.id, amountCents: 5000, reason: "duplicate", idempotencyKey: `refund_request:${req.id}` });
    const after = (await payments.getCharge(c.id))!;
    expect(after.amount_refunded_cents).toBe(5000);
    const stored = (db.prepare("SELECT stripe_refund_id AS s FROM refund_requests WHERE id = ?").get(req.id) as { s: string }).s;
    expect(again.id).toBe(stored);
    await expect(executeRefund(db, payments, as("u_fay"), req.id)).rejects.toThrow(/not approved/);
  });

  it("can't over-refund a charge, counting pending requests", async () => {
    const { db, as, payments } = freshEnv();
    const c = bigCharge(db);
    await requestRefund(db, payments, as("u_dev"), { chargeId: c.id, amountCents: c.amount_cents, reasonCode: "duplicate" });
    await expect(requestRefund(db, payments, as("u_eli"), { chargeId: c.id, amountCents: 100, reasonCode: "duplicate" })).rejects.toThrow(/left to refund/);
  });
});
