---
type: Law Topic
title: Prepare your first security policy
description: >-
  Prepare an editable security and acceptable-use policy from maintained forms,
  plus a short decision list and honest delivery notes for a customer security
  review.
resource: 'https://openagreements.org/practice-guides/security-compliance-program/us'
timestamp: '2026-09-25'
tags:
  - security-compliance-program
---

# Prepare your first security policy[^about]

Prepare an editable security and acceptable-use policy from maintained forms, plus a short decision list and honest delivery notes for a customer security review.

Start with the [Information Security and Acceptable Use Policy](/templates/openagreements-information-security-policy). It supplies editable rules for staff access, devices, data handling, remote work, incident reporting and joining or leaving the company. This first form is for a small business that needs a concrete security document, often because a prospective customer has requested one. It is not a complete compliance library.

Prepare a populated draft using the company's facts, preserve unresolved choices visibly and give the company the document itself. A short internal decision list accompanies the draft; it does not replace it. If an existing policy is available, propose changes to that policy instead of creating a competing version.

A 2011 *Journal of Accountancy* article describes SOC 2 Type II reporting as including an opinion on whether controls operated effectively; possessing documents alone cannot establish that result. A framework can organize the work, but it is not a substitute for its applicable requirements. [^soc-operating-effectiveness]

## How do we establish the scope? {#establish-scope}

**Short answer.** A company's first information security policy is scoped to the legal, regulatory and contractual cybersecurity requirements that apply to the business, which NIST's small-business guide tells businesses to understand. [^nist-requirements-scope] Scoping records the service, systems, people, locations and information the policy will cover, and separately the requesting customer's deliverable and deadline.

The workflow and template choices are editorial recommendations, not prescribed ISO or AICPA forms. Begin with the buyer's actual request and deadline: an internal policy, a completed questionnaire, a SOC report and an ISO certificate are different deliverables.

Ask what service the company provides, which systems, people, locations and data support it, and what customer commitments or regulatory obligations it has identified. Establish whether the immediate objective is internal improvement, ISO certification preparation, SOC 2 preparation, or a customer request. Record the intended scope and any proposed dates as unconfirmed until the responsible people confirm them.

Ask what already exists before proposing another document. Request only materials the user authorizes for this task. A list of titles and statuses may be sufficient initially; do not ask for passwords, personal records or raw customer data to create a policy plan.

Ask a compact first round: company and service scope; accountable security role; approved work services and device approach; incident-reporting contact; existing policy and adoption status. Fill known facts immediately. For a missing administrative choice, propose a clearly labeled value in the decision list and leave a visible unresolved field in the policy. Never invent a working incident contact, approval or effective date. Missing facts should not prevent delivery of a clearly marked draft.

## What should we inventory before drafting? {#inventory-existing-work}

**Short answer.** Before drafting a first information security policy, a company inventories its existing cybersecurity program so that, as NIST's small-business guide recommends, the program's effectiveness can be assessed and areas that need improvement identified. [^nist-program-assessment] The inventory records existing policy versions, owners, scope and adoption status, separately from the procedures and records that may show implementation.

For each existing policy or procedure, record its title, location, version, scope, owner, adoption status, last known review and related operational records. Separate receipt and inspection from document status: **reported to exist; contents not supplied**, **received but not examined**, or **examined for the stated purpose**. Separately record **draft**, **adoption reported**, **adoption supported by an inspected record**, or **revision proposed**. If the user reports adoption but supplies no record, preserve that statement and the evidence gap separately.

Separate the rule from its implementation. An access policy describes intended decisions; a provisioning procedure describes how to carry them out; an approval record may show one decision occurred. None alone establishes effectiveness throughout an audit period.

## Which policies should we consider? {#select-policy-set}

**Short answer.** A small company's first policy set covers the policies it needs to manage its cybersecurity risks, including acceptable use of business and employee-owned devices that access business resources, and NIST's small-business guide calls for those policies to be communicated, enforced and maintained. [^nist-acceptable-use][^nist-policy-review] This guide's editorial policy set groups governance, personnel and access, assets and data, suppliers, development and change, incident response, and recovery, adjusted to the company's actual scope.

The following seven families are an editorial grouping, not seven universally required documents or an ISO/SOC crosswalk. Combine related topics where that makes ownership and maintenance clearer; add or narrow coverage based on the actual scope.

