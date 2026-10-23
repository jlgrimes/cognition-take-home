# What the prototype mocks, and what replacing Power Apps would actually require

The prototype runs on a laptop with no external services. To get there, several things are faked.
Every fake is tagged `// MOCK:` in the code (`grep -rn "MOCK:" prototype/src`) and points back here.

This list is the real cost of "build it ourselves". Power Apps (with Entra ID, Dataverse, and the
Power Platform admin center) gives the client most of these rows as a managed service today.
If they build, **each row becomes a system their engineers own, patch, monitor and defend in a SOC 2 audit.**

| # | Area | What the prototype does | What production needs | Who owns it after launch | What Power Apps gives today |
|---|------|-------------------------|-----------------------|--------------------------|-----------------------------|
| 1 | [Identity](#identity): sign-in | "Sign in as" page sets a plain, unsigned cookie with a user id. Anyone can become anyone. | OIDC against Entra ID/Okta, signed short-lived sessions, CSRF protection, logout/session revocation | Platform/security eng | Entra sign-in, built in |
| 2 | [Identity](#identity): MFA + Conditional Access | None | Enforced at the IdP; each new app must be registered and put under the right policy (device, location, risk) | IT/security | Inherited by every app automatically |
| 3 | [Identity](#identity): user directory + roles | Seven hard-coded users; roles in a SQLite table | Roles mapped from IdP groups (claims or SCIM), joiner/mover/leaver automation, deprovisioning within SLA | IT + platform eng | Entra groups → Dataverse security roles/teams |
| 4 | Access reviews | None | Quarterly review of who holds `kyc_senior`, `finance_manager`, `admin`, with evidence for auditors | Security/compliance | Entra access reviews (P2), Dataverse role reports |
| 5 | Authorization | Role → permission table, checked server-side per action; no row-level rules | Per-record and per-field rules (e.g. region, team, ownership), tested on every endpoint, reviewed on every change | Every app team | Dataverse security roles, business units, field-level security |
| 6 | PII masking | Masks four KYC fields before render; reveal is permission-gated and audited | Same, plus encryption at rest with managed keys, masking in exports/logs/backups, data-retention and deletion jobs | App teams + security | Dataverse column security, masking rules, CMK option |
| 7 | [Audit log](#audit) | Append-only SQLite table (UPDATE/DELETE blocked by triggers) | Tamper-evident storage outside the app DB (WORM bucket or SIEM), retention policy, export for auditors, alerting | Platform eng + security | Dataverse auditing + Purview, retained and queryable |
| 8 | [Payments](#payments) | `MockStripeConnector`: SQLite with Stripe-like semantics (idempotency keys, no over-refund) | Stripe SDK with a restricted key in a secrets manager, key rotation, webhooks for async status, retries/backoff, daily reconciliation against Stripe | Payments eng | Not given: the stock Stripe connector can't issue refunds, so this is custom either way |
| 9 | KYC vendor | Seeded cases; a "resubmitted" transition fakes the vendor callback | Signed webhook receiver for Onfido/Persona/Alloy, document storage with expiring URLs, malware scanning | KYC/risk eng | Custom connector or Power Automate flow; still integration work |
| 10 | Workflow + approvals | In-app state machine with guards, optimistic locking, four-eyes rules | Same code, plus notifications (Slack/Teams/email), SLAs/reminders, delegation when an approver is away | App teams | Power Automate approvals, Teams notifications |
| 11 | Hosting | `npm run dev` on a laptop | Container hosting, private network/VPN or zero-trust proxy, TLS, WAF, environments (dev/stage/prod) | Platform/infra eng | Microsoft-hosted, environments included |
| 12 | Database | One local SQLite file | Managed Postgres, backups, point-in-time restore, migrations in CI, capacity planning | Platform/infra eng | Dataverse, managed |
| 13 | Secrets | None needed | Secrets manager, rotation, least-privilege service accounts per app | Platform eng | Connection references + Key Vault integration |
| 14 | Data-loss prevention | None | Policy for which apps may talk to which systems; egress controls | Security | DLP connector policies across all apps |
| 15 | Observability + on-call | None | Logs, metrics, uptime alerts, an on-call rotation for tools ops/compliance depend on | Platform eng | Microsoft SLA; admin analytics |
| 16 | Patching | Pinned npm dependencies | Dependabot/Renovate, framework upgrades (Next.js majors), CVE response across 13 apps | Every app team | Microsoft patches the runtime |
| 17 | Compliance scope | None | Each app documented in SOC 2/PCI scope: change management, pen tests, evidence collection | Compliance + eng | Inherits Microsoft's attestations; client still scopes its own config |

## Identity
Rows 1–4. **Signing in is the cheap part.** Wiring OIDC against Entra is a day of work, and Devin can do it.
The expensive part is everything that comes with identity and never stops: group-to-role mapping, deprovisioning,
Conditional Access per app, and access-review evidence. Power Apps inherits all of this because it lives inside the
same tenant as their identity provider.

## Audit
Row 7. The prototype's audit log is genuinely append-only at the database layer and records before/after for
every change, which is the shape an auditor wants. What it lacks is independence: an admin with DB access can
drop the triggers. Production needs the log shipped somewhere the app's own operators can't rewrite.

## Payments
Row 8. This is the one place where building is not extra work compared to Power Apps: Microsoft's Stripe
connector can't create refunds, so the client almost certainly already has custom backend code here.
The prototype's `PaymentsConnector` interface is the seam a real Stripe adapter would plug into.

## What this means for the decision
Rows 1–7 and 11–17 are a **platform** that would be built once and then run forever. Devin can write most of the
code for it in days. Devin does not remove the need for a team to own it, carry the pager, and answer the auditor.
At 60 engineers, that is roughly 1–2 engineers' worth of ongoing ownership, which is in the same range as the
$250K license, before counting the risk of getting a security control wrong in a fintech.
