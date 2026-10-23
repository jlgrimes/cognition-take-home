import type { AppModule } from "@/platform/types";
import type { EnvState } from "./workflow";

type Seed = [key: string, description: string, owner: string, dev: EnvState, staging: EnvState, prod: EnvState];
const on = (rollout_pct = 100, targets: string[] = []): EnvState => ({ enabled: true, rollout_pct, targets });
const off: EnvState = { enabled: false, rollout_pct: 0, targets: [] };

const FLAGS: Seed[] = [
  ["instant_payouts", "Let eligible merchants cash out to a debit card in minutes instead of T+2 ACH.", "payouts",
    on(), on(), on(25, ["acct_1F9xQ2", "acct_7KpL0m"])],
  ["new_checkout", "Rebuilt hosted checkout page with wallet buttons above the card form.", "checkout",
    on(), on(50), off],
  ["3ds_challenge_v2", "Route 3-D Secure challenges through the EMV 3DS 2.2 flow (frictionless where the issuer allows).", "risk",
    on(), on(), on(10)],
  ["smart_retry_dunning", "ML-timed retries for failed subscription charges instead of the fixed 1/3/5-day schedule.", "billing",
    on(), on(), on(100)],
  ["same_day_ach", "Offer same-day ACH settlement for merchants on the Plus plan.", "payouts",
    on(), off, off],
  ["fraud_model_v7_shadow", "Score every charge with fraud model v7 in shadow mode; decisions still come from v6.", "risk",
    on(), on(), on(100)],
  ["multi_currency_wallets", "Hold balances in EUR and GBP without converting to USD on settlement.", "treasury",
    on(), on(0, ["acct_3Hq9Zt"]), off],
  ["payout_velocity_limits", "Hold payouts that exceed 3x the merchant's 30-day average pending review.", "risk",
    on(), on(), on(100)],
];

export const flagsModule: AppModule = {
  id: "flags",
  name: "Feature Flags",
  description: "Toggle flags and rollouts per environment. Prod changes need a second engineer's approval.",
  href: "/flags",
  navPermission: "flags.view",
  roles: {
    engineer: ["flags.view", "flags.edit_nonprod", "flags.propose_prod"],
    flag_approver: ["flags.view", "flags.approve"],
    admin: ["flags.view"],
    auditor: ["flags.view"],
  },
  migrate(db) {
    // MOCK: flag store. Production reads/writes flags through LaunchDarkly/Unleash or an internal flag service
    // whose SDKs cache values in every service. See docs/MOCKED.md#feature-flags
    db.exec(`
      CREATE TABLE IF NOT EXISTS flags (
        key TEXT PRIMARY KEY,
        description TEXT NOT NULL,
        owner TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        version INTEGER NOT NULL DEFAULT 1,
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );
      CREATE TABLE IF NOT EXISTS flag_envs (
        id TEXT PRIMARY KEY,
        flag_key TEXT NOT NULL REFERENCES flags(key),
        env TEXT NOT NULL CHECK (env IN ('dev', 'staging', 'prod')),
        enabled INTEGER NOT NULL DEFAULT 0,
        rollout_pct INTEGER NOT NULL DEFAULT 0 CHECK (rollout_pct BETWEEN 0 AND 100),
        targets_json TEXT NOT NULL DEFAULT '[]',
        version INTEGER NOT NULL DEFAULT 1,
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        UNIQUE (flag_key, env)
      );
      CREATE TABLE IF NOT EXISTS flag_change_requests (
        id TEXT PRIMARY KEY,
        flag_key TEXT NOT NULL REFERENCES flags(key),
        env TEXT NOT NULL DEFAULT 'prod',
        kind TEXT NOT NULL DEFAULT 'change',
        rollback_of TEXT REFERENCES flag_change_requests(id),
        previous_json TEXT NOT NULL,
        proposed_json TEXT NOT NULL,
        reason TEXT NOT NULL,
        status TEXT NOT NULL,
        requested_by TEXT NOT NULL REFERENCES users(id),
        reviewed_by TEXT REFERENCES users(id),
        applied_at TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        version INTEGER NOT NULL DEFAULT 1,
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );
      CREATE INDEX IF NOT EXISTS flag_cr_flag ON flag_change_requests(flag_key, status);
    `);
  },
  seed(db) {
    const insFlag = db.prepare("INSERT INTO flags (key, description, owner) VALUES (?, ?, ?)");
    const insEnv = db.prepare(
      "INSERT INTO flag_envs (id, flag_key, env, enabled, rollout_pct, targets_json) VALUES (?, ?, ?, ?, ?, ?)",
    );
    for (const [key, description, owner, ...states] of FLAGS) {
      insFlag.run(key, description, owner);
      (["dev", "staging", "prod"] as const).forEach((env, i) =>
        insEnv.run(`${key}:${env}`, key, env, states[i].enabled ? 1 : 0, states[i].rollout_pct, JSON.stringify(states[i].targets)));
    }
    const insCr = db.prepare(
      `INSERT INTO flag_change_requests (id, flag_key, previous_json, proposed_json, reason, status, requested_by, reviewed_by, applied_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const ago = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();
    // History so "Roll back" has something to undo, and one request waiting for an approver.
    insCr.run("FC-1001", "instant_payouts", JSON.stringify(on(10, ["acct_1F9xQ2", "acct_7KpL0m"])),
      JSON.stringify(on(25, ["acct_1F9xQ2", "acct_7KpL0m"])), "Error rate flat at 10% for a week; widening to 25%.",
      "applied", "u_hana", "u_gus", ago(20), ago(26));
    insCr.run("FC-1002", "new_checkout", JSON.stringify(off), JSON.stringify(on(5)),
      "Staging conversion +3.1% at 50%. Start prod at 5%.", "pending_approval", "u_hana", null, null, ago(2));
  },
};
