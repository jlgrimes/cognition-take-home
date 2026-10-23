# cognition-take-home

Build-vs-buy evaluation: can a ~60-engineer fintech replace Microsoft Power Apps (~$250K/yr) with internal tools built by Devin?

**Short answer: keep Power Apps for now. Use Devin to build the parts Power Apps can't do (custom connectors and backends), and if anything, build *inside* Power Platform with code apps.** Reasoning in [`docs/KEY_DECISIONS.md`](docs/KEY_DECISIONS.md); the cost of building is itemised in [`docs/MOCKED.md`](docs/MOCKED.md).

## What's here

| Path | What |
|------|------|
| [`docs/SPEC.md`](docs/SPEC.md) | The assignment |
| [`docs/research/power-apps.md`](docs/research/power-apps.md) | How Power Apps maps to their three apps, pricing, limits, weak spots |
| [`docs/research/internal-apps-explained.md`](docs/research/internal-apps-explained.md) | What a KYC queue, refunds dashboard and flag panel are, and what each needs from a stack |
| [`docs/MOCKED.md`](docs/MOCKED.md) | Everything the prototype fakes, what production needs instead, and who owns it forever |
| [`docs/NEW_APP_PLAYBOOK.md`](docs/NEW_APP_PLAYBOOK.md) | The instructions a Devin session follows to add app #N |
| [`docs/KEY_DECISIONS.md`](docs/KEY_DECISIONS.md) | One-pager: scope, architecture, tradeoffs |
| [`prototype/`](prototype/) | The working prototype |

## The prototype

A "mini Power Apps" built with Devin: one shared platform layer plus internal apps that plug into it.

**Platform layer** (`prototype/src/platform/`), the things Power Apps gives you for free:
- **Identity + RBAC**: roles map to permissions; every page and action checks server-side. *(Sign-in is mocked.)*
- **PII masking**: sensitive fields are masked before they reach the UI; revealing requires a permission and writes an audit entry.
- **Append-only audit log**: every change records actor, reason and before/after; SQLite triggers reject UPDATE/DELETE.
- **Workflow engine**: declarative state machines with permission checks, guards (four-eyes, maker-checker, limits), required reasons and optimistic locking. Blocked actions are shown with the reason, not hidden.
- **Connector seam**: a `PaymentsConnector` interface with a mock Stripe that honours idempotency keys and refundable balance.

**Apps** (`prototype/src/apps/`), each is a module registered in one line:
- **KYC review queue**: claim (no double-claims), approve/reject/request info, escalate; high-risk cases must be escalated and the senior approver can't be the escalator.
- **Refunds dashboard**: search charges, refund with reason codes, per-role limits ($100 support / $5,000 finance), larger refunds need a different approver, 14-day volume chart.
- **Feature flags**: built by a separate Devin session from the playbook, as a test of how cheap app #N is.

## Run it

Requires Node 22+.

```bash
cd prototype
npm install
npm run dev          # http://localhost:3000
```

The SQLite database (`prototype/data/app.db`) is created and seeded on first request. `npm run db:reset` wipes it.

Pick a persona on the sign-in page:

| User | Roles | Try |
|------|-------|-----|
| Ana Ruiz | KYC analyst | Claim a case, approve a low-risk one; try approving a high-risk one (blocked) and revealing PII (blocked) |
| Cara Lindqvist | KYC analyst + senior | Reveal PII (audited); approve a case someone else escalated |
| Dev Patel | Support agent | Refund $50 (instant); refund $400 (goes to approval) |
| Fay Chen | Finance manager | Approve Dev's refund; try approving your own (blocked) |
| Gus Admin | Admin | Global audit log at `/audit` |

Checks (same as CI):

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

## What it is not

Not production-secure. The sign-in is a plain cookie, the user directory is hard-coded, Stripe is a SQLite table. That gap is the point of the exercise and is listed row by row in [`docs/MOCKED.md`](docs/MOCKED.md).
