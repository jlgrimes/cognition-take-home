# Recommendation: build on Devin, keep Microsoft identity

**For:** VP of Engineering. **Status:** draft, pending answers to [open questions 2–7](research/power-apps.md#6-questions-for-the-client-before-recommending).

Build the internal-tools platform in code with Devin, and move off Power Apps one app at a time. Keep Microsoft Entra as the identity provider.

**Why:**
1. **Engineering is needed either way.** Refunds and flags need custom code under Power Apps too: the Stripe connector can't issue refunds, and there's no certified LaunchDarkly connector. Power Apps also needs admin time. Keeping it costs about $300–375K/yr, not $250K (§4).
2. **Devin makes the build and app #N cheap.** The prototype (shared platform plus three apps) took about two hours. App #3 took a separate Devin session about 5 minutes from the [playbook](NEW_APP_PLAYBOOK.md), including 14 tests.
3. **Code is the better medium for financial logic.** It gets tests, review and Git history, and Devin is far more effective in TypeScript than in Power Fx (§2).
4. **Customisation and growth.** Apps 4–13 aren't limited by Power Fx, delegation or connectors. The licence grows with every user; the platform doesn't.

**What we're accepting:** owning the platform. That costs about $200–495K/yr if a platform owner already exists and about $300–745K/yr if not (§4). At today's headcount that overlaps with, or exceeds, Keep. We're paying for speed, customisation and control, not for a smaller bill this year. The controls around money and PII need a named owner, so building is only safe with one (§5).

**Building doesn't mean leaving Microsoft's identity stack.** The console signs in through Entra (OIDC) with MFA and Conditional Access, maps Entra groups to roles, and deprovisions through SCIM [assumption: the client is on Entra, open question 4; Conditional Access needs Entra ID P1 or a bundle that includes it, verify]. What we take on is everything behind sign-in: record and field access, masking, approvals, audit storage, hosting and on-call ([MOCKED.md](MOCKED.md) rows 4–7, 10–17).

Notation: **[inference]** = my read, not confirmed with you. **[assumption]** = a number I picked so the model can be calculated. Replace it with yours.

## 1. The three options

| | **Build with Devin** | **Keep Power Apps** | **Hybrid** (Power Apps + Devin-written code apps / connectors) |
|---|---|---|---|
| License / build cost | License goes away. One-off build of the platform layer ([MOCKED.md](MOCKED.md) rows 1–7, 11–17) plus Devin usage | $250K/yr. Apps 4–13 add ~$0 if the same people use them ([research §3](research/power-apps.md#3-cost-reality)) | Same license as Keep, plus Devin usage |
| Ongoing maintenance & ownership | You own sign-in, roles, audit storage, hosting, DB, secrets, DLP, on-call and patching for good. ~1–2 engineers (§4) | Microsoft runs the platform. You own app logic, custom connectors, and the Power Platform admin work | Same as Keep, plus the code apps and connectors, which are normal code in Git |
| Security & compliance | Every control is yours to build, test and evidence. The auditor talks to you, not to Microsoft's attestations | Inherits Entra/Conditional Access, Dataverse roles and field security, audit, DLP ([research §1](research/power-apps.md#1-the-parts-of-power-apps-that-matter-for-this-team)). You still scope your own configuration | Same as Keep. Code apps run inside Power Platform governance |
| Speed to ship apps 4–13 | Slow until the platform is production-grade, then fast: app #N is one Devin session from the [playbook](NEW_APP_PLAYBOOK.md) plus review. App #3 (the flag panel) took a separate Devin session working only from the playbook about 5–6 minutes, including 14 tests, on the mocked platform | Fast for queue/approve/audit apps (model-driven + queues + approvals). Slow for integration-heavy apps. Depends on having someone fluent in Power Platform [inference] | Fast for both kinds: queue apps model-driven, custom ones as Devin-written code apps |
| Customisation / UX ceiling | Unlimited | Low to medium. Power Fx, delegation limits ([research §4](research/power-apps.md#4-where-power-apps-is-weak-and-where-engineers-feel-it)) | High. React/TS inside the governed platform |
| Vendor lock-in | Lowest, apart from your cloud provider | Highest. Power Fx, flows and the Dataverse model don't move | Medium. Logic in code apps/connectors is portable; data and governance stay on Microsoft |
| Engineering opportunity cost | 1–2 engineers moved off product for good, plus security/compliance time | Lowest | Low. Engineers write code where it pays off, with Devin doing most of it |

## 2. Maintenance and accuracy

These are financial tools, so "who keeps it running" and "who makes sure the numbers are right" matter more than build cost. Neither option is maintenance-free. The question is which work lands on your team.

| Recurring work | Power Apps | Code you own |
|---|---|---|
| Runtime, framework and dependency patching, CVE response | Microsoft | You, for every app (MOCKED row 16) |
| Hosting, DB, backups, restore drills | Microsoft | You (rows 11–12) |
| Uptime and on-call | Microsoft SLA. Your configuration mistakes are still yours | Your rotation, for tools ops and compliance can't work without (row 15) |
| Joiners/leavers, role changes | Entra groups → Dataverse roles, run by IT | IT still does it, but you own the wiring and its failures (row 3) |
| Access reviews, audit evidence | Built-in reports. Compliance pulls them | You build the reports and keep them working (rows 4, 7, 17) |
| Changes forced on you | Microsoft's two release waves a year, licensing and connector changes. You absorb them on Microsoft's schedule | Framework major versions. You absorb them on your schedule |
| App logic changes | Power Fx and flows, edited by whoever knows Power Platform. Weak testing and review ([research §4](research/power-apps.md#4-where-power-apps-is-weak-and-where-engineers-feel-it)) | Code with tests, CI and review. Devin does most of the edits |
| Platform admin / CoE | You: environments, DLP, security roles, licence assignment, Dataverse capacity, solution pipelines, cleaning up abandoned maker apps. ~0.25–0.5 FTE at 13 apps (A6) | Part of the platform team's job (rows 1–17) |
| Integrations (Stripe, KYC vendor, flags) and reconciliation | Custom code | Custom code (same in both) |

**App-level work isn't equal either.** Every option has to change business rules and screens, so §4 leaves that work out. But it costs more per change in Power Fx: there's weak testing and review, few engineers are fluent in it, and Devin is less effective there than in TypeScript. Across 13 apps that difference compounds, and it is one of the main reasons to build.

**Accuracy.** Errors can come from three places, and the two options are not equally risky in each:
1. **Money movement** (amounts, partial refunds, idempotency, retries). This is custom code in *every* option, because the Stripe connector can't issue refunds (row 8). It stays accurate through tests and a daily reconciliation against Stripe. Code handles that better than Power Fx, and Power Apps adds nothing here.
2. **Reads and reporting** (queue counts, refund totals). Power Apps has a known way to be silently wrong: non-delegable queries cut off results on large tables. Code doesn't have that particular failure, but it has its own bugs, and tests have to catch them.
3. **Controls** (who can approve, four-eyes, complete audit, prompt deprovisioning). Power Apps gives you primitives that are tested and attested. In-house, a bug here is a control failure. Nobody notices it until an auditor or an incident finds it. **This is where in-house software is riskiest without a dedicated owner.**

So the risk of building isn't that code gets the sums wrong more often. It's that the controls around the money need a named team that owns them, and that team is the main cost in §4. Naming that team is precondition 1 in §5; without it, don't build.

**Policy and audit evidence are the client's job in both options.** Microsoft supplies the mechanisms and attests to its own infrastructure. The client still classifies PII, designs the access matrix, turns on auditing per table, runs access reviews and produces evidence. Devin can automate much of that checking and evidence work in either option, but can't own the controls ([audit-and-data-access.md](research/audit-and-data-access.md)).

## 3. Why build, and the strongest objections

**For building**
- **Refunds and flags need custom code anyway.** The Stripe connector can't issue refunds and there's no certified LaunchDarkly connector ([research §2](research/power-apps.md#2-mapping-their-three-apps-onto-power-apps), [MOCKED.md](MOCKED.md) row 8). Under Power Apps, engineers write that code and then maintain a Power Apps layer on top of it.
- **Power Apps isn't fire-and-forget.** Environments, DLP, roles, licences, solution pipelines, release waves and abandoned maker apps all need an owner (§2, A6).
- **App #N is cheap and testable.** Every app is a module in one monorepo with the same workflow engine, audit and permission checks. App #3 was one Devin session from the playbook. Business-rule changes get unit tests and code review instead of Power Fx edits.
- **No customisation ceiling.** Integration-heavy apps, custom UX and large tables don't hit Power Fx, delegation or connector limits ([research §4](research/power-apps.md#4-where-power-apps-is-weak-and-where-engineers-feel-it)).
- **Cost doesn't scale per user.** Premium is $240/user/yr at list price, so each extra 100 app users adds ~$24K/yr. The platform's cost barely moves with headcount.
- **No lock-in.** Logic, data and workflows are ordinary TypeScript and SQL that the company owns.

**Objections, and how the plan handles them**
- **"You lose Microsoft's security stack."** Partly. Identity, MFA and Conditional Access stay on Entra. What we rebuild is Dataverse roles and field security, audit history and DLP-style controls (rows 4–7, 14). Mitigation: pen test before go-live, internal tools added to SOC 2 scope, Devin-generated policy tests and evidence ([audit-and-data-access.md](research/audit-and-data-access.md)).
- **"Owning costs more than the licence."** At today's headcount it can. The cheapest realistic build is ~$300–495K/yr against ~$300–375K for Keep (§4). The ranges overlap, and the gap narrows as app users grow. We accept that premium for the reasons above.
- **"App #N changes the platform under every other app."** True. While adding app #3, Devin found and fixed a bug in a shared form component every app uses. Mitigation: the platform owner reviews every `packages/platform` change, CI runs every app's tests, and there's a clear line on what belongs in the platform versus an app.
- **"Nobody outside engineering can edit the apps."** True. If ops or compliance staff need to change forms themselves ([open question 3](research/power-apps.md#6-questions-for-the-client-before-recommending)), those apps stay in Power Apps (§5).
- **"Dependencies churn."** True. On its first run, Dependabot opened 5 update PRs on the prototype; one (TypeScript 7) had to be deferred, one needed a config change and a code fix (MOCKED row 16). Devin does the upgrades; an engineer reviews them.

## 4. Rough cost model (all numbers are assumptions)

Assumptions. Replace each with your own figure.
- **A1** Fully loaded engineer: $200–250K/yr [assumption].
- **A2** Platform ownership: 1–2 FTE with no existing platform team, 0.5–1 FTE if you already run SSO, audit and hosting (from [MOCKED.md](MOCKED.md#what-this-means-for-the-decision)) [assumption].
- **A3** Security/compliance: 0.25–0.5 FTE, plus a $20–40K/yr pen test [assumption].
- **A4** Hosting, DB, logging/SIEM: $10–30K/yr [assumption].
- **A5** Devin: $20–50K/yr [placeholder]. Seats are cheap: a Teams full seat is $40/month, and flex seats are free and draw from shared on-demand credits ([Devin docs](https://docs.devin.ai/admin/billing/self-serve)). The real cost is usage. Enterprise plans (which add SSO and RBAC) bill usage in ACUs at contract prices, and those prices aren't public ([Devin docs](https://docs.devin.ai/desktop/accounts/usage)). Replace this with a quote based on expected session volume.
- **A6** Power Platform admin/CoE work if you keep it: 0.25–0.5 FTE at ~13 apps [assumption]. Covers environments, DLP, roles, licences, solution pipelines and Microsoft's release-wave changes. Higher if nobody on staff knows Power Platform.
- Excluded: app-level work (business rules, screens, connectors), because every option needs it. Devin lowers it in Build and Hybrid, and §2 explains why it is cheaper per change in code.

| Annual, steady state | Build (already have a platform team) | Build (no platform team) | Keep | Hybrid |
|---|---|---|---|---|
| License | $0 | $0 | $250K | same as Keep |
| Platform ownership (A2) | $100–250K | $200–500K | — | — |
| Security/compliance (A3) | $70–165K | $70–165K | (mostly inherited) | (mostly inherited) |
| Hosting (A4) | $10–30K | $10–30K | — | — |
| Admin (A6) | — | — | $50–125K | $50–125K |
| Devin (A5) | $20–50K | $20–50K | — | $20–50K |
| **Total** | **~$200–495K** | **~$300–745K** | **~$300–375K** | **~$320–425K** |

**Put simply: is the platform worth one engineer?** $250K/yr is about one fully loaded senior engineer (A1). The cheapest realistic build is that one engineer owning the platform with Devin doing most of the upkeep. Add security/compliance time, hosting and Devin from the table and you get ~$300–495K/yr, at or above Keep (~$300–375K with admin time). The case for building isn't that it's cheaper today. It's that the spend goes into a platform the company controls, apps 4–13 ship faster, and cost doesn't grow per user. One owner is a single point of failure for controls over money and PII, so name a backup owner as well [judgment]. Devin is the small line in every column. It makes the engineers more productive, but it can't be the accountable owner.

Year one of Build also includes the one-off production build (2–4 engineer-months of review and integration on top of Devin, ~$35–85K [assumption]) and paying the license while both systems run side by side.

## 5. Preconditions, and what would reverse this

**Build only if all three hold:**
1. **A named platform owner, plus a backup, before production code.** If nobody can be named, stay on Power Apps and use Devin for connectors and code apps (the Hybrid column).
2. **Engineers are the only editors of the apps being migrated.** Apps that ops or compliance staff edit themselves stay in Power Apps.
3. **Identity stays on Entra (or Okta) through OIDC and SCIM.** We don't build our own identity system.

**These make building stronger:**
- You already run SSO, centralised audit logs and on-call for product services (cost drops to ~$200–495K/yr, §4).
- App users grow quickly.
- Apps 4–13 are mostly integration-heavy rather than queue → review → approve.
- You hit Dataverse or delegation limits on real data.

**Reverse course if:**
- the owner leaves and isn't replaced within a quarter;
- the pen test or first audit finds control failures that can't be fixed within one cycle;
- the migration stalls with both systems running for more than two quarters [assumption].

## 6. Next steps

1. Name the platform owner and backup. Confirm open questions 2–4 (who maintains the apps today, who edits them, which identity provider).
2. Make the platform production-grade first: Entra sign-in, groups and SCIM (MOCKED rows 1–3), audit shipped to WORM storage or a SIEM (row 7), hosting, database, secrets and on-call (rows 11–15), and the real Stripe adapter with webhooks and daily reconciliation (row 8). Devin writes the code; engineers review every auth, audit and payment change.
3. Pen-test it and add it to SOC 2 scope.
4. Migrate one app at a time with Power Apps still running: flags first (no PII, engineers are the users), then refunds, then KYC last. For flags, check whether the vendor's own UI already covers it.
5. Build apps 4–13 from the [playbook](NEW_APP_PLAYBOOK.md). Devin handles dependency upgrades, CVE patches, tests and evidence scripts; humans own the pager and the auditor.
6. Turn off Power Apps after one clean audit cycle on the new platform, except for any apps non-engineers must keep editing.
