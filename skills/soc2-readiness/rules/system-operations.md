# System Operations — CC 7.1–7.5

Per-criterion audit guidance for configuration management, monitoring, incident response, and recovery.

## CC 7.1 — Configuration and baseline monitoring

**Priority**: Critical | **NIST**: CM-6, RA-5 | **ISO**: A.8.9, A.8.8

Auditors verify that production systems run from documented, approved configurations and that drift from baselines is detected. This means infrastructure-as-code, golden images, or documented configuration standards — not ad-hoc server setup.

**What auditors test**:
- Configuration baselines exist for production systems (OS hardening, application settings, network rules)
- Drift detection: mechanism to identify when running config diverges from approved baseline
- Configuration changes follow the change management process (CC 8.1)
- Default credentials and unnecessary services are removed from production systems
- Firewall rules and security group configurations are reviewed at least quarterly

**Evidence to prepare**:
```bash
# GCP: firewall rules
gcloud compute firewall-rules list --format=json | jq '.[] | {name, direction, allowed, sourceRanges, targetTags}'

# GCP: instance configurations
gcloud compute instances list --format=json | jq '.[] | {name, machineType, zone, status}'

# Azure: NSG rules
az network nsg list --output json | jq '.[] | {name, location, securityRules: [.securityRules[] | {name, access, direction, sourceAddressPrefix, destinationPortRange}]}'

# GitHub: infrastructure-as-code repos (Terraform, Pulumi, etc.)
gh repo list {org} --json name,description --jq '.[] | select(.name | test("infra|terraform|pulumi|deploy"))'
```
- Infrastructure-as-code repository with version history
- CIS benchmark assessment results (if available)
- Configuration review records from most recent quarterly review

**Startup pitfalls**:
- Production servers configured manually via SSH — no reproducible baseline exists
- Security groups with 0.0.0.0/0 inbound rules left from early development
- No documentation of what "production configuration" actually is

---

## CC 7.2 — Anomaly detection and monitoring

**Priority**: Critical | **NIST**: AU-6, SI-4 | **ISO**: A.8.15, A.8.16

Auditors assess whether the organization collects, centralizes, and actively monitors logs for security-relevant events. Passive log collection is insufficient — there must be alerting rules that trigger investigation when anomalies occur.

**What auditors test**:
- Log centralization: security events from all systems flow to a single platform (SIEM or log aggregator)
- Alert rules configured for: authentication failures, privilege escalation, unauthorized access attempts, configuration changes
- Sample 2-3 recent alerts: verify each was investigated and documented with a resolution
- Log retention covers the full audit period (typically 12 months for Type II)
- Log integrity: logs are protected from tampering (write-once storage or separate account)

**Evidence to prepare**:
```bash
# GCP: alerting policies
gcloud monitoring policies list --format=json | jq '.[].displayName'

# GCP: log sinks (centralization)
gcloud logging sinks list --format=json | jq '.[] | {name, destination, filter}'

# GCP: log retention settings
gcloud logging buckets list --location=global --format=json | jq '.[] | {name, retentionDays}'

# Azure: alert rules
az monitor metrics alert list --output json | jq '.[] | {name, enabled, severity}'

# Azure: diagnostic settings (log forwarding)
az monitor diagnostic-settings list --resource {resource_id} --output json
```
- SIEM dashboard screenshot showing active alert rules
- Sample alert investigation records (ticket or incident log)
- Log retention policy document

**Startup pitfalls**:
- Logs exist in cloud provider but nobody monitors them — no alert rules configured
- Alert fatigue: hundreds of alerts firing daily, all ignored
- Log retention set to default 30 days — insufficient for a 12-month audit period

---

## CC 7.3 — Incident response

**Priority**: Critical | **NIST**: IR-4 | **ISO**: A.5.24, A.5.25

Auditors verify that the organization has a defined, tested process for responding to security incidents. The plan must exist before the audit period — writing it during the audit is a finding. Expect auditors to walk through a recent incident or tabletop exercise.

