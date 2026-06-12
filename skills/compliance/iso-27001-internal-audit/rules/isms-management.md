# ISMS Management System Rules

Per-clause audit guidance for ISO 27001:2022 Clauses 4-10.

This is where most first-time audit failures happen. Startups focus on Annex A technical controls and neglect the management system clauses that auditors weight most heavily.

## Clause 5 — Leadership and Commitment

**Tier**: Critical | **NIST**: PM-1, PM-2

Top management must demonstrate commitment to the ISMS by establishing policy, assigning roles, providing resources, and conducting management reviews. This is NOT delegatable to IT.

**Auditor hints**:
- Auditors look for EVIDENCE of management involvement, not just policy signatures
- "Management review" must be a documented meeting with specific inputs/outputs defined in Clause 9.3
- The information security policy must be SIGNED by top management (CEO/founder) and communicated to all personnel
- ISMS scope must be approved by management — it can't be defined by IT alone
- For startups: the founder IS top management — their engagement is visible and auditable

**Evidence**:
- Signed information security policy (with date)
- Management review meeting minutes (at least annual)
- ISMS scope document approved by management
- Resource allocation evidence (budget, tools, personnel)

**Startup pitfalls**:
- Treating the security policy as a checkbox document that nobody reads
- No management review conducted — or conducted but not documented
- ISMS scope undefined or too vague ("everything we do")

---

## Clause 6 — Risk Assessment and Treatment

**Tier**: Critical | **NIST**: PM-9, RA-3, RA-7

Plan and conduct risk assessments to identify threats and vulnerabilities. Select risk treatment options (mitigate, accept, transfer, avoid) and implement controls from the Statement of Applicability.

**Auditor hints**:
- The risk assessment is the FOUNDATION of the ISMS — everything else flows from it
- Auditors verify: risk assessment methodology is documented, risks are identified with likelihood and impact, treatment decisions are justified
- The SoA must MATCH the risk assessment — every control in the SoA should trace back to a risk
- Risk acceptance must be AUTHORIZED by management (documented approval)
- Risk assessment must be CURRENT (within 12 months) and triggered by significant changes

**Evidence**:
- Risk assessment methodology document
- Risk register (with likelihood, impact, risk level, treatment decision)
- Statement of Applicability (SoA) with justification for inclusion/exclusion
- Risk treatment plan showing implementation status
- Risk acceptance records signed by management

**Startup pitfalls**:
- Copy-pasting a risk assessment template without tailoring to the actual business
- SoA says "all controls applicable" without justification per control
- Risk register never updated — last revision was pre-certification
- No connection between risk assessment and control selection

---

## Clause 7 — Competence and Awareness

**Tier**: Relevant | **NIST**: AT-1, AT-2, AT-3, AT-4

Ensure personnel are competent for their security roles, aware of the security policy, and understand their contribution to the ISMS. Maintain training records.

**Auditor hints**:
- Auditors check competence for KEY ROLES: ISMS manager, incident responders, internal auditors, system administrators
- Awareness training for ALL staff must be documented with completion dates
- Competence means: education, training, experience, or certification — at least one should be documented per role
- Internal auditors must demonstrate audit competence (training or certification) — can't just be "the IT person"

**Evidence**:
- Role descriptions with security competence requirements
- Training records (completion dates, topics covered)
- Security awareness program description
- Internal auditor competence records (training, certification, or experience)

---

## Clause 8 — Operational Planning and Control

**Tier**: Critical | **NIST**: CA-6, PM-10, RA-3, RA-7

Execute the risk treatment plan. Implement planned controls, manage operational processes, and handle changes that affect the ISMS.

**Auditor hints**:
- This is the "do what you said you'd do" clause — auditors verify that planned actions from Clause 6 are actually implemented
- Change management applies to the ISMS itself — changes to scope, policies, or controls should be documented
- Outsourced processes within the ISMS scope must be controlled — if you outsource IT, you still own the risk

**Evidence**:
- Risk treatment plan with implementation status
- Change records for ISMS changes
- Outsourcing agreements with security controls (links to A.5.19-A.5.23)

---

## Clause 9 — Internal Audit and Management Review

**Tier**: Critical | **NIST**: CA-2, PM-14

Conduct internal audits at planned intervals to verify the ISMS conforms to requirements and is effectively implemented. Conduct management reviews to ensure continuing suitability and effectiveness.

**Auditor hints**:
- Internal audit is REQUIRED — "we'll do it next quarter" at certification time is a major nonconformity
- Internal auditors must be INDEPENDENT — they can't audit their own work (Clause 9.2 requirement)
- Management review has REQUIRED INPUTS (Clause 9.3.2): audit results, interested party feedback, risk assessment status, opportunities for improvement
- Management review has REQUIRED OUTPUTS (Clause 9.3.3): decisions on improvement opportunities, resource needs, any changes to the ISMS
- Auditors check that internal audit FINDINGS are TRACKED to closure

**Evidence**:
- Internal audit plan (annual schedule showing all ISMS areas)
- Internal audit report(s) with findings
- Evidence of auditor independence
- Management review meeting minutes with all required inputs and outputs
- Corrective action tracker showing internal audit findings through to closure

**Startup pitfalls**:
- Internal audit never done — this is a showstopper for certification
- Internal audit done by the same person who manages the ISMS
- Management review conducted but doesn't address all required inputs
- Findings identified but no corrective actions implemented

---

## Clause 10 — Nonconformity and Continual Improvement

**Tier**: Critical | **NIST**: CA-5, PM-4

React to nonconformities, take corrective action, and continually improve the ISMS. Track nonconformities through root cause analysis, corrective action, and verification of effectiveness.

**Auditor hints**:
- Auditors look for a COMPLETE CYCLE: nonconformity identified → root cause analyzed → corrective action taken → effectiveness verified
- Not every issue needs formal corrective action — observations and opportunities for improvement can be noted and tracked separately
- "Continual improvement" means the ISMS should be demonstrably BETTER than last year — auditors compare year over year
- If the same nonconformity recurs, the previous corrective action was ineffective — this is a major finding

**Evidence**:
- Nonconformity log/register
- Corrective action records with root cause analysis
- Evidence of effectiveness verification (follow-up check)
- Improvement records (changes made to the ISMS based on lessons learned)

---

## Quick Reference: ISMS Document Checklist

These documents are REQUIRED by ISO 27001:2022 — missing any is a nonconformity:

| Document | Clause | Notes |
|----------|--------|-------|
| ISMS scope | 4.3 | Boundaries and applicability |
| Information security policy | 5.2 | Signed by top management |
| Risk assessment methodology | 6.1.2 | How risks are identified and evaluated |
| Risk assessment results | 8.2 | Current risk register |
| Statement of Applicability | 6.1.3 | All 93 controls: included/excluded with justification |
| Risk treatment plan | 6.1.3 | How selected controls will be implemented |
| Security objectives | 6.2 | Measurable security goals |
| Competence evidence | 7.2 | Training records, qualifications |
| Operational planning docs | 8.1 | Evidence of control implementation |
| Internal audit results | 9.2 | Audit report(s) with findings |
| Management review results | 9.3 | Meeting minutes with required inputs/outputs |
| Nonconformity records | 10.1 | Corrective action log |
