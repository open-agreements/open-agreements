# Logging and Monitoring Rules

Per-control audit guidance for audit trails, log management, and security monitoring.

## A.8.15 — Logging

**Tier**: Critical | **NIST**: AU-1, AU-2, AU-3, AU-4, AU-5, AU-6, AU-9, AU-11, AU-12, SI-4

Produce, store, and protect logs that record activities, exceptions, faults, and security-relevant events. Logs should be centralized, tamper-evident, and retained for an adequate period.

**Auditor hints**:
- Auditors check FIVE things: (1) what is logged, (2) where logs go, (3) how long retained, (4) who can access/modify, (5) are they reviewed
- "We use CloudWatch/Stackdriver" is only half the answer — auditors want to know WHAT events trigger alerts
- Minimum logging: authentication events (success + failure), privilege escalation, data access, configuration changes, admin actions
- Log retention: 12 months minimum for ISO, 1 year for SOC 2 (some regulated industries: 7 years)
- Tamper protection: logs should be write-once or stored in a separate account with restricted access

**Evidence collection**:
```bash
# GCP: check audit logging configuration
gcloud projects get-iam-policy {project} --format=json | jq '.auditConfigs'

# GCP: list log sinks (centralization)
gcloud logging sinks list --format=json

# Azure: check diagnostic settings
az monitor diagnostic-settings list --resource {resource_id} --output json

# GitHub: audit log (org)
gh api orgs/{org}/audit-log?per_page=5 | jq '.[0:3]'

# AWS: CloudTrail status
# aws cloudtrail describe-trails --output json
# aws cloudtrail get-trail-status --name {trail_name}
```

**Startup pitfalls**:
- Logging enabled but never reviewed — logs without monitoring are just storage costs
- Log retention too short — default cloud retention is often 30-90 days, auditors want 12 months
- No centralization — logs scattered across services with no single pane of glass
- Sensitive data in logs — PII, passwords, tokens appearing in debug logs

---

## A.8.16 — Monitoring Activities

**Tier**: Critical | **NIST**: AU-6, CA-7, SI-4

Monitor networks, systems, and applications for anomalous behavior. Define what "anomalous" means for your environment and configure alerts accordingly.

**Auditor hints**:
- Auditors distinguish between LOGGING (passive) and MONITORING (active) — you need both
- They'll ask: "Show me your alert configuration" and "When was the last alert triggered?"
- If zero alerts have fired in the audit period, either monitoring is too loose or the environment is unusually quiet — auditors will probe which
- Monitoring should cover: failed authentication (brute force), privilege escalation, unusual data access patterns, configuration changes
- Response to alerts must be documented — "we saw the alert and investigated" needs a ticket or log entry

**Evidence collection**:
```bash
# GCP: alerting policies
gcloud monitoring policies list --format=json | jq '.[].displayName'

# Azure: alert rules
az monitor alert list --output json | jq '.[].{name, enabled, severity}'

# PagerDuty / Opsgenie: recent incidents
# curl -H "Authorization: Token token={key}" https://api.pagerduty.com/incidents?limit=5
```

---

## A.8.17 — Clock Synchronization

**Tier**: Relevant | **NIST**: AU-8

Synchronize clocks of all information processing systems to an approved time source. Consistent timestamps across systems are essential for incident investigation and evidence correlation.

**Auditor hints**:
- Cloud services handle this automatically (NTP synced) — auditors mainly check that you haven't overridden it
- On-premises servers or VMs need explicit NTP configuration
- Timestamps in logs should use UTC and ISO 8601 format for consistency
- If evidence timestamps from different systems don't align, auditors will question the integrity

**Evidence collection**:
```bash
# macOS: NTP status
sntp -d time.apple.com 2>&1 | head -5

# Linux: NTP sync status
timedatectl status | grep -E "NTP|synchronized"

# Docker containers: clock is synced with host (usually fine)

# GCP: instance time sync (automatic for Compute Engine)
# Azure: VM time sync (automatic for Azure VMs)
```
