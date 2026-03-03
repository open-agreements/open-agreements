# Communication and Information — CC 2.1–2.3

Per-criterion audit guidance for information quality, internal communication, and external communication.

## CC 2.1 — Internal information quality

**Priority**: Medium | **NIST**: AU-2, SI-5 | **ISO**: C.7.5.1

Auditors assess whether the organization generates and uses quality information to support the functioning of internal controls. This means security-relevant information — logs, metrics, reports, alerts — is accurate, timely, and available to the people who need it for decision-making.

**What auditors test**:
- Security-relevant information is generated: audit logs, access reports, vulnerability scans, incident records
- Information is accurate and complete: logs capture required fields (who, what, when, where)
- Information is timely: reports and dashboards are current, not stale exports from months ago
- Information systems are protected: audit logs cannot be modified or deleted by the users they track
- Data used for control monitoring is validated (e.g., access review data matches actual system state)

**Evidence to prepare**:
```bash
# GCP: verify audit logging is enabled
gcloud projects get-iam-policy {project} --format=json | jq '.auditConfigs'

# GCP: verify log integrity (export to separate project or write-once sink)
gcloud logging sinks list --format=json | jq '.[] | {name, destination}'

# GitHub: audit log availability
gh api orgs/{org}/audit-log --jq '.[0:3] | .[] | {action, actor, created_at}'
```
- List of security reports and dashboards with update frequency
- Audit log configuration showing required event types are captured
- Log integrity controls (separate storage account, write-once policies)

---

## CC 2.2 — Internal communication

**Priority**: Medium | **NIST**: PM-2, AT-2 | **ISO**: C.7.4, A.6.3

Auditors verify that security-related information — policies, responsibilities, changes, and expectations — is communicated effectively to all personnel. Internal communication isn't just "we have a wiki"; it's demonstrating that people actually receive and understand security requirements.

**What auditors test**:
- Security policies are communicated to all employees (not just published and forgotten)
- Onboarding includes security expectations, reporting procedures, and acceptable use
- Changes to security policies or procedures are communicated when they occur
- Regular security updates: newsletters, all-hands mentions, Slack announcements
- Employees in interviews can describe their security responsibilities and reporting channels

**Evidence to prepare**:
- Onboarding checklist showing security communication steps
- Security awareness communication records (email announcements, Slack messages, all-hands slides)
- Policy change communication evidence (email or message notifying staff of updates)
- Security training materials covering roles and responsibilities
- Internal security FAQ or knowledge base

**Startup pitfalls**:
- Security policies exist but nobody outside the security/compliance function knows about them
- Onboarding mentions security verbally but nothing is documented or acknowledged
- Policy changes happen silently — no communication when procedures are updated

---

## CC 2.3 — External communication

**Priority**: Medium | **NIST**: PM-1 | **ISO**: A.5.14

Auditors verify that the organization communicates security-relevant information to external parties — customers, regulators, vendors, and the public — through appropriate channels. This includes the system description, security practices, incident notifications, and contractual commitments.

**What auditors test**:
- Security practices communicated to customers: security page, trust center, or documentation
- SOC 2 report distribution process: how customers request and receive the report
- Incident notification: contractual obligations met for customer communication during incidents
- Regulatory reporting: process for notifying regulators of security events when required
- Vendor communication: security requirements communicated to third parties in contracts and onboarding

**Evidence to prepare**:
- Security page or trust center URL (public-facing security information)
- NDA or report request process for SOC 2 report distribution
- Customer-facing incident communication templates and procedures
- Contractual breach notification obligations inventory
- Vendor security requirements (contract clauses, questionnaire, or onboarding materials)

**Startup pitfalls**:
- No public security page — customers can't find any information about security practices
- SOC 2 report shared openly without NDA — report is meant to be restricted use
- Incident notification process undefined — scrambling to communicate during an actual incident
