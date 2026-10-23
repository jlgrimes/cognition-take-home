# Cognition Take-Home Key decisions

## What I tested

The most critical aspect in this decision is not whether Devin can do a quicker job at developing frontends and backends than Power Apps - this I would say is definitely true - it’s how much engineering effort it would take to maintain the platform. Power Apps already includes security, authentication, DLP, and audit history built in. Microsoft has an incredibly rich ecosystem for identity, and losing that means we would need to build it ourselves. I wanted to be incredibly realistic about the cost of maintaining the platform, so I modularized the software to a maintainable breadth that an engineering group could easily pick up.

## Decisions I made

**Platform is the subject, not the apps**. Authentication and the entire security layer is why you would go with Microsoft at all. So, the prototype builds the shared layer first - RBAC, PII masking with audited reveal, an append-only audit log, and approvals. KYC, refunds, and flags are consumers of these shared platform modules.

**Monorepo with explicitly defined modules**. Devin originally suggested deferring this, but I asked for it because the platform needs to be able to be maintained as individual packages to ensure a scalable app ecosystem. It also directly maps the cost of switching over from Power Apps - instead of needing work done on Microsoft’s platform, engineering simply needs to manage the `packages/platform` folder.

**Treating build cost as a wash**. The cost to build a platform on Power Apps vs Devin both require the same high-level considerations. You either have an engineering team manage the cost of building a product, who comes with more technical experience, or someone (engineering or not) needing to work through Power Apps UI, updates, and that entire learning curve. Even though Power Apps is easier for non-developers, engineering is still very much needed for this project, even with Power Apps in the form of custom code, to get the required apps to function.

**Implementing everything we can without an account**. The entire app is made end-to-end except the things we need to make an account for. This pretty confidently proves the PoC as working, as the account integrations can be classified as APIs that are maintained by other teams/companies, so we don’t have to worry about that as a cost for the most part. A lot of the ones that we do are ones like Stripe, which needs to be included in the Power Apps implementation anyways as customer code, so the overhead here is quite small.

**Quick iteration**. Push directly to main for prototype, separate parallel Devin sessions for parallel task execution.

# Devin proposals I accepted

**Next.js + SQLite, no external services, builds locally**. Stubs the mock to just the local machine so I can test with Devin.

**Rules in a server-side workflow engine, not the UI**. Guards return a readable reason, so the UI shows why an action is blocked. Tests cover the rules without a browser.

**Audit is enforced in the database.** SQLite triggers reject `UPDATE`/`DELETE` on the audit log. Production would ship it to WORM storage or a SIEM.

**Money calls outside DB transactions**, with an idempotency key per refund request, so a retry can't refund twice.

**Build app #3 from a playbook in a separate session and time it**. This measures the marginal cost of app #N, the number the "10 more apps" plan depends on.

# Tradeoffs
**Mocked authentication/security layers**: With no accounts, we still have to configure a lot to make this app actually work, and there’s more than just this code we would have to maintain. However, like I mentioned this is comparable to the Power Apps maintenance + custom code effort.

**Skipped**: visual app builder, notifications, file storage, deployment. Extra features that don’t prove PoC. Nice to haves, would be probably good to demo to the team as a what-if, but not required for a PoC.

# What the build told me

**Code is cheap; owning the controls isn’t**. App #3 took a separate Devin session about 5 minutes and 14 tests. The more apps we make, the potential for the complexity of the platform to go up increases. Having a sturdy vision for what’s in and out of scope for these apps is going to be essential to keep Devin’s lead over Power Apps.

**The part Power Apps isn’t good at, Devin is**. The customizability being so lightweight is going to be killer for a small, rapidly growing company, and will allow for more complex workflows in a fraction of the time.
