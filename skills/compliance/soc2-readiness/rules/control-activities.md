# Control Activities — CC 5.1–5.3

Per-criterion audit guidance for risk mitigation selection, technology controls, and policy deployment.

## CC 5.1 — Risk mitigation selection

**Priority**: High | **NIST**: AC-5 | **ISO**: A.5.3

Auditors verify that the organization selects and deploys control activities that mitigate identified risks to acceptable levels. This is the bridge between the risk assessment (CC 3) and actual controls — each significant risk should trace to one or more controls. Segregation of duties is a key element auditors evaluate here.

**What auditors test**:
- Control activities are mapped to specific risks from the risk register (traceability)
- Segregation of duties: conflicting responsibilities are separated across different individuals
- Key incompatible functions identified and separated: access provisioning vs. access review, code development vs. deployment approval, payment initiation vs. payment approval
- Compensating controls documented where full segregation isn't feasible (common in small teams)
- Control design considers both preventive (stop it before it happens) and detective (find it after it happens) controls

**Evidence to prepare**:
- Risk-to-control mapping matrix (risk register entries linked to specific controls)
- Segregation of duties matrix identifying incompatible functions and how they're separated
- Compensating controls documentation for small-team exceptions
- Control design rationale for critical risks (why this control was selected over alternatives)

**Startup pitfalls**:
- No traceability between risks and controls — controls exist but aren't linked to specific risks
- Segregation of duties impossible with 3-person engineering team — document compensating controls instead of ignoring the requirement
- Only preventive controls, no detective controls — if prevention fails, there's no detection

---

## CC 5.2 — Technology general controls

**Priority**: High | **NIST**: AC-1, IA-2 | **ISO**: A.5.15, A.8.5

Auditors verify that technology infrastructure supporting the control environment is itself controlled. This covers IT general controls (ITGCs): access management for infrastructure, authentication mechanisms, and the foundational technology controls that other controls depend on.

**What auditors test**:
- Infrastructure access controls: who can access production servers, databases, cloud consoles
- Authentication strength: MFA enforced for infrastructure access (cloud console, SSH, VPN)
- Automated controls functioning correctly: CI/CD gates, automated access reviews, scheduled scans
- Dependency management: technology controls don't rely on manual processes that could be skipped
- Technology control monitoring: alerts when automated controls fail or are bypassed

**Evidence to prepare**:
```bash
# GitHub: branch protection (automated control)
gh api repos/{owner}/{repo}/branches/main/protection | jq '{
  required_reviews: .required_pull_request_reviews.required_approving_review_count,
  required_checks: .required_status_checks.contexts,
  enforce_admins: .enforce_admins.enabled
}'

# GCP: organization policies (automated guardrails)
gcloud resource-manager org-policies list --organization={org_id} --format=json | jq '.[].constraint'

# GitHub: required status checks (CI gates)
gh api repos/{owner}/{repo}/branches/main/protection/required_status_checks | jq '.contexts'
```
- Infrastructure access control matrix (who has access to what, at what level)
- Automated control inventory (CI/CD gates, automated scans, scheduled reviews)
- Technology control failure alerting configuration

**Startup pitfalls**:
- All engineers have production database access "for debugging" — violates least privilege
- CI/CD pipeline has no required checks — tests are optional and frequently skipped
- Cloud console access not protected by MFA — "it's inconvenient" is not an acceptable justification

---

## CC 5.3 — Policy and procedure deployment

**Priority**: Medium | **NIST**: PM-1, PL-1 | **ISO**: A.5.1, C.5.2

Auditors verify that security policies and procedures are formalized, approved, communicated, and accessible to all relevant personnel. Policies must be living documents — reviewed periodically, updated when changes occur, and acknowledged by employees.

**What auditors test**:
- Information security policy suite exists: overarching policy plus supporting procedures
- Policies are approved by management (signature or formal approval record)
- Policies are reviewed at least annually and updated when significant changes occur
- Employees can access policies (intranet, shared drive, wiki) and know where to find them
- Policy acknowledgment: employees sign or electronically acknowledge reading policies
- Version control: policies have version numbers, effective dates, and review dates

**Evidence to prepare**:
- Policy inventory (list of all security-related policies with version, effective date, next review date)
- Signed management approval for each policy
- Policy acknowledgment records (employee signatures or electronic acknowledgment log)
- Policy distribution mechanism (shared drive link, wiki URL, HRIS integration)
- Policy review log showing annual review was conducted with any changes noted

**Startup pitfalls**:
- Policies exist in someone's Google Drive but aren't shared or discoverable
- No version control — impossible to prove which version was in effect during the audit period
- Policies never reviewed after initial creation — outdated content that doesn't match current practices
- Acknowledgment collected at onboarding but not when policies are updated
