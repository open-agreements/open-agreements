# Risk Assessment — CC 3.1–3.4

Per-criterion audit guidance for risk objectives, identification, fraud risk, and change impact analysis.

## CC 3.1 — Risk objectives

**Priority**: High | **NIST**: PM-9, RA-1 | **ISO**: C.6.1.1

Auditors verify that the organization defines clear objectives against which risks are assessed. Without stated objectives, there's no basis for evaluating whether risks are acceptable. In practice, this means the organization has documented what it's trying to protect, what "good" looks like, and what level of risk is tolerable.

**What auditors test**:
- Information security objectives are documented and approved by management
- Objectives are specific enough to be measurable (e.g., "99.9% uptime" not just "high availability")
- Objectives align with business strategy and customer commitments (SLAs, contracts)
- Risk appetite or tolerance statement exists — management has decided how much risk is acceptable
- Objectives are reviewed at least annually and updated when business changes

**Evidence to prepare**:
- Information security policy with stated objectives (effective date within audit period)
- Risk appetite statement or risk tolerance matrix (signed by management)
- SLA commitments to customers that drive security objectives
- Management review minutes where objectives were discussed/approved
- Year-over-year comparison showing objectives were reviewed and updated

**Startup pitfalls**:
- No written security objectives — "don't get hacked" is not a measurable objective
- Objectives copied from a template without customization to actual business context
- Risk appetite never discussed — every risk is treated equally instead of being prioritized

---

## CC 3.2 — Risk identification and analysis

**Priority**: High | **NIST**: RA-3 | **ISO**: C.6.1.2, C.8.2

Auditors verify that the organization systematically identifies and analyzes risks to achieving its objectives. The risk assessment must be documented, cover relevant categories (operational, technical, compliance, people), and use a consistent methodology for evaluating likelihood and impact.

**What auditors test**:
- Formal risk assessment conducted at least annually with documented methodology
- Risk register includes: risk description, likelihood, impact, risk rating, owner, and treatment decision
- Risk categories cover: technical (infra, code), operational (process, people), compliance (regulatory), and third-party
- Risk assessment considers both internal and external threats
- Assessment methodology is consistent (e.g., 5×5 likelihood-impact matrix used uniformly)

**Evidence to prepare**:
- Risk register (spreadsheet or GRC tool export) with all required fields populated
- Risk assessment methodology document (how risks are scored and prioritized)
- Most recent risk assessment report with date and participants
- Threat landscape analysis or threat modeling documentation
- Risk register change log showing risks added, updated, or closed during audit period

**Startup pitfalls**:
- Risk register is a checkbox exercise — created once, never updated
- Only technical risks listed — operational, compliance, and people risks are absent
- Risk assessment done by one person in isolation — should involve cross-functional input
- All risks rated "medium" to avoid triggering remediation

---

## CC 3.3 — Fraud risk

**Priority**: Medium | **NIST**: RA-3 | **ISO**: C.6.1.2

Auditors verify that the organization considers the potential for fraud when assessing risks — both internal (employee misuse, embezzlement, data theft) and external (social engineering, account takeover). This doesn't require a massive fraud program; it requires that fraud scenarios are part of the risk assessment.

**What auditors test**:
- Risk assessment explicitly includes fraud risk scenarios (not just technical vulnerabilities)
- Internal fraud risks considered: data theft by insiders, financial fraud, unauthorized access abuse
- External fraud risks considered: phishing, business email compromise, social engineering
- Segregation of duties addresses fraud opportunity (e.g., person approving payments ≠ person initiating)
- Management override controls: even founders/executives cannot bypass financial or access controls without detection

**Evidence to prepare**:
- Risk register entries specifically categorized as fraud risks
- Segregation of duties matrix for financial and access management processes
- Anti-fraud controls documentation (approval workflows, dual authorization for payments)
- Phishing simulation results demonstrating awareness of social engineering threats
- Financial reconciliation procedures showing detection controls for unauthorized transactions

---

## CC 3.4 — Change impact on controls

**Priority**: Medium | **NIST**: RA-3, CM-4 | **ISO**: C.6.1.2, A.8.9

Auditors verify that the organization assesses how changes — business, technical, regulatory, or personnel — affect the internal control environment. When the company adds a new product, enters a new market, adopts a new cloud provider, or undergoes significant personnel changes, the risk assessment should be revisited.

**What auditors test**:
- Process exists for evaluating control impact when significant changes occur
- Evidence of risk reassessment triggered by actual changes during the audit period
- New systems, vendors, or services underwent security review before deployment
- Organizational changes (mergers, rapid hiring, leadership changes) triggered control reviews
- Regulatory changes relevant to the business were identified and controls adjusted

**Evidence to prepare**:
- Change impact assessment records for significant changes during the audit period
- Security review documentation for new vendors, systems, or services onboarded
- Risk register entries added or modified in response to business changes
- Management review minutes discussing impact of organizational changes on controls
- Regulatory monitoring log showing awareness of relevant regulatory developments
