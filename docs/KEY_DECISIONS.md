# Key decisions

> DRAFT for Jared to rewrite in his own voice. Numbers marked TBD are filled in once the feature-flag session finishes.

## The question I actually tested
"Can Devin build three internal apps?" has an obvious answer (yes), so it isn't a useful test. The client's real question
is whether they can stop paying for a **platform**. Power Apps' value for a fintech isn't drag-and-drop screens. It's that
every app automatically gets Entra sign-in, Conditional Access, Dataverse roles and field security, audit history, DLP
and Microsoft's patching and SOC attestations. So I built the platform layer first and treated the apps as tenants of it.

## Scope and why
- **Built:** RBAC, PII masking with audited reveal, an append-only audit log, a generic workflow engine
  (guards, four-eyes, maker-checker, optimistic locking), and a payments connector seam. KYC and refunds sit on top.
- **App #3 by playbook:** the feature-flag app was built by a separate Devin session working only from
  `docs/NEW_APP_PLAYBOOK.md`. That measures the marginal cost of app #N, which is the number the "10 more apps" plan
  depends on. Result: TBD.
- **Mocked on purpose:** sign-in, the user directory, Stripe, the KYC vendor, hosting. Each is tagged `// MOCK:` and listed in
  `docs/MOCKED.md` with its production replacement and owner. That list is the main output: it's the bill the client
  would take on.
- **Skipped:** visual app builder, notifications, file storage, deployment. None of them change the decision.

## Architecture choices
- **One Next.js app, many modules** (`AppModule`: roles, migration, seed, pages). Thirteen apps in one deployable means one
  auth integration, one audit pipeline and one patch cycle instead of thirteen. Downside: shared blast radius and one
  release train. At 13 apps the production shape is a monorepo (`packages/platform` + `apps/*`, separately deployable).
  I kept it as folders because splitting into workspaces is plumbing that doesn't change what the prototype proves.
  Note what that `packages/platform` is: an internal Power Platform that someone has to staff.
- **Rules live in the server-side workflow definitions, not the UI.** Guards return a human-readable reason, so the UI shows
  *why* an action is blocked, and tests cover the rules without a browser.
- **Audit enforced in the database** (triggers block UPDATE/DELETE), not only in application code. It still isn't
  independent of the operators; production would ship it to WORM storage or a SIEM.
- **Money-moving calls happen outside DB transactions, with an idempotency key tied to the request id**, so a retry can't
  refund twice and a slow Stripe call can't hold a lock.
- **SQLite and no external services** so a reviewer can run it with `npm install && npm run dev`.

## Tradeoffs and what I'd tell the VP
- Devin made the code cheap. The prototype covers most of the logic in the three apps in about two hours. **Code was never
  the expensive part.** The expensive part is the 17 rows in `MOCKED.md`, and the people who keep them running and
  explain them to an auditor.
- The license is about $250K/yr. Owning the platform properly is roughly 1–2 engineers plus security/compliance time, which is
  about the same cost, and a control failure in a fintech costs far more.
- Where Power Apps is weak (refunds via Stripe, flags via LaunchDarkly), the client needs custom code either way. Devin fits
  there: it can write custom connectors/APIs, and Power Apps "code apps" let Devin-written React run inside Power Platform governance.
- **Recommendation:** keep Power Apps. First get the invoice breakdown (the $250K looks too high for their headcount, so there's
  likely licence waste to cut). Use Devin for connectors, code apps and backend services. Revisit building only if they
  outgrow Dataverse or already run an internal platform team that owns auth, audit and hosting.