| Candidate family | Decisions to resolve | Possible implementation records |
| --- | --- | --- |
| Security governance and risk | Who owns risk decisions and policy exceptions? | Risk decisions, exception approvals, management review notes |
| Personnel and access | Who requests, approves, changes and removes access? | Access requests, removal records, training records |
| Assets and data handling | Which assets and data need which safeguards? | Inventories, handling procedures, disposal records |
| Supplier security | Which suppliers matter most and who reviews them? | Supplier assessments, agreed responsibilities, follow-up records |
| Secure development and change | How are changes reviewed and exceptions handled? | Change approvals, testing records, release records |
| Incident response | Who coordinates response and communication? | Response plan, exercise findings, incident records |
| Continuity and recovery | What must be restored, by whom and against which objectives? | Recovery plan, restoration exercises, remediation records |

Use the table to propose coverage, not to assert that missing records prove failure. Record where evidence is unavailable and what would resolve the question. Retention periods, review frequencies, reporting duties and technical thresholds need their own applicable sources and company decisions; this guide supplies no universal defaults.

## How do we adapt policies to actual practices? {#adapt-policies}

**Short answer.** Policies are adapted to actual practice by comparing each commitment with the cybersecurity outcomes the company currently achieves and how it achieves them, which is what a NIST Cybersecurity Framework Current Profile records. [^nist-current-profile] The maintained policy form supplies the operative text; the company draft fills its declared fields and revises commitments the company cannot realistically implement, recording the resulting risk or alternative safeguard.

The template's baseline includes individual accounts, multi-factor authentication where supported, approved work services, device encryption and updates, access limited to work needs, and incident reporting. These are proposed safeguards, not claims that the company already operates them. NIST's small-business guide recommends multi-factor authentication and considering password managers; the template wording and exception process are editorial choices. [^nist-small-business-safeguards]

Use the maintained [policy form](/templates/openagreements-information-security-policy) and its declared fields. In the installed skill, the editable form is `assets/information-security-policy.md`; `manifest.json` records its canonical source hash and declared fields under `templateSource.fields`. The clean Markdown and Word downloads contain operative policy language; the field descriptions explain what to supply. Do not ask the customer to write the operative clauses themselves. Revise proposed commitments when they cannot realistically be implemented, and identify the resulting risk or needed alternative.

Keep the Company Policy Version distinct from the template's version. Set Status to Draft and Effective Date to Pending approval unless actual authorized approval is established. Naming an approving role does not mean that role approved the document. Choose the personal-device rule explicitly; permitting personal devices requires a workable removal process that does not sweep up unrelated personal information.

Do not insert blanket background checks, wage deductions, unrestricted monitoring consent, confidentiality restrictions or discipline promises merely because another form contains them. Those choices involve separate employment and privacy questions. The security policy does not replace a confidentiality/invention-assignment agreement or an employee handbook. It does not authorize monitoring or supply monitoring notices; confirm any separate notices or acknowledgments before implementing device safeguards. For contractors, align access requirements with the engagement terms rather than using the policy to change the engagement relationship.

Adoption, signature, access changes, external communications and uploads are separate actions, not effects of drafting. Route legal obligations to appropriate legal review and framework scope or testing questions to the relevant assurance specialist.

Before adoption, the decision list must identify any still-unselected password manager, endpoint protection or secure-access method, and map manager, system-owner and access-administrator duties to actual roles. In a small company one person may hold several duties; do not imply independent review that does not occur. If personal devices are prohibited, confirm how staff will complete multi-factor authentication and whether use of a personal authenticator is separately authorized. Remove the conditional sections titled Personal-Device Authorization and Personal-Device Departure from that company draft. An unknown policy register stays unresolved, not *None adopted*.

## Who owns and maintains the program? {#maintain-program}

**Short answer.** A company's security program is owned by the person within the business who is responsible for developing and executing its cybersecurity strategy, and NIST's small-business guide tells businesses to identify who that is. [^nist-sp1300-strategy-responsibility] This workflow records a proposed accountable role for each policy, the adoption decision still needed, and review triggers tied to the company's risks and obligations.

Record a proposed accountable role for each policy, an adoption decision still needed, and a review trigger with its reason. Triggers might include a material service change, a new customer obligation, an incident or findings from an exercise. Confirm any recurring schedule against applicable obligations and the company's risk decisions rather than choosing a fixed interval for every organization.

Use one maintained policy location. Keep the policy, its procedures and the evidence index linked; avoid circulating independent editable copies as if each were authoritative. Updates to the policy should prompt consideration of affected training, procedures and evidence expectations.

