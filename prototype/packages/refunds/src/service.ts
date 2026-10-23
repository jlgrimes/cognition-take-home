import type { DB, User } from "@internal/platform/types";
import { PolicyError } from "@internal/platform/types";
import { assertCan } from "@internal/platform/auth";
import { writeAudit } from "@internal/platform/audit";
import { applyTransition } from "@internal/platform/workflow";
import type { PaymentsConnector } from "@internal/platform/connectors/payments";
import { REASON_CODES, refundLimitCents, refundWorkflow, type RefundRequest } from "./workflow";

function nextId(db: DB): string {
  const row = db.prepare("SELECT COUNT(*) AS n FROM refund_requests").get() as { n: number };
  return `RF-${1001 + row.n}`;
}

/**
 * Creates a refund request. Within the requester's limit it executes immediately;
 * above it, it waits for a different user with enough authority to approve.
 */
export async function requestRefund(
  db: DB,
  payments: PaymentsConnector,
  user: User,
  input: { chargeId: string; amountCents: number; reasonCode: string; note?: string },
): Promise<RefundRequest> {
  assertCan(user, "refunds.create");
  if (!(REASON_CODES as readonly string[]).includes(input.reasonCode)) throw new PolicyError("Pick a reason code");
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) throw new PolicyError("Amount must be positive");
  const charge = await payments.getCharge(input.chargeId);
  if (!charge) throw new PolicyError("Charge not found");
  const pending = (
    db
      .prepare("SELECT COALESCE(SUM(amount_cents),0) AS s FROM refund_requests WHERE charge_id = ? AND status IN ('pending_approval','approved')")
      .get(input.chargeId) as { s: number }
  ).s;
  if (input.amountCents > charge.amount_cents - charge.amount_refunded_cents - pending) {
    throw new PolicyError("Amount exceeds what's left to refund on this charge (including pending requests)");
  }

  const autoApprove = input.amountCents <= refundLimitCents(user);
  const id = nextId(db);
  db.transaction(() => {
    db.prepare(
      `INSERT INTO refund_requests (id, charge_id, amount_cents, reason_code, note, status, requested_by, approved_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(id, input.chargeId, input.amountCents, input.reasonCode, input.note ?? null,
      autoApprove ? "approved" : "pending_approval", user.id, autoApprove ? user.id : null);
    writeAudit(db, {
      actorId: user.id, app: "refunds", action: "refund_request.create", entityType: "refund_request", entityId: id,
      after: { charge_id: input.chargeId, amount_cents: input.amountCents, reason_code: input.reasonCode },
      metadata: { autoApproved: autoApprove, limitCents: refundLimitCents(user) },
    });
  })();
  if (autoApprove) return executeRefund(db, payments, user, id);
  return getRefund(db, id)!;
}

export async function approveRefund(db: DB, payments: PaymentsConnector, user: User, id: string, expectedVersion?: number) {
  applyTransition(db, refundWorkflow, { id, transitionId: "approve", user, expectedVersion });
  return executeRefund(db, payments, user, id);
}

/** Calls the payment provider outside the DB transaction; the idempotency key makes retries safe. */
export async function executeRefund(db: DB, payments: PaymentsConnector, user: User, id: string): Promise<RefundRequest> {
  const req = getRefund(db, id);
  if (!req || req.status !== "approved") throw new PolicyError("Refund is not approved");
  try {
    const refund = await payments.createRefund({
      chargeId: req.charge_id, amountCents: req.amount_cents, reason: req.reason_code, idempotencyKey: `refund_request:${id}`,
    });
    db.prepare("UPDATE refund_requests SET stripe_refund_id = ? WHERE id = ?").run(refund.id, id);
    return applyTransition(db, refundWorkflow, { id, transitionId: "mark_succeeded", user, internal: true });
  } catch (e) {
    db.prepare("UPDATE refund_requests SET error = ? WHERE id = ?").run((e as Error).message, id);
    return applyTransition(db, refundWorkflow, { id, transitionId: "mark_failed", user, internal: true, reason: (e as Error).message });
  }
}

export function getRefund(db: DB, id: string): RefundRequest | null {
  return (db.prepare("SELECT * FROM refund_requests WHERE id = ?").get(id) as RefundRequest) ?? null;
}

export type RefundListRow = RefundRequest & { requester_name: string; approver_name: string | null; customer_email: string };

export function listRefundRequests(db: DB, user: User, status?: string): RefundListRow[] {
  assertCan(user, "refunds.view");
  return db
    .prepare(
      `SELECT r.*, ru.name AS requester_name, au.name AS approver_name, c.customer_email
       FROM refund_requests r JOIN users ru ON ru.id = r.requested_by LEFT JOIN users au ON au.id = r.approved_by
       LEFT JOIN mock_stripe_charges c ON c.id = r.charge_id
       ${status ? "WHERE r.status = ?" : ""} ORDER BY r.created_at DESC LIMIT 50`,
    )
    .all(...(status ? [status] : [])) as RefundListRow[];
}
