# Monitoring Activities — CC 4.1–4.2

Per-criterion audit guidance for ongoing monitoring and deficiency evaluation.

## CC 4.1 — Ongoing monitoring

**Priority**: Medium | **NIST**: CA-7, PM-6 | **ISO**: C.9.1

Auditors verify that the organization continuously monitors the effectiveness of its internal controls — not just at audit time, but throughout the year. This means management has mechanisms to detect when controls degrade, stop working, or are bypassed. The distinction from CC 7.2 (anomaly detection) is that CC 4.1 covers monitoring of the controls themselves, not just the systems they protect.

**What auditors test**:
- Management reviews of control effectiveness at defined intervals (at least quarterly)
- Automated monitoring: alerts when critical controls fail (e.g., branch protection disabled, MFA turned off, backups stop running)
- Key metrics tracked over time: access review completion rates, vulnerability remediation timelines, training completion percentages
- Internal audit or self-assessment conducted during the audit period
- Control monitoring results are reported to management with trends and exceptions

**Evidence to prepare**:
```bash
# GitHub: verify branch protection is still active (control monitoring)
gh api repos/{owner}/{repo}/branches/main/protection --jq '{enforced: true}' 2>&1

# GCP: verify monitoring policies are active (alerting on control failures)
gcloud monitoring policies list --format=json | jq '.[] | {displayName, enabled}'

# GCP: check backup automation status
gcloud sql instances describe {instance} --format=json | jq '.settings.backupConfiguration'
```
- Management review meeting minutes discussing control effectiveness
- Control monitoring dashboard or metrics report (quarterly at minimum)
- Internal audit or self-assessment report from the audit period
- Exception log: instances where controls failed or were bypassed, with resolution

**Startup pitfalls**:
- Controls implemented at audit prep time but no ongoing monitoring to verify they keep working
- Management reviews are informal conversations with no documentation
- No alerting on control failures — branch protection silently disabled for months
- Metrics collected but never reviewed or acted upon

---

## CC 4.2 — Deficiency evaluation and remediation

**Priority**: Medium | **NIST**: CA-2 | **ISO**: C.9.2.1

Auditors verify that when control deficiencies are identified — through monitoring, incidents, audits, or testing — they are evaluated for severity, tracked to remediation, and reported to management. A deficiency that's identified but never fixed is arguably worse than one never discovered, because it demonstrates awareness without action.

**What auditors test**:
- Deficiencies identified through monitoring (CC 4.1), incidents (CC 7.3), or assessments are logged
- Each deficiency has: severity rating, owner, remediation plan, and target completion date
- Remediation is tracked to completion — not just planned but verified as resolved
- Management receives reports on open deficiencies and remediation progress
- Root cause analysis conducted for significant deficiencies to prevent recurrence

**Evidence to prepare**:
- Deficiency tracking log or remediation tracker (Jira, spreadsheet, or GRC tool)
- Remediation evidence for deficiencies closed during the audit period
- Management reports showing deficiency status and trends
- Root cause analysis documentation for significant deficiencies
- Corrective action verification records (confirming fixes actually work)

**Startup pitfalls**:
- Deficiencies noted during previous audit but not remediated by the next one — repeat findings
- No formal tracking — issues discussed in Slack but never logged or followed through
- Remediation planned but not verified — "we fixed it" without testing the fix
- No root cause analysis — same type of deficiency keeps recurring
