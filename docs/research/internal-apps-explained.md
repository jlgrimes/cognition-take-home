# The client's three internal apps, explained

What each app does, what it has to guarantee, and what it takes to build in code. All three are back-office tools used only by employees.

## 1. KYC review queue

**What it is.** KYC ("Know Your Customer") is a legal requirement for financial companies to verify who their customers are. At signup, an identity vendor (Onfido, Persona, Alloy, ...) checks ID documents, a selfie, address, and sanctions/PEP lists. Most applicants pass automatically. The ambiguous ones ("name partially matches a sanctions list", "blurry license") go into a **queue**. A compliance analyst claims a case, reviews the documents and vendor results, and approves, rejects, requests more info, or escalates to a senior reviewer.

**What it has to guarantee**
- A clear set of case statuses (`pending → in_review → approved | rejected | escalated | needs_info`), with invalid moves blocked
- No two analysts working the same case
- Escalation / second approval for certain decisions
- PII (SSN, ID numbers, DOB) masked for anyone without a need to see it
- Every decision logged permanently: who, when, why. Regulators ask.

**Engineering stack**
- DB tables: cases, status, assignee, decision history
- A safe way to claim a case so two analysts can't get the same one (row lock or compare-and-set)
- File storage for ID images, with signed, expiring URLs
- Webhook endpoint for vendor results
- Auth + roles (analyst, senior reviewer, admin)
- Field-level masking of PII
- Append-only audit log
- UI: filterable list + case detail (docs beside vendor results) + action buttons

## 2. Refunds dashboard

**What it is.** Support/finance staff look up a payment and issue a full or partial refund. They also monitor refund volume and trends.

**What it has to guarantee**
- Search payments by customer, email, or transaction ID
- Issue refunds with **limits by role**. Above a threshold, a second person approves (**maker-checker / four-eyes**), so no single person can move money alone.
- A reason code on every refund
- **Never refund twice**, even if someone double-clicks
- Charts: refunds/day, refund rate, top reasons

**Engineering stack**
- Read access to payment data (Stripe API or internal ledger/warehouse)
- Backend service that calls the Stripe Refunds API. The secret key stays server-side, never in the browser.
- Idempotency keys
- Refund-request table with an approval state machine
- Stripe webhooks for refund success/failure
- Auth + roles with per-role dollar limits
- Audit log
- Charting library or embedded BI
- **Riskiest of the three:** it moves money. A bug costs dollars, not just a bad screen.

## 3. Feature-flag admin panel

**What it is.** Feature flags are on/off switches in the product's code ("show new checkout to 10% of users", "enable instant payouts for merchant X"). The admin panel is where staff flip them without a deploy. Customers never see it, but every change instantly alters what customers experience.

**What it has to guarantee**
- List flags with their state per environment (dev / staging / prod)
- Toggle, set rollout %, or target specific users/merchants
- Restrict who can change **prod** flags, possibly with approval for sensitive ones
- Log every change, with easy rollback
- Optionally schedule changes

**Engineering stack**
- A flag store: usually a vendor (LaunchDarkly, Unleash, Statsig), so the panel is a thin UI over their API. Otherwise a table the product's services read and cache.
- Auth + per-environment RBAC
- Audit log
- Fast flag evaluation in the product itself (SDK/cache), which lives in product code, not the panel
- The panel is simple CRUD. The risk is in who gets to change prod flags.

## What they share

| Building block | KYC | Refunds | Flags |
|---|---|---|---|
| SSO + role-based access | ✓ | ✓ | ✓ |
| Append-only audit log | ✓ | ✓ | ✓ |
| List → detail → action UI | ✓ | ✓ | ✓ |
| State machine / workflow | ✓ | ✓ | (light) |
| Approval above a threshold (maker-checker) | escalation | $ threshold | prod changes |
| External connector | KYC vendor | Stripe | flag vendor |
| PII / sensitive-field masking | ✓ | ✓ (card/bank) | — |

Power Apps (Dataverse + model-driven apps + Power Automate) provides most of this table out of the box. A code-first build has to provide it once, as a shared platform, before app #4 through #13 get cheap. That's the scope of the prototype.
