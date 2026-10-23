import type { DB } from "../types";
import type { SchemaModule } from "../db";

export interface Charge {
  id: string;
  customer_name: string;
  customer_email: string;
  card_last4: string;
  amount_cents: number;
  amount_refunded_cents: number;
  currency: string;
  description: string;
  created_at: string;
}

export interface Refund {
  id: string;
  charge_id: string;
  amount_cents: number;
  reason: string;
  idempotency_key: string;
  status: "succeeded" | "failed";
  created_at: string;
}

/** The only surface apps see. Swap the implementation, not the apps. */
export interface PaymentsConnector {
  searchCharges(query: string, limit?: number): Promise<Charge[]>;
  getCharge(id: string): Promise<Charge | null>;
  createRefund(args: { chargeId: string; amountCents: number; reason: string; idempotencyKey: string }): Promise<Refund>;
  listRefunds(sinceIso: string): Promise<Refund[]>;
}

export class PaymentsError extends Error {}

// MOCK: Stripe. A local SQLite stand-in with Stripe-like semantics (idempotency keys,
// can't refund more than the remaining balance). Production: Stripe SDK with a restricted
// key from a secrets manager, webhooks for async refund status, retries/backoff,
// and reconciliation against the ledger. See docs/MOCKED.md#payments
export class MockStripeConnector implements PaymentsConnector {
  constructor(private db: DB) {}

  async searchCharges(query: string, limit = 25): Promise<Charge[]> {
    const q = `%${query.trim().toLowerCase()}%`;
    return this.db
      .prepare(
        `SELECT * FROM mock_stripe_charges
         WHERE lower(id) LIKE ? OR lower(customer_email) LIKE ? OR lower(customer_name) LIKE ?
         ORDER BY created_at DESC LIMIT ?`,
      )
      .all(q, q, q, limit) as Charge[];
  }

  async getCharge(id: string): Promise<Charge | null> {
    return (this.db.prepare("SELECT * FROM mock_stripe_charges WHERE id = ?").get(id) as Charge) ?? null;
  }

  async createRefund(args: { chargeId: string; amountCents: number; reason: string; idempotencyKey: string }): Promise<Refund> {
    return this.db.transaction(() => {
      const existing = this.db
        .prepare("SELECT * FROM mock_stripe_refunds WHERE idempotency_key = ?")
        .get(args.idempotencyKey) as Refund | undefined;
      if (existing) return existing;
      const charge = this.db.prepare("SELECT * FROM mock_stripe_charges WHERE id = ?").get(args.chargeId) as Charge | undefined;
      if (!charge) throw new PaymentsError(`No such charge: ${args.chargeId}`);
      if (args.amountCents <= 0) throw new PaymentsError("Amount must be positive");
      if (args.amountCents > charge.amount_cents - charge.amount_refunded_cents) {
        throw new PaymentsError("Refund exceeds remaining refundable amount");
      }
      const id = "re_" + Math.random().toString(36).slice(2, 14);
      this.db
        .prepare(
          `INSERT INTO mock_stripe_refunds (id, charge_id, amount_cents, reason, idempotency_key, status)
           VALUES (?, ?, ?, ?, ?, 'succeeded')`,
        )
        .run(id, args.chargeId, args.amountCents, args.reason, args.idempotencyKey);
      this.db
        .prepare("UPDATE mock_stripe_charges SET amount_refunded_cents = amount_refunded_cents + ? WHERE id = ?")
        .run(args.amountCents, args.chargeId);
      return this.db.prepare("SELECT * FROM mock_stripe_refunds WHERE id = ?").get(id) as Refund;
    })();
  }

  async listRefunds(sinceIso: string): Promise<Refund[]> {
    return this.db
      .prepare("SELECT * FROM mock_stripe_refunds WHERE created_at >= ? ORDER BY created_at")
      .all(sinceIso) as Refund[];
  }
}

const FIRST = ["Maya", "Liam", "Noah", "Zoe", "Omar", "Ivy", "Leo", "Aria", "Kai", "Nora", "Ezra", "Luna", "Theo", "Mila", "Jude"];
const LAST = ["Nguyen", "Smith", "Garcia", "Kim", "Johnson", "Brown", "Khan", "Rossi", "Silva", "Cohen"];
const ITEMS = ["Pro plan (annual)", "Card replacement fee", "Wire transfer fee", "Premium plan (monthly)", "FX conversion fee", "Instant payout fee"];

/** Deterministic PRNG so every fresh DB has the same demo data. */
export function rng(seed: number) {
  return () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
}

export const mockStripeSchema: SchemaModule = {
  migrate(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS mock_stripe_charges (
        id TEXT PRIMARY KEY, customer_name TEXT NOT NULL, customer_email TEXT NOT NULL, card_last4 TEXT NOT NULL,
        amount_cents INTEGER NOT NULL, amount_refunded_cents INTEGER NOT NULL DEFAULT 0, currency TEXT NOT NULL DEFAULT 'usd',
        description TEXT NOT NULL, created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS mock_stripe_refunds (
        id TEXT PRIMARY KEY, charge_id TEXT NOT NULL REFERENCES mock_stripe_charges(id), amount_cents INTEGER NOT NULL,
        reason TEXT NOT NULL, idempotency_key TEXT NOT NULL UNIQUE, status TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );
    `);
  },
  seed(db) {
    const r = rng(42);
    const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
    const ins = db.prepare(
      `INSERT INTO mock_stripe_charges (id, customer_name, customer_email, card_last4, amount_cents, description, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    const insRefund = db.prepare(
      `INSERT INTO mock_stripe_refunds (id, charge_id, amount_cents, reason, idempotency_key, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'succeeded', ?)`,
    );
    const now = Date.now();
    for (let i = 0; i < 120; i++) {
      const first = pick(FIRST);
      const last = pick(LAST);
      const id = "ch_" + (1000 + i).toString(36) + Math.floor(r() * 1e6).toString(36);
      const amount = [499, 1299, 2500, 4900, 9900, 19900, 49900, 120000, 350000][Math.floor(r() * 9)];
      const created = new Date(now - Math.floor(r() * 21 * 86400000)).toISOString();
      ins.run(id, `${first} ${last}`, `${first}.${last}${i}@mail.example`.toLowerCase(), String(1000 + Math.floor(r() * 9000)), amount, pick(ITEMS), created);
      // Historical refunds so the dashboard has a trend line.
      if (r() < 0.22) {
        const amt = r() < 0.6 ? amount : Math.floor(amount / 2);
        const at = new Date(Math.min(now, Date.parse(created) + Math.floor(r() * 3 * 86400000))).toISOString();
        insRefund.run("re_seed" + i, id, amt, pick(["duplicate", "fraudulent", "requested_by_customer"]), "seed-" + i, at);
        db.prepare("UPDATE mock_stripe_charges SET amount_refunded_cents = ? WHERE id = ?").run(amt, id);
      }
    }
  },
};
