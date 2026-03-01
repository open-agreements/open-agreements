# Trust Services Criteria — Detailed Guidance

Per-criterion guidance for SOC 2 audits. Covers all 5 trust service categories.

## Security (Common Criteria) — Always Required

### CC 6.1 — Logical Access Security

**Priority**: Critical | **NIST**: AC-2, AC-3, IA-2, SC-28 | **ISO**: A.5.15, A.8.5, A.8.24

The entity implements logical access security software, infrastructure, and architectures over protected information assets to protect them from security events.

**What auditors test**:
- Sample user accounts: verify access is appropriate for role
- Check MFA enforcement on all systems with sensitive data
- Verify encryption at rest and in transit
- Test that unauthorized access attempts are blocked and logged

**Evidence to prepare**:
```bash
# User access list with roles
gam print users fields primaryEmail,name,orgUnitPath,isAdmin,isEnforcedIn2Sv

# GitHub: org access settings
gh api orgs/{org} | jq '{two_factor_requirement_enabled, default_repository_permission}'

# Encryption: TLS check
openssl s_client -connect {host}:443 -tls1_2 < /dev/null 2>&1 | grep "Protocol"
```

---

### CC 6.2 — Access Provisioning and Deprovisioning

**Priority**: Critical | **NIST**: AC-2, PS-4, PS-5 | **ISO**: A.5.18, A.6.5

New access requests require authorization. Access is removed promptly when no longer needed.

**What auditors test**:
- Sample 5-10 new hires: verify access was authorized before provisioning
- Sample 5-10 terminations: verify access was revoked within 24-48 hours
- Check for orphaned accounts (active accounts with no corresponding employee)

**Evidence to prepare**:
- HR-to-IT onboarding workflow documentation
- Termination checklist with IT steps
- Cross-reference: termination dates vs. last-active dates in systems

---

### CC 7.2 — Anomaly Detection and Monitoring

**Priority**: Critical | **NIST**: AU-6, SI-4 | **ISO**: A.8.15, A.8.16

The entity monitors system components and anomalies that indicate malicious acts, natural disasters, and errors.

**What auditors test**:
- Alert configuration: what triggers alerts?
- Sample alerts: show a recent alert and the response
- Log retention: are logs kept for the full audit period?
- Log centralization: is there a single view of security events?

**Evidence to prepare**:
```bash
# GCP: alerting policies
gcloud monitoring policies list --format=json | jq '.[].displayName'

# GCP: log sinks
gcloud logging sinks list --format=json

# Azure: alert rules
az monitor alert list --output json | jq '.[].{name, enabled}'
```

---

### CC 7.5 — Recovery Operations

**Priority**: Critical | **NIST**: CP-4, CP-9, CP-10 | **ISO**: A.5.30, A.8.13

The entity identifies, develops, and implements activities to recover from identified security incidents.

**What auditors test**:
- Backup configuration: are backups automated and encrypted?
- Backup testing: has a restore been tested in the audit period?
- DR plan: does it exist and has it been tested?
- RTO/RPO: are they defined and achievable?

**Evidence to prepare**:
```bash
# GCP: backup configuration
gcloud sql backups list --instance={instance} --format=json | jq '.[0:5]'

# Backup restore test documentation (manual)
```

---

### CC 8.1 — Change Management

**Priority**: Critical | **NIST**: CM-3, CM-5, SA-3 | **ISO**: A.8.9, A.8.25, A.8.32

Changes to infrastructure, data, software, and procedures are authorized, designed, developed, configured, documented, tested, approved, and implemented.

**What auditors test**:
- Sample 10-15 production changes: verify each had authorization, testing, and approval
- Emergency change process: how are hotfixes handled?
- Segregation: developers can't push directly to production
- Rollback: can changes be reverted?

**Evidence to prepare**:
```bash
# GitHub: merged PRs with review status
gh pr list --state merged --limit 20 --json number,title,author,reviewDecision,mergedAt,mergedBy

# GitHub: branch protection
gh api repos/{owner}/{repo}/branches/main/protection | jq '{
  required_reviews: .required_pull_request_reviews.required_approving_review_count,
  enforce_admins: .enforce_admins.enabled
}'
```

---

## Availability — For SaaS and Infrastructure

### A 1.1 — System Availability Monitoring

**Priority**: High | **NIST**: SC-5, SI-4 | **ISO**: A.8.6, A.8.16

Monitor capacity and availability to meet commitments.

**What auditors test**:
- Uptime monitoring: is there a system monitoring availability?
- Capacity planning: is there a process for scaling?
- Status page: is availability communicated to customers?

---

### A 1.2 — Recovery Planning

**Priority**: High | **NIST**: CP-2, CP-6, CP-7 | **ISO**: A.5.30, A.8.14

Environmental protections and recovery infrastructure support availability commitments.

**What auditors test**:
- Multi-AZ or multi-region deployment for production
- Auto-scaling configuration
- Failover testing records

---

### A 1.3 — Recovery Testing

**Priority**: High | **NIST**: CP-4 | **ISO**: A.5.30

Recovery plans are tested periodically.

**What auditors test**:
- DR test records (date, scope, results)
- Actual recovery time vs. RTO target

---

## Processing Integrity — For Data Processing Services

### PI 1.1-1.3 — Processing Completeness, Accuracy, and Timeliness

**Priority**: Medium | **NIST**: SI-10, SI-11 | **ISO**: A.8.28

System processing is complete, valid, accurate, and timely.

**What auditors test**:
- Input validation controls
- Error handling and exception reporting
- Reconciliation processes for data accuracy
- SLA monitoring for timeliness

---

## Confidentiality — For Sensitive Data

### C 1.1 — Confidential Information Protection

**Priority**: High | **NIST**: AC-21, SC-28 | **ISO**: A.5.14, A.8.24

Confidential information is protected during processing and storage.

**What auditors test**:
- Data classification scheme
- Encryption at rest for confidential data
- Access restrictions based on classification

### C 1.2 — Confidential Information Disposal

**Priority**: Medium | **NIST**: MP-6, SI-12 | **ISO**: A.7.14, A.8.10

Confidential information is disposed of when no longer needed.

**What auditors test**:
- Data retention policy
- Evidence of data disposal (deletion records, media destruction)

---

## Privacy — When Processing PII

### P 4.2 — Privacy Notice

**Priority**: Medium | **ISO**: A.5.34

Privacy notice is provided and accessible.

### P 6.1-6.6 — Data Subject Rights and Incident Response

**Priority**: Medium (if PII in scope)

Data subject requests are handled. Privacy incidents are reported.

**What auditors test**:
- Privacy policy on website
- Process for data subject access requests (DSARs)
- Privacy incident notification process
- Data processing agreements with sub-processors

### P 8.1 — Quality Assurance

**Priority**: Low

Data quality procedures are in place.