## What does the company receive? {#deliver-policy-plan}

**Short answer.** A company that commissions a first security policy receives an editable policy draft and a proposed customer message, so that it can communicate its cybersecurity policies to all staff and relevant third parties as NIST's small-business guide recommends. [^nist-communicate-policies] Specifically, it receives a populated, editable policy draft, a short internal handoff of unresolved decisions and implementation gaps, and a proposed message for the requesting customer.

Deliver the populated policy, not just instructions to create one. Use the user's chosen workspace; if no file destination is available, return the complete editable policy inline. Use the existing template renderer for a Word version when available.

The accompanying internal handoff contains only decisions still needed for this draft, significant implementation gaps, and a proposed customer-facing message. Keep the internal handoff separate from any external delivery. Adjust the following original example only to established facts; do not send it without authorization.

**Example draft message:** Attached is our draft security policy for discussion. It has not yet been approved or verified as implemented. We will confirm the outstanding items before representing it as current.

Identify the canonical form and revision used. Keep the original form, company draft and any eventual approved version distinguishable. Do not overwrite an adopted policy with an unapproved revision.

This installment supplies one policy, not the remaining specialized procedures. Supplier assessment, secure development, risk treatment, detailed incident response and tested recovery arrangements remain outside this form. A buyer asking for those items will need them separately. Clause-level ISO conformity and a full SOC criteria mapping have not been verified; no template count establishes coverage.

For an evidence item, record what was actually inspected, its date and limits. **Not examined** is not a passing result. Do not calculate a readiness percentage or announce ISO certification, SOC 2 success, or legal compliance from this planning exercise.

## What does this look like for a small SaaS company? {#small-company-example}

**Short answer.** A small SaaS company with modest or no cybersecurity plans uses its first security policy to kick-start a cybersecurity risk management strategy, which NIST's quick-start guide is written to help such businesses do. [^nist-small-business-audience] The synthetic example produces a draft for a six-person SaaS company, using its proposed roles, managed devices and work services without claiming approval or implementation.

**Synthetic facts:** Cedar Example LLC has six staff delivering a hosted scheduling service. Its operations lead owns security coordination and its managing member is the proposed approver. Staff use Company-managed laptops and the Company's managed email and shared document workspace. Personal devices are not permitted for work data. Access requests go through the internal operations queue; security reports go to security@cedar.example, with the operations lead's separately distributed emergency contact as backup. Those are fictional inputs, not live channels.

**Deliverable:** Populate the policy with those facts, Company Policy Version 0.1-draft, Status Draft and Effective Date Pending approval. Keep the next review date unresolved. Do not mark MFA, encryption, training or any other safeguard implemented merely because its requirement appears in the policy.

**Short decision list:** Confirm the emergency contact actually works; validate the scope and safeguard commitments; select the next review date; obtain the authorized adoption decision. If an older policy is later supplied, compare and reconcile it before adoption rather than asking staff to follow two competing documents.

**Hiring handoff:** Once a version is actually adopted, provide that exact version to affected staff and record delivery. A receipt should identify the person, policy title, version and delivered artifact, leaving actual acknowledgment and signature dates unasserted until obtained. Delivery, acknowledgment of responsibilities, employment agreement, training completion and operation of controls are different records.

## Does a drafted policy plan show that the controls work? {#continue-to-operation}

**Short answer.** A SOC 2 Type II report, not a drafted policy plan, gives an auditor's opinion on whether a company's security controls were operating effectively. [^soc-operating-effectiveness-later] Evidence that controls operate follows authorized adoption of the policies, delivery to affected staff, implementation of the chosen safeguards and inspection of how the safeguards operate.

NIST's small-business guide also calls for the adopted policies to be communicated, enforced and maintained. [^nist-policy-maintain]

The separate [SOC 2 readiness](/skills/soc2-readiness), [ISO internal-audit](/skills/iso-27001-internal-audit) and [evidence-collection](/skills/iso-27001-evidence-collection) skills address later, distinct tasks. They are legacy resources with separately maintained guidance, not generated parts of this policy guide or verified substitutes for applicable criteria.

The [privacy practice guide](/practice-guides/privacy) addresses separate legal questions; a public privacy notice is not an internal security policy. Use the [first-teammate toolkit](/toolkits/hire-an-employee) for hiring documents.



