# Recommendation: keep Power Apps, cut the bill, use Devin for the code

**For:** VP of Engineering. **Status:** draft, pending the invoice breakdown and answers to the [open questions](research/power-apps.md#6-questions-for-the-client-before-recommending).

Keep Power Apps for the KYC queue and the queue-and-approval apps that follow it. First get the $250K invoice broken down, because it looks too high for your size and right-sizing it probably saves more, at lower risk, than replacing it. Use Devin for the code Power Apps does badly: the Stripe refund backend, the flag-service connector, and new apps written as Power Apps code apps. Building your own platform is technically easy (Devin built a working prototype of one in about two hours), but it turns a license into a team you staff permanently. At your size that team costs about the same as the license, or more.

Notation: **[inference]** = my read, not confirmed with you. **[assumption]** = a number I picked so the model can be calculated. Replace it with yours.

## 1. The three options

| | **Build with Devin** | **Keep Power Apps** | **Hybrid** (Power Apps + Devin-written code apps / connectors) |
|---|---|---|---|
| License / build cost | License goes away. One-off build of the platform layer ([MOCKED.md](MOCKED.md) rows 1–7, 11–17) plus Devin usage | ~$250K/yr today, probably reducible ([research §3](research/power-apps.md#3-cost-reality)). Apps 4–13 add ~$0 if the same people use them | Same license as Keep, plus Devin usage |
| Ongoing maintenance & ownership | You own sign-in, roles, audit storage, hosting, DB, secrets, DLP, on-call and patching for good. ~1–2 engineers (§3) | Microsoft runs the platform. You own app logic, custom connectors, and the Power Platform admin work | Same as Keep, plus the code apps and connectors, which are normal code in Git |
| Security & compliance | Every control is yours to build, test and evidence. The auditor talks to you, not to Microsoft's attestations | Inherits Entra/Conditional Access, Dataverse roles and field security, audit, DLP ([research §1](research/power-apps.md#1-the-parts-of-power-apps-that-matter-for-this-team)). You still scope your own configuration | Same as Keep. Code apps run inside Power Platform governance |
| Speed to ship apps 4–13 | Slow until the platform is production-grade, then fast: app #N is one Devin session from the [playbook](NEW_APP_PLAYBOOK.md) plus review (*feature-flag playbook result pending*) | Fast for queue/approve/audit apps (model-driven + queues + approvals). Slow for integration-heavy apps. Depends on having someone fluent in Power Platform [inference] | Fast for both kinds: queue apps model-driven, custom ones as Devin-written code apps |
| Customisation / UX ceiling | Unlimited | Low to medium. Power Fx, delegation limits ([research §4](research/power-apps.md#4-where-power-apps-is-weak-and-where-engineers-feel-it)) | High. React/TS inside the governed platform |
| Vendor lock-in | Lowest, apart from your cloud provider | Highest. Power Fx, flows and the Dataverse model don't move | Medium. Logic in code apps/connectors is portable; data and governance stay on Microsoft |
| Engineering opportunity cost | 1–2 engineers moved off product for good, plus security/compliance time | Lowest | Low. Engineers write code where it pays off, with Devin doing most of it |

## 2. The best case for building, and my answer to each point

**"Power Apps is lock-in."** True for Power Fx, flows and the Dataverse schema. *Answer:* keep the lock-in thin rather than leaving. Put business logic in Devin-written connectors, Azure Functions and code apps, which is normal code that can be moved later. The governance layer (Entra) is probably your identity provider anyway [inference; open question 4], so you'd keep using it even if you built. Lock-in gets worse with every Power Fx app you build, so it should shape *how* you build apps 4–13, not whether you keep the platform.

**"Dataverse and delegation limits will bite."** Non-delegable Power Fx queries silently return only the first 500–2,000 rows, which gives wrong answers on big tables ([research §4](research/power-apps.md#4-where-power-apps-is-weak-and-where-engineers-feel-it)). *Answer:* this is a canvas-app / Power Fx problem. Model-driven views and code apps query on the server [my understanding; verify on one real table]. Refund analytics belongs in your warehouse or BI tool anyway. *It depends on* whether apps 4–13 are queue workflows (fine) or large-table analytics (a real problem, and a reason to use code apps or BI for those apps, not to rebuild the platform).

**"Per-user pricing grows with headcount."** True: Premium is $240/user/yr at list price, and a build's cost barely changes with user count. *Answer:* the break-even is a user count you can calculate. At the §3 assumptions, an owned platform costs ~$200K–$750K/yr, which equals ~830–3,100 Premium users at list price, before any EA discount or the $12 tier at 2,000+ seats. *It depends on* how many people actually use the apps today and in two years. The invoice tells us the first number.

**"Refunds and flags already need custom code."** Very likely true. The Stripe connector can't issue refunds and there's no certified LaunchDarkly connector ([research §2](research/power-apps.md#2-mapping-their-three-apps-onto-power-apps), [MOCKED.md](MOCKED.md) row 8). *Answer:* this is code you write in every option, and it's where Devin fits best. It doesn't remove the need for the parts around it: sign-in, roles, approvals and audit. For the flag panel specifically, the flag vendor's own UI may make a custom app unnecessary in *any* option [inference].

**"We already run auth and audit for our product."** This is the strongest point. *Answer:* if it's true, the cost of rows 1, 3, 7 and 11–16 drops a lot. What's left is per-record and per-field authorisation, masking, approvals, access reviews, and putting internal tools in SOC 2 scope (rows 4–6, 10, 17). *It depends on* whether you already have: OIDC SSO on internal services, audit logs shipped to a SIEM or WORM store, a platform team with on-call, and internal services already in audit scope. If all four are true, see §4.

**"Devin makes platform code cheap."** True. The prototype covers most of the logic of two apps plus a shared platform, and each row in MOCKED.md is days of Devin work, not months. *Answer:* code was never the main cost. The main cost is what comes after it: someone who understands the auth and audit code well enough to approve changes to it, carries the pager, and explains it to an auditor. Devin does reduce that work (dependency upgrades, CVE patches, tests, evidence scripts), which is why the low end of §3 is 1 engineer and not 2. It doesn't get it to zero.

## 3. Rough cost model (all numbers are assumptions)

Assumptions. Replace each with your own figure.
- **A1** Fully loaded engineer: $200–250K/yr [assumption].
- **A2** Platform ownership: 1–2 FTE with no existing platform team, 0.5–1 FTE if you already run SSO, audit and hosting (from [MOCKED.md](MOCKED.md#what-this-means-for-the-decision)) [assumption].
- **A3** Security/compliance: 0.25–0.5 FTE, plus a $20–40K/yr pen test [assumption].
- **A4** Hosting, DB, logging/SIEM: $10–30K/yr [assumption].
- **A5** Devin usage: $20–50K/yr [placeholder; replace with quoted pricing].
- **A6** Power Platform admin work if you keep it: 0.1–0.25 FTE [assumption].
- Excluded: app-level work (business rules, screens, connectors), because every option needs it. Devin lowers it in Build and Hybrid.

| Annual, steady state | Build (already have a platform team) | Build (no platform team) | Keep | Hybrid |
|---|---|---|---|---|
| License | $0 | $0 | $250K today; right-sized unknown | same as Keep |
| Platform ownership (A2) | $100–250K | $200–500K | — | — |
| Security/compliance (A3) | $70–165K | $70–165K | (mostly inherited) | (mostly inherited) |
| Hosting (A4) | $10–30K | $10–30K | — | — |
| Admin (A6) | — | — | $20–60K | $20–60K |
| Devin (A5) | $20–50K | $20–50K | — | $20–50K |
| **Total** | **~$200–495K** | **~$300–745K** | **~$270–310K today** | **~$290–360K today** |

Year one of Build also includes the one-off production build (2–4 engineer-months of review and integration on top of Devin, ~$35–85K [assumption]) and paying the license while both systems run side by side.

**The $250K looks too high.** It equals ~1,040 Premium seats at list price, which seems a lot for a company with ~60 engineers ([research §3](research/power-apps.md#3-cost-reality)). It probably bundles Dataverse capacity, Power Automate, Power BI, partner fees or an EA [inference]. **Ask for:** the invoice split by SKU and seat count; active users per app over the last 90 days (Power Platform admin center); Dataverse storage used vs. bought; Power Automate Process/bot licences; any Power BI or partner line items; and the EA renewal date and terms. If real usage is a few hundred users, the right-sized license could be well under $250K [inference], and every row above should be compared against *that* number.

## 4. What would flip this to "build"

Build wins if **1 or 2** is true **and 3** is true. Items 4–6 each make building more attractive, but none of them is enough by itself:
1. **You already run the platform.** All four items in the "auth and audit" answer in §2 exist and are staffed.
2. **The right-sized license is still above the ownership cost.** That means real users above the break-even in §2 and growing, and Microsoft won't discount.
3. **No one outside engineering edits the apps** ([open question 3](research/power-apps.md#6-questions-for-the-client-before-recommending)), so the citizen-developer value is zero.
4. Apps 4–13 are mostly integration-heavy, not queue/approve/audit.
5. You hit Dataverse or delegation limits on real data that code apps don't fix.
6. You aren't an Entra/M365 company, so Power Apps means running a second identity stack.

## 5. Next steps

**If you keep Power Apps (recommended):**
1. Get the invoice breakdown and right-size before renewal: move per-app users to the right SKU, drop inactive seats, trim Dataverse capacity.
2. Devin builds the refund backend properly: Stripe SDK, restricted key in a secrets manager, idempotency, webhooks, daily reconciliation (MOCKED row 8), exposed to Power Apps as a custom connector.
3. Decide whether the flag panel should exist at all, or whether the vendor UI plus its audit log is enough. If it stays, Devin writes the connector.
4. Pilot app #4 as a **code app** written by Devin. Measure time to ship and check that DLP, Entra and audit still apply. That number decides how apps 5–13 get built.
5. Devin sets up ALM: solutions exported to Git, tests and pipelines, so Power Platform changes get code review.

**If you build:**
1. Confirm flip conditions 1–3 and name the team that owns the platform *before* writing production code.
2. Make MOCKED rows 1–3, 7 and 11–16 production-grade first, then pen-test and add them to SOC 2 scope. Devin writes the code; your engineers review every auth, audit and payment change.
3. Migrate the lowest-risk app first (the flag panel: no PII, engineers are the users), with Power Apps still running alongside. Do KYC last.
4. Devin builds each further app from the [playbook](NEW_APP_PLAYBOOK.md) and handles ongoing upgrades, CVE patches and test coverage. Humans own the pager and the auditor.
5. Turn off Power Apps only after one audit cycle passes on the new platform.
