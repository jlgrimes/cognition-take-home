# Power Apps research: how it maps to the client's internal apps

Scope: not "what is Power Apps" in general, but how it plays into this client's three existing apps (KYC review queue, refunds dashboard, feature-flag admin panel) and the 10+ planned ones, and where the $250K/yr really goes.

Notation: **[doc]** = stated in Microsoft/vendor docs (linked in Sources). **[inference]** = my read, needs confirming with the client.

---

## TL;DR

1. **The value isn't the UI builder, it's the platform underneath.** Dataverse (data + row/column security + audit), Entra ID SSO/Conditional Access, DLP policies, Managed Environments, approvals. That's what a fintech's compliance team leans on. Screens are the cheap part.
2. **License cost scales with users, not apps.** Power Apps Premium is $20/user/mo for *unlimited* apps [doc]. Going from 3 to 13 apps costs ~$0 more in licenses if the same people use them. So the savings case is "kill the existing bill," not "avoid a growing bill."
3. **$250K doesn't line up with 60 engineers.** $250K / ($20 × 12) ≈ 1,040 Premium seats. A Series C fintech probably doesn't have that many app users, so the bill likely includes Power Automate, Dataverse capacity, Power BI, a partner, or an EA bundle [inference]. **Get the invoice breakdown first.** It changes the math.
4. **Two of their three apps hit the platform's weak spots.** The Stripe connector has no refund action and its connection can't be shared [doc]. There's no certified LaunchDarkly connector [doc]. So the refunds and feature-flag apps almost certainly already depend on custom connectors or their own backend, meaning engineers are already writing and maintaining code *for* Power Apps [inference].
5. **Microsoft itself is going code-first.** "Code apps" (React/TS SPAs hosted on Power Platform) went GA Feb 2026, and generative pages produce React code, with Microsoft recommending GitHub Copilot CLI as the authoring tool [doc]. That opens a **hybrid path**: Devin writes code, Power Platform keeps hosting and governance.

---

## 1. The parts of Power Apps that matter for this team

| Capability | What it gives them | Why a fintech cares |
|---|---|---|
| **Dataverse** | Managed relational store with security roles, business units, record sharing, **column-level security + regex masking** (masking needs Managed Environments) [doc] | PII (SSN, ID numbers, bank details) in KYC; least-privilege access is an audit item |
| **Dataverse auditing** | Who changed which field, old/new value, user access logs; feeds Microsoft Purview [doc] | SOC 2 / regulator questions like "who approved this refund?" get answered with no extra work |
| **Model-driven apps** | CRUD/forms/views generated from the data model, **queue tables** (assign/pick/release, private queues, audited) [doc], **business process flows** (staged workflows) | Basically a KYC review queue out of the box |
| **Power Automate + Approvals** | Triggered flows, sequential/multi-stage approvals, actionable Outlook/Teams approvals [doc] | Maker-checker (4-eyes) on refunds over a threshold |
| **Connectors** | 1,500+ connectors, custom connectors from OpenAPI [doc] | Glue to Stripe, Salesforce, SQL, internal APIs |
| **Governance** | Entra ID auth, Conditional Access per app, DLP connector policies, Managed Environments (sharing limits, IP firewall, CMK, solution checker, pipelines) [doc] | Security team gets central control over who builds what and which data goes where |
| **Citizen dev** | Ops/compliance staff can tweak forms/views without engineering | Real if ops actually does this today. **Ask.** |
| **AI authoring** | "Vibe" plan designer, generative pages (prompt → React code) [doc] | Microsoft is moving onto Devin's turf |

## 2. Mapping their three apps onto Power Apps

### KYC review queue (best fit for Power Apps)
- Probably a **model-driven app on Dataverse** [inference]: case table → queue items → reviewer picks/assigns → business process flow stages (Docs received → Review → Escalate → Decision).
- Built-in pieces it uses: **queues** (assignment, no double-work, audit), **column security + masking** on SSN/document numbers, **file capacity** for ID images, **audit history** on every decision [doc].
- Integration gap: no mainstream KYC vendor connector (Onfido/Persona/Alloy). The only KYC connector listed is "IN-D KYC India" (Preview) [doc]. Vendor results arrive via custom connector, webhook → Power Automate, or a backend job [inference].
- **Replicating it in code means rebuilding:** RBAC, field-level PII masking, an immutable audit log, queue assignment semantics, and document storage. Nothing hard, but it all has to be done *correctly*, and it's exactly where an auditor will look.

