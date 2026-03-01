# Business Continuity Rules

Per-control audit guidance for backup, disaster recovery, and business continuity planning.

## A.5.30 — ICT Readiness for Business Continuity

**Tier**: Critical | **NIST**: CP-1, CP-2, CP-3, CP-4

Ensure ICT systems can be recovered within required timeframes during disruption. Define RTO (Recovery Time Objective) and RPO (Recovery Point Objective) for critical systems. Test recovery procedures regularly.

**Auditor hints**:
- Auditors check THREE things: (1) BCP/DR plan exists with defined RTO/RPO, (2) the plan has been TESTED, (3) test results are documented
- A plan tested > 12 months ago is a finding — annual testing is the minimum
- "We use cloud so we're resilient" is not a BCP — auditors want to see that YOU tested failover, not just that your provider can
- RTO/RPO should be defined per system based on business impact analysis, not a blanket number
- The test should include actual recovery steps, not just "we verified the backup exists"

**Evidence collection**:
- Business continuity plan (with version date)
- Business impact analysis (system criticality, RTO/RPO per system)
- DR test records (date, scope, participants, results, issues found)
- Recovery time actuals vs. RTO targets

```bash
# GCP: verify backup configuration
gcloud sql instances describe {instance} --format="json(settings.backupConfiguration)"

# Azure: check backup policy
az backup policy list --resource-group {rg} --vault-name {vault} --output json

# AWS: backup plans
# aws backup list-backup-plans --output json
```

**Startup pitfalls**:
- Having backups but never testing restore — a backup you can't restore from is worthless
- No defined RTO/RPO — "as fast as possible" is not a measurable objective
- BCP covers infrastructure but not data (database backups, secrets, configuration)
- Single-region deployment with no failover plan

---

## A.8.13 — Information Backup

**Tier**: Critical | **NIST**: CP-9

Maintain and regularly test backup copies of information, software, and system configurations. Backups should be stored separately from primary systems and encrypted.

**Auditor hints**:
- Auditors verify: backup frequency matches RPO, backups are encrypted, backups are stored in a different location/region
- They'll ask for a RECENT RESTORE TEST — "we restored a database in Q2" with evidence
- Automated backups are good but auditors still want to see that someone verified they completed successfully
- Backup alerts (failure notifications) should be configured and monitored

**Evidence collection**:
```bash
# GCP: Cloud SQL backup history
gcloud sql backups list --instance={instance} --format=json | jq '.[0:5]'

# GCP: Cloud Storage versioning (for file backups)
gsutil versioning get gs://{bucket}

# Azure: backup job history
az backup job list --resource-group {rg} --vault-name {vault} --output json | jq '.[0:5]'

# Verify backup encryption
gcloud sql instances describe {instance} --format="json(settings.dataDiskEncryptionConfiguration)"
```

---

## A.8.14 — Redundancy of Information Processing Facilities

**Tier**: Relevant | **NIST**: CP-6, CP-7, CP-10

Implement sufficient redundancy in information processing facilities to meet availability requirements. This includes compute, storage, network, and power redundancy.

**Auditor hints**:
- For cloud-native startups, this is largely covered by cloud provider SLAs — but auditors want to see you've CHOSEN appropriate service tiers
- Multi-AZ or multi-region deployment for production is expected for critical systems
- Database replication configuration should match RTO/RPO requirements
- Auditors may ask: "What happens if your primary region goes down?" — have an answer

**Evidence collection**:
```bash
# GCP: check instance zones/regions
gcloud compute instances list --format="json(name,zone,status)"

# GCP: Cloud SQL HA configuration
gcloud sql instances describe {instance} --format="json(settings.availabilityType)"

# Azure: check resource distribution across regions
az resource list --output json | jq 'group_by(.location) | .[] | {location: .[0].location, count: length}'
```
