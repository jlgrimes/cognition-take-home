# Key decisions

> DRAFT for Jared to rewrite in his own voice. Devin wrote the code; this page is about how I directed it and why.

## The question I tested
"Can Devin build three internal apps?" is obviously yes, so it's not a useful test. The real question is whether the client
can stop paying for a **platform**. For a fintech, Power Apps' value isn't the screens. It's that every app gets Entra
sign-in, roles, field-level security, audit history, DLP and Microsoft's patching. I went in leaning "don't build", and
set the prototype up as a fair test of that view rather than a showcase.

## Decisions I made
- **Make the platform the subject, not the apps.** Auth and security are the main reason a company buys Microsoft here,
  so the prototype builds the shared layer first: RBAC, PII masking with audited reveal, an append-only audit log, and
  approvals (four-eyes, maker-checker). KYC, refunds and flags are tenants of it.
- **Document every mock.** Each fake (sign-in, user directory, Stripe, KYC vendor, hosting, secrets, DLP…) is tagged
  `// MOCK:` in code and listed in `docs/MOCKED.md` with its production replacement and owner. That ledger is the most
  important output: it's the bill the client would take on. Not every row counts against building: Stripe and the KYC
  vendor are custom code either way.
- **Monorepo with explicit modules.** `packages/platform`, one `packages/<app>` per tool, and a Next.js host in
  `apps/console`. Devin first suggested deferring this; I asked for it because shared pieces should be visible as
  packages. It also makes the point plain: `packages/platform` is an internal Power Platform someone has to staff.
- **Judge on maintenance and accuracy, not build cost.** These are financial tools, and Power Apps isn't maintenance-free
  either (admin, ALM, Microsoft's release waves). So the comparison is ownership against ownership.
- **Fast iteration:** direct commits to `main`, and a separate Devin session to red-team the argument doc.

## Devin's proposals I accepted
- **Next.js + SQLite, no external services**, so anyone can run it with `npm install && npm run dev`.
- **Rules in a server-side workflow engine, not the UI.** Guards return a readable reason, so the UI shows *why* an action
  is blocked, and tests cover the rules without a browser.
- **Audit enforced in the database** (triggers block UPDATE/DELETE). It still isn't independent of operators; production
  would ship it to WORM storage or a SIEM.
- **Money calls outside DB transactions, with an idempotency key per refund request**, so a retry can't refund twice.
- **Build app #3 from a playbook in a separate session and time it.** This measures the marginal cost of app #N, the number
  the "10 more apps" plan depends on.

## Tradeoffs
- **One deployable, many modules:** one auth integration, audit pipeline and patch cycle instead of thirteen, but a shared
  blast radius. PII and money share a process and DB here; in production KYC and refunds would get separate hosts and DBs.
- **Mocked platform:** keeps the prototype to ~2 hours, but means it proves app logic is cheap, not that production
  hardening is.
- **Skipped:** visual app builder, notifications, file storage, deployment. They add to the bill without changing direction.

## What the build told me
- **Code is cheap; owning the controls isn't.** App #3 took a separate Devin session about 5 minutes and 14 tests. Caveats:
  a mocked platform and a playbook written by the same team. The more telling result was that it found and fixed a bug in
  a form component every app shares. App #N changes the platform under apps 1 to N−1, and someone accountable has to own that.
- **The "we need engineers anyway" argument doesn't tip it.** Refunds and flags need custom code in both options, but that
  code isn't what replaces Power Apps; the controls around it are. That's why I land on keeping Power Apps and using Devin
  for connectors, code apps and evidence automation (`RECOMMENDATION.md`).