**What auditors test**:
- Incident response plan exists, is approved by management, and was in effect during the audit period
- Plan covers: identification, containment, eradication, recovery, and lessons learned
- Roles and responsibilities are defined (who leads response, who communicates, who escalates)
- Plan has been tested: tabletop exercise or response to actual incident within the audit period
- Post-incident reviews are conducted and documented with action items

**Evidence to prepare**:
- Incident response plan document (with version date proving it predates the audit period)
- Tabletop exercise records: scenario, participants, decisions made, findings
- Post-incident review reports (if real incidents occurred)
- On-call rotation or escalation contact list
- Incident severity classification matrix

**Startup pitfalls**:
- No written plan — "we'd just figure it out" is a guaranteed finding
- Plan exists but has never been tested — auditors expect at least one tabletop exercise per year
- No post-incident review process — incidents happen but lessons aren't captured
- Incident response plan written by one person and unknown to the rest of the team

---

## CC 7.4 — Incident communication

**Priority**: High | **NIST**: IR-5, IR-6 | **ISO**: A.5.25, A.5.26

Beyond responding to incidents internally, auditors check whether the organization communicates appropriately with affected parties — customers, regulators, and management. Notification timelines and channels should be predefined, not improvised.

**What auditors test**:
- Communication plan: who gets notified, through what channel, within what timeframe
- Customer notification SLAs match contractual commitments (check customer agreements for breach notification terms)
- Regulatory notification requirements identified by jurisdiction (e.g., 72 hours for GDPR, state breach laws)
- Management receives periodic incident summaries (at least quarterly)
- Status page or customer communication channel for service-affecting incidents

**Evidence to prepare**:
- Incident communication procedures (section of IR plan or standalone document)
- Sample customer notification (if a reportable incident occurred during audit period)
- Regulatory notification requirements matrix (jurisdiction × data type × timeline)
- Management incident summary reports
- Status page URL and historical incident postings

---

## CC 7.5 — Recovery operations

**Priority**: Critical | **NIST**: CP-4, CP-9, CP-10 | **ISO**: A.5.30, A.8.13

Auditors verify that the organization can recover from incidents and disasters — not just that backups exist, but that recovery has been tested and meets defined objectives. Untested backups are assumed to be non-functional.

**What auditors test**:
- Backup configuration: automated, encrypted, and stored separately from production (different region or account)
- Backup frequency matches RPO (recovery point objective) — if RPO is 1 hour, daily backups fail
- Restore testing: at least one successful restore test during the audit period, documented with results
- RTO/RPO defined for critical systems and achievable based on test results
- Disaster recovery plan covering major failure scenarios (region outage, data corruption, ransomware)

**Evidence to prepare**:
```bash
# GCP: Cloud SQL backup configuration
gcloud sql instances describe {instance} --format=json | jq '{backupConfiguration, settings: {backupConfiguration}}'

# GCP: recent backups
gcloud sql backups list --instance={instance} --limit=10 --format=json | jq '.[0:5] | .[] | {id, startTime, status, type}'

# Azure: backup status
az backup item list --resource-group {rg} --vault-name {vault} --output json | jq '.[] | {name, properties: {lastBackupTime, protectionState}}'

# GCP: snapshot policies
gcloud compute resource-policies list --format=json | jq '.[] | {name, snapshotSchedulePolicy}'
```
- Backup restore test report (date, scope, time to restore, success/failure, issues encountered)
- RTO/RPO definitions per critical system
- Disaster recovery plan document
- Business impact analysis identifying critical systems and acceptable downtime

**Startup pitfalls**:
- Cloud provider "handles backups" — but automated backups may not be enabled or may not cover all services
- Backups exist but have never been restored — first restore attempt during a real outage reveals corruption
- No defined RTO/RPO — "as fast as possible" is not measurable
- DR plan is a copy-paste template that doesn't match actual infrastructure
