import type { AppModule } from "@internal/platform/types";

export const refundsModule: AppModule = {
  id: "refunds",
  name: "Refunds",
  description: "Look up payments, issue refunds within your limit, approve larger ones (maker-checker).",
  href: "/refunds",
  navPermission: "refunds.view",
  roles: {
    support_agent: ["refunds.view", "refunds.create"],
    finance_manager: ["refunds.view", "refunds.create", "refunds.approve"],
    admin: ["refunds.view"],
    auditor: ["refunds.view"],
  },
  migrate(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS refund_requests (
        id TEXT PRIMARY KEY,
        charge_id TEXT NOT NULL,
        amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
        reason_code TEXT NOT NULL,
        note TEXT,
        status TEXT NOT NULL,
        requested_by TEXT NOT NULL REFERENCES users(id),
        approved_by TEXT REFERENCES users(id),
        stripe_refund_id TEXT,
        error TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        version INTEGER NOT NULL DEFAULT 1,
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );
    `);
  },
  seed(db) {
    const charges = db
      .prepare("SELECT id, amount_cents FROM mock_stripe_charges WHERE amount_refunded_cents = 0 AND amount_cents > 10000 LIMIT 3")
      .all() as { id: string; amount_cents: number }[];
    const ins = db.prepare(
      `INSERT INTO refund_requests (id, charge_id, amount_cents, reason_code, note, status, requested_by)
       VALUES (?, ?, ?, ?, ?, 'pending_approval', ?)`,
    );
    charges.forEach((c, i) =>
      ins.run(`RF-${1001 + i}`, c.id, c.amount_cents, "requested_by_customer", "Customer cancelled within 30 days", i % 2 ? "u_eli" : "u_dev"),
    );
  },
};
