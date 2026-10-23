# Audit, PII and data-access policy: what each option leaves to the client

**Short version:** Power Apps gives better *mechanisms*, but it doesn't write the client's data-access policy or prove
to an auditor that the policy is followed. That work is roughly the same in both options. Building adds *implementing and
running* the controls. Power Apps adds *configuring* them correctly. Devin can do much of the evidence and checking work
in either option, but it can't own a control.

## 1. Shared responsibility: who does what

| | Microsoft (Power Apps) | Client, in either option |
|---|---|---|
| Physical/infra security, runtime patching, platform attestations (SOC 1/2, ISO 27001) | Yes | — |
| Control *mechanisms*: security roles, field security, audit logging, DLP, access reviews | Provided | Built and run, if they build |
| Deciding what is PII and who may see it | — | Yes |
| Turning those decisions into roles, field security and masking | — | Yes |
| Switching auditing on for each sensitive table and column, and setting retention | — | Yes [verify per table in the target environment] |
| Running access reviews, deprovisioning leavers | Tooling (Entra ID Governance) | Yes, doing it |
| Evidence for their own SOC 2 / bank-partner audits | Attestations for Microsoft's part only | Yes |

A misconfigured Power App leaks the same as custom code. In 2021 UpGuard reported about 38M records exposed through Power
Apps portals whose data lists were publicly readable by default. Microsoft changed the default afterwards; the lesson is
that configuration is the client's job.

## 2. What the policy has to contain (both options)

1. **Classification.** Restricted: SSN/national ID, date of birth, ID document images, selfies, full bank/card numbers.
   Confidential: name, email, address, phone, transaction history. Internal: everything else.
2. **Access matrix.** Role → records (all? own queue? own region?) → fields (masked/revealed) → read/write. Least privilege.
3. **Grant, review, revoke.** Who approves access to `kyc_senior`/`finance_manager`/`admin`; quarterly reviews; leaver
   access removed within an SLA; a logged break-glass procedure.
4. **Minimization.** Masked by default, reveal on demand with a reason, rules on exports, downloads, screenshots and copying
   into tickets/Slack.
5. **Logging.** Writes *and* reads of restricted fields, who/when/why, stored where the people being logged can't change it.
   Dataverse auditing records changes; logging reads needs Purview activity logging [verify licensing].
6. **Retention vs deletion.** US KYC (CIP) records must be kept five years after the account closes. That conflicts with
   privacy deletion requests (GDPR/CCPA), so the policy needs an explicit rule for which one wins and when.
7. **Encryption and sharing.** At rest/in transit, key management, and what goes to the KYC vendor, Stripe and BI tools.
8. **Incident response.** What counts as a PII incident, who is told, notification deadlines.
9. **Evidence.** What the auditor receives each period: access-review sign-offs, audit-log samples, change approvals.

## 3. Where Devin helps, in either option

| Task | Build | Power Apps / Hybrid |
|---|---|---|
| Draft the classification | Scan the SQL schemas for likely PII columns | Scan Dataverse table/column metadata via the Web API |
| Access matrix from what's deployed, diffed against the policy | Generate from each app's declared roles (`AppModule.roles` in the prototype) | Export security roles and field security profiles (solution export / Web API) |
| Policy as tests | Already in the prototype: SSN never in audit JSON, analyst can't reveal, permissions enforced server-side | Tests for code apps and connectors; config checks for the rest |
| Config drift checks, on a schedule | Same checks against their own infra | Auditing on for every restricted table, DLP policies intact, nothing public |
| Evidence packs | Scripts that pull access reviews, audit samples, Git change history | Same, from the Power Platform admin APIs and solution history |
| Change review | Review PRs against the policy | Review solution/Power Fx changes exported to Git |

## 4. What Devin can't do

- **Own or attest to a control.** The auditor wants a named person who is accountable.
- **Be exempt from the policy.** Devin is itself an identity with access, so it gets least privilege and works on
  synthetic or masked data, never production PII.
- **Sign off its own output.** Generated evidence and access matrices still need human review before they go to an auditor.

## 5. Effect on the recommendation

The policy and evidence work is similar for both options, so it doesn't favour building. Building adds implementing,
hosting and on-call for every control (MOCKED.md rows 1–7, 11–17). Devin cuts the evidence and checking work in both,
which matters most for Build, where the client produces the evidence for every control itself.