### Refunds dashboard (weak fit)
- The **Stripe connector is Premium and only has actions for customers and products. No refund create/list** [doc]. Its triggers are "charge/customer/invoice item/order added." Throttle is 100 calls/60s per connection, and the **connection isn't shareable**: every app user gets prompted for their own Stripe API key [doc].
- So in practice it's probably SQL/warehouse reads + a **custom connector or Azure Function** that issues refunds + **Power Automate approvals** for amounts over a threshold [inference]. The hard part (money movement, idempotency, Stripe auth) already lives in code.
- Charts are either Power Apps' basic charts or embedded Power BI (separate license) [inference].

### Feature-flag admin panel (worst fit)
- No certified LaunchDarkly connector. There's only an *open* independent-publisher PR (Mar 2026) [doc]. Either it's a custom connector to their flag service or a Dataverse/SQL table that services poll [inference].
- This is the most engineering-native tool of the three: the users are engineers, the data sits next to code, and changes should be reviewable and tied to deploys. Power Apps adds the least here, and the flag vendor's own UI may already cover it.

### The 10+ new apps
Without the list, assume the usual fintech back-office set: chargebacks/disputes, AML alert triage, merchant onboarding, ledger adjustments, payout holds, support tooling. **Nearly all of them follow the KYC pattern**: a queue of records, a detail view, an action needing permission, an approval above a threshold, an audit trail. That shared shape is what a build approach has to make cheap.

## 3. Cost reality

List prices (USD, annual billing) [doc]:

| Item | Price |
|---|---|
| Power Apps Premium | $20/user/mo, unlimited apps ($12 at 2,000+ seats) |
| Power Apps per app | $5/user/app/mo |
| Per-app pay-as-you-go | $10/active user/app/mo |
| Power Automate Premium | $15/user/mo |
| Power Automate Process (unattended bot) | $150/bot/mo |
| Dataverse DB capacity add-on | $40/GB/mo (file: $2/GB, log: $10/GB) |

Observations:
- **13 apps on per-app licensing costs more than Premium** ($65 vs $20/user/mo for a user of all 13). They'd move to Premium, and from then on new apps add nothing to license cost.
- **~1,040 Premium-seat equivalents for $250K** is a lot for this company size, so the bill probably includes Dataverse capacity (audit logs and KYC documents add up), Power Automate Process bots, Power BI, or implementation partner fees [inference]. If part of it is partner fees, that's the portion Devin replaces most directly.
- Reference point for the "buy something cheaper" option: Retool Business is $50/builder + $15/internal user per month; Git source control and SSO need Enterprise [doc].

## 4. Where Power Apps is weak (and where engineers feel it)

- **Delegation limits.** Non-delegable Power Fx queries silently cap at the first 500 rows (configurable up to 10,000) and can **return wrong results** on bigger tables [doc]. That's a real correctness risk for refunds/ledger-style data.
- **ALM/source control is late and Azure-DevOps-centric.** Native Git integration syncs to Azure DevOps Git; "deploy from Git" in pipelines is a 2026 wave-1 preview [doc]. Code review, testing, and CI aren't native the way they are for normal code.
- **Connector ceilings** (above): missing actions, per-connection throttles, non-shareable connections. Anything serious turns into a custom connector, i.e. code anyway.
- **Lock-in.** Data model, logic (Power Fx), and flows aren't portable.
- **Talent fit.** A 60-engineer team probably has few Power Platform specialists. Each app then gets built by whoever can tolerate it, or by a partner [inference].

## 5. What this means for the prototype

