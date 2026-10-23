# Key decisions

> DRAFT for Jared to rewrite in his own voice.

## The question I actually tested
"Can Devin build three internal apps?" has an obvious answer (yes), so it isn't a useful test. The client's real question
is whether they can stop paying for a **platform**. Power Apps' value for a fintech isn't drag-and-drop screens. It's that
every app gets Entra sign-in, Conditional Access, Dataverse roles and field security, audit history, DLP
and Microsoft's patching and SOC attestations (some need add-ons: Managed Environments for DLP/masking, Entra P2 for
access reviews; they still scope their own config). So I built the platform layer first and treated the apps as tenants of it.

## Scope and why
- **Built:** RBAC, PII masking with audited reveal, an append-only audit log, a generic workflow engine
  (guards, four-eyes, maker-checker, optimistic locking), and a payments connector seam. KYC and refunds sit on top.
- **App #3 by playbook:** the feature-flag app was built by a separate Devin session working only from
  `docs/NEW_APP_PLAYBOOK.md`. That measures the marginal cost of app #N, which is the number the "10 more apps" plan
  depends on. Result: about 5 minutes and 14 tests (18:22→18:28 UTC), plus a fix to a bug in a form component every app
  shares. Limits: one app, a mocked platform, and a playbook written by the people who built the platform, so it measures
  app-logic cost only. The bug fix is the more telling result: app #3 changed the platform under apps #1 and #2.
- **Mocked on purpose:** sign-in, the user directory, Stripe, the KYC vendor, hosting. Each is tagged `// MOCK:` and listed in
  `docs/MOCKED.md` with its production replacement and owner. That list is the main output: it's the bill the client
  would take on. Not every row is build-only: Stripe, the KYC vendor and part of approvals are custom code either way.
- **Skipped:** visual app builder, notifications, file storage, deployment. They add to the build bill but don't change the
  direction.

## Architecture choices
- **One Next.js app, many modules** (`AppModule`: roles, migration, seed, pages). Thirteen apps in one deployable means one
  auth integration, one audit pipeline and one patch cycle instead of thirteen. Downside: shared blast radius and one
  release train, and PII and money movement share one process and DB; in production KYC and refunds would get separate
  hosts and databases. Code is a monorepo: `packages/platform`, one `packages/<app>` per tool, and a Next.js host in `apps/console`,
  so apps can later get their own hosts without touching the platform. Note what `packages/platform` is: an internal
  Power Platform that someone has to staff.
- **Rules live in the server-side workflow definitions, not the UI.** Guards return a human-readable reason, so the UI shows
  *why* an action is blocked, and tests cover the rules without a browser.
- **Audit enforced in the database** (triggers block UPDATE/DELETE), not only in application code. It still isn't
  independent of the operators; production would ship it to WORM storage or a SIEM.
- **Money-moving calls happen outside DB transactions, with an idempotency key tied to the request id**, so a retry can't
  refund twice and a slow Stripe call can't hold a lock.
- **SQLite and no external services** so a reviewer can run it with `npm install && npm run dev`.

## Tradeoffs and what I'd tell the VP
- Devin made the code cheap. The prototype covers most of the app logic in about two hours, on a mocked platform, so it
  doesn't prove production hardening is cheap too. My claim is narrower: **code isn't the expensive part.** The expensive
  part is the build-only rows in `MOCKED.md`, and the people who keep them running and explain them to an auditor.
- Owning the platform is roughly 1–2 engineers plus security/compliance time: about $300–750K/yr at normal loaded salaries
  (`RECOMMENDATION.md` §4), i.e. more than the $250K license, and the license itself is probably reducible. The risk
  isn't that code gets refund maths wrong (that's custom code in both options); it's that a missed deprovisioning or a
  four-eyes bug is a control failure nobody owns.
- Where Power Apps is weak (refunds via Stripe, flags via LaunchDarkly), the client needs custom code either way. Devin fits
  there: it can write custom connectors/APIs, and Power Apps "code apps" let Devin-written React run inside Power Platform governance. Code apps went GA in Feb 2026 and I
  haven't tested them, so the hybrid is a pilot, not a proven path.
- **Recommendation:** keep Power Apps. First get the invoice breakdown (the $250K looks too high for their headcount, so there's
  likely licence waste to cut). Use Devin for connectors, code apps and backend services. Revisit building only under
  the flip conditions in `RECOMMENDATION.md` §5, mainly: they already run a staffed platform team that owns auth, audit and
  hosting, and the right-sized license still costs more than that team.