[^about]: By Steven Obiajulu, J.D. Published by [openagreements.org](https://openagreements.org). Last reviewed 2026-09-25. License: CC BY 4.0. Steven Obiajulu, J.D. edits this topic article for Cross-framework security policy planning coverage. It synthesizes legal sources and is not legal advice. This article is for informational purposes only and does not create an attorney-client relationship. Source excerpts and linked materials belong to their owners. CC BY 4.0. Cite as Steven Obiajulu, *Prepare your first security policy*, OpenAgreements (last updated September 25, 2026), https://openagreements.org/practice-guides/security-compliance-program/us.

[^soc-operating-effectiveness]: **AICPA Journal of Accountancy — Expanding Service Organization Controls Reporting** — "The service auditor’s report contains the same opinions as those in a type 1 report but also includes an opinion on whether the controls were operating effectively." *Chris Halterman, Expanding Service Organization Controls Reporting, Journal of Accountancy (July 2011), SOC 2 Reports.* <https://www.journalofaccountancy.com/issues/2011/jul/20103500/>

[^nist-requirements-scope]: **NIST SP 1300 — Understanding cybersecurity requirements** — "Understand your legal, regulatory, and contractual cybersecurity requirements." *NIST SP 1300 (February 2024), Govern, PDF page 3.* <https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.1300.pdf>

[^nist-program-assessment]: **NIST SP 1300 — Assessing the existing program** — "Assess the effectiveness of the business's cybersecurity program to identify areas that need improvement." *NIST SP 1300 (February 2024), Identify, PDF page 4.* <https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.1300.pdf>

[^nist-acceptable-use]: **NIST SP 1300 — Acceptable use policies** — "Do we have acceptable use policies in place for business and for employee-owned devices accessing business resources?" *NIST SP 1300 (February 2024), Govern, Questions to Consider, PDF page 3.* <https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.1300.pdf>

[^nist-policy-review]: **NIST SP 1300 — Policy-maintenance guidance** — "Communicate, enforce, and maintain policies for managing cybersecurity risks." *NIST SP 1300 (February 2024), Govern, PDF page 3.* <https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.1300.pdf>

[^nist-current-profile]: **NIST SP 1300 — Current Profile** — "A Current Profile specifies the desired outcomes an organization is currently achieving (or attempting to achieve) and characterizes how or to what extent each outcome is being achieved." *NIST SP 1300 (February 2024), Profiles and Additional Resources, PDF page 9.* <https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.1300.pdf>

[^nist-small-business-safeguards]: **NIST SP 1300 — Small Business Quick-Start Guide** — "Prioritize requiring multi-factor authentication on all accounts that offer it and consider using password managers to help you and your staff generate and protect strong passwords." *NIST SP 1300 (February 2024), Protect, PDF page 5.* <https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.1300.pdf>

[^nist-sp1300-strategy-responsibility]: **NIST SP 1300 — Responsibility for the cybersecurity strategy** — "Understand who within your business will be responsible for developing and executing the cybersecurity strategy." *NIST SP 1300 (February 2024), Govern, PDF page 3.* <https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.1300.pdf>

[^nist-communicate-policies]: **NIST SP 1300 — Communicating policies** — "Communicate cybersecurity plans, policies, and best practices to all staff and relevant third parties." *NIST SP 1300 (February 2024), Identify, PDF page 4.* <https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.1300.pdf>

[^nist-small-business-audience]: **NIST SP 1300 — Purpose of the small-business guide** — "This guide provides small-to-medium sized businesses (SMB), specifically those who have modest or no cybersecurity plans in place, with considerations to kick-start their cybersecurity risk management strategy by using the NIST Cybersecurity Framework (CSF) 2.0." *NIST SP 1300 (February 2024), Overview, PDF page 2.* <https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.1300.pdf>

[^soc-operating-effectiveness-later]: **AICPA Journal of Accountancy — Expanding Service Organization Controls Reporting** — "The service auditor’s report contains the same opinions as those in a type 1 report but also includes an opinion on whether the controls were operating effectively." *Chris Halterman, Expanding Service Organization Controls Reporting, Journal of Accountancy (July 2011), SOC 2 Reports.* <https://www.journalofaccountancy.com/issues/2011/jul/20103500/>

[^nist-policy-maintain]: **NIST SP 1300 — Policy-maintenance guidance** — "Communicate, enforce, and maintain policies for managing cybersecurity risks." *NIST SP 1300 (February 2024), Govern, PDF page 3.* <https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.1300.pdf>