To be a fair comparison, the prototype should replicate the **platform** (what makes app #4–#13 cheap and safe), not three pretty screens:

1. **Auth + RBAC** with roles per app and field-level PII masking.
2. **Append-only audit log** on every mutation (who / what / before / after).
3. **Queue + approval primitives**: assign/claim, state machine, maker-checker above a threshold.
4. **Connector pattern**: one typed adapter (e.g. mock Stripe refunds) with secrets kept server-side.
5. **App template + Devin playbook** so "build app #4" is a single Devin session against a known scaffold. This is the actual answer to "10 more apps."

Then show KYC queue (or refunds) as the first app built on it, and time how long Devin takes to add a second one.

**Hybrid option worth raising in the recommendation:** Devin writes **Power Apps code apps** (React/TS) that keep Entra/DLP/Dataverse governance, which cuts the platform-rebuild risk while still getting code-first velocity. This one is real, and Microsoft is clearly steering toward it.

## 6. Questions for the client (before recommending)

1. Invoice breakdown of the $250K: seats by SKU, Dataverse capacity, Automate, Power BI, partner fees?
2. Who builds and maintains the 3 apps today: engineers, ops, or a partner?
3. Do non-engineers modify apps themselves? How often?
4. Is Microsoft 365/Entra their identity backbone anyway (so SSO/CA stays either way)?
5. Compliance scope: SOC 2, PCI, state money-transmitter exams? Who audits app access?
6. What are the 10 planned apps, and how many follow the queue/approve/audit pattern?
7. Do the refunds and flag apps already use custom connectors or their own APIs?

## Sources

- Pricing: https://www.microsoft.com/en-us/power-platform/products/power-apps/pricing · Licensing deck (Jun 2025): https://cdn-dynmedia-1.microsoft.com/is/content/microsoftcorp/microsoft/final/en-us/microsoft-brand/documents/Power-Platform-Licensing-Deck-June-2025.pdf · Licensing guide (Jan 2026, Dataverse add-ons): https://cdn-dynmedia-1.microsoft.com/is/content/microsoftcorp/microsoft/bade/documents/products-and-services/en-us/bizapps/Power-Platform-Licensing-Guide-January-2026-PUB.pdf · Power Automate licensing: https://www.microsoft.com/licensing/guidance/Power-Platform
- Queue tables: https://learn.microsoft.com/en-us/power-apps/developer/data-platform/queue-entities
- Approvals connector: https://learn.microsoft.com/en-us/connectors/approvals/ · Sequential approvals: https://learn.microsoft.com/en-us/power-automate/sequential-modern-approvals
- Stripe connector: https://learn.microsoft.com/en-us/connectors/stripe/
- LaunchDarkly connector PR: https://github.com/microsoft/PowerPlatformConnectors/pull/4142
- IN-D KYC connector: https://learn.microsoft.com/en-us/connectors/indkycindia/
- Security/governance: https://learn.microsoft.com/en-us/power-platform/admin/governance-considerations · DLP: https://learn.microsoft.com/en-us/power-platform/guidance/adoption/dlp-strategy · Managed Environments: https://learn.microsoft.com/en-us/power-platform/admin/managed-environment-overview · licensing: https://learn.microsoft.com/en-us/power-platform/admin/managed-environment-licensing
- Column security / masking: https://learn.microsoft.com/en-us/power-platform/admin/column-level-security-example · https://learn.microsoft.com/en-us/power-platform/admin/create-manage-masking-rules
- Auditing: https://learn.microsoft.com/en-us/power-platform/admin/manage-dataverse-auditing · Purview: https://learn.microsoft.com/en-us/power-platform/admin/activity-logging-auditing/activity-logs-dataverse-model-driven-apps
- Delegation: https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/delegation-overview
- ALM / Git: https://learn.microsoft.com/en-us/power-platform/architecture/reference-architectures/enterprise-power-platform-alm · https://learn.microsoft.com/en-us/power-platform/release-plan/2026wave1/power-platform-governance-administration/deploy-git-pipelines-power-platform
- Code apps: https://learn.microsoft.com/en-us/power-apps/developer/code-apps/overview · GA blog: https://www.microsoft.com/en-us/power-platform/blog/power-apps/generally-available-host-and-run-code-apps-in-power-apps/
- Generative pages / vibe: https://learn.microsoft.com/en-us/power-apps/maker/model-driven-apps/generative-pages · https://www.microsoft.com/en-us/power-platform/blog/power-apps/introducing-the-new-power-apps-generative-power-meets-enterprise-grade-trust/
- Retool pricing: https://retool.com/pricing
