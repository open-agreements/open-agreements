# Optional Categories — Availability, Processing Integrity, Confidentiality

Per-criterion audit guidance for non-Security trust categories. Include these when your scope requires them (see decision tree in SKILL.md).

## A 1.1 — Availability monitoring

**Priority**: High | **NIST**: SC-5, SI-4 | **ISO**: A.8.6, A.8.16

Auditors verify that the organization monitors system capacity and availability against commitments made to customers. If your SLA promises 99.9% uptime, you need data showing you measured and met that target. Monitoring must be proactive (alerting before outages) not just reactive (noticing when customers complain).

**What auditors test**:
- Uptime monitoring configured for all customer-facing services with alerting thresholds
- Capacity metrics tracked: CPU, memory, storage, network — with alerts before exhaustion
- Status page maintained for customers showing current and historical availability
- SLA tracking: actual availability measured and compared against contractual commitments
- Capacity planning process: evidence of scaling decisions made before capacity limits are reached

**Evidence to prepare**:
```bash
# GCP: uptime checks
gcloud monitoring uptime list-configs --format=json | jq '.[] | {displayName, monitoredResource, period}'

# GCP: alerting policies for availability
gcloud monitoring policies list --format=json | jq '.[] | select(.displayName | test("uptime|availability|latency"; "i")) | .displayName'

# Azure: availability metrics
az monitor metrics list --resource {resource_id} --metric "Availability" --output json
```
- Status page URL and historical uptime data
- SLA attainment report for the audit period
- Capacity planning documentation or auto-scaling configuration
- Incident records for any availability disruptions during the audit period

**Startup pitfalls**:
- SLA promised to customers but no mechanism to measure actual uptime
- Monitoring exists for application but not for dependencies (database, cache, CDN)
- No status page — customers learn about outages from Twitter before the company communicates

---

## A 1.2 — Recovery infrastructure

**Priority**: High | **NIST**: CP-2, CP-6, CP-7 | **ISO**: A.5.30, A.8.14

Auditors verify that infrastructure supports recovery from disruptions — redundancy, failover, and geographic distribution proportionate to availability commitments. The question isn't whether you're multi-region; it's whether your architecture matches your stated RTO/RPO.

**What auditors test**:
- Production infrastructure has redundancy appropriate to SLA commitments
- Multi-AZ or multi-region deployment for critical services (verify configuration, not just documentation)
- Auto-scaling configured to handle demand spikes without manual intervention
- Failover mechanisms tested: load balancer health checks, database replica promotion
- Environmental protections: cloud provider's physical redundancy covered by their SOC 2 report

**Evidence to prepare**:
```bash
# GCP: instance groups and auto-scaling
gcloud compute instance-groups managed list --format=json | jq '.[] | {name, zone, targetSize}'
gcloud compute instance-groups managed describe {group} --zone={zone} --format=json | jq '.autoscaler'

# GCP: Cloud SQL high availability
gcloud sql instances describe {instance} --format=json | jq '{availabilityType, region, gceZone, secondaryGceZone}'

# Azure: availability sets and zones
az vm availability-set list --output json | jq '.[] | {name, platformFaultDomainCount}'
```
- Architecture diagram showing redundancy and failover paths
- Auto-scaling configuration documentation
- Cloud provider SOC 2 report sections covering physical and environmental protections

---

## A 1.3 — Recovery testing

**Priority**: High | **NIST**: CP-4 | **ISO**: A.5.30

Auditors verify that recovery capabilities are tested — not just designed. An untested DR plan is assumed to be broken. Expect auditors to ask for the date, scope, and results of your most recent recovery test.

**What auditors test**:
- At least one recovery test conducted during the audit period
- Test scope covers critical systems (not just a non-critical staging restore)
- Test results documented: actual recovery time vs. RTO, data loss vs. RPO, issues encountered
- Lessons learned captured and applied (if test revealed problems, they were fixed)
- Test participants include operations team members who would execute real recovery

**Evidence to prepare**:
- Recovery test report: date, scope, participants, procedure followed
- Test metrics: actual recovery time, data point recovered to, success/failure criteria
- Issues log from test execution with resolution status
- Post-test action items and their completion status
- Year-over-year comparison showing improvement (if multiple tests)

**Startup pitfalls**:
- "We restored a backup once" doesn't count if it wasn't documented with timing and results
- Test only covers database restore, not full application recovery
- DR plan tested in staging but production has different configuration

---

## PI 1.1 — Processing completeness

**Priority**: Medium | **NIST**: SI-10 | **ISO**: A.8.28

Auditors verify that the system processes all transactions completely — nothing is lost, duplicated, or partially processed. For data processing services, this means input validation, transaction tracking, and reconciliation controls.

**What auditors test**:
- Input validation: system rejects malformed data and reports errors to the sender
- Transaction completeness: mechanism to detect dropped or stuck transactions (dead letter queues, retry tracking)
- Batch processing: start/end record counts are reconciled
- Error handling: failed transactions are logged, alerted, and reprocessed or escalated
- Idempotency: reprocessing the same input doesn't create duplicates

**Evidence to prepare**:
- Input validation rules documentation for key data interfaces
- Transaction monitoring dashboard showing throughput and error rates
- Dead letter queue or error queue monitoring configuration
- Reconciliation procedures for batch processing
- Sample error reports showing detection and resolution

---

## PI 1.2 — Processing accuracy

**Priority**: Medium | **NIST**: SI-10, SI-11 | **ISO**: A.8.28

Auditors verify that processing produces accurate results — calculations are correct, data transformations are faithful, and outputs match expected values. Accuracy controls prevent garbage-in/garbage-out scenarios.

**What auditors test**:
- Data validation at processing boundaries: input checks, transformation verification, output validation
- Automated testing: unit tests covering calculation logic, integration tests for data pipelines
- Reference data integrity: lookup tables, configuration values, and mappings are version-controlled
- Reconciliation: output totals reconciled against input totals for batch or aggregate processing
- Exception reporting: anomalous results flagged for human review

**Evidence to prepare**:
- Test suite covering processing accuracy (test results from CI/CD)
- Data validation rules and boundary checks documentation
- Reconciliation reports for the audit period
- Exception reports and resolution records
- Change log for reference data modifications

---

## PI 1.3 — Processing timeliness

**Priority**: Medium | **NIST**: SI-10 | **ISO**: A.8.28

Auditors verify that processing occurs within committed timeframes. If your service promises real-time processing or next-day batch completion, you need evidence of measuring and meeting those targets.

**What auditors test**:
- Processing SLAs defined for each service or data flow
- Latency monitoring: actual processing times measured and tracked
- Alerting on SLA breaches: team is notified when processing exceeds committed timeframes
- Historical compliance: percentage of transactions processed within SLA during the audit period
- Escalation process for sustained processing delays

**Evidence to prepare**:
- Processing SLA definitions per service
- Latency monitoring dashboard or metrics export
- SLA compliance report for the audit period
- Alert configuration for processing delay thresholds
- Incident records for any SLA breaches and their resolution

---

## PI 1.4 — Output completeness and accuracy

**Priority**: Medium | **NIST**: SI-11 | **ISO**: A.8.28

Auditors verify that system outputs are complete, accurate, and delivered to the intended recipients. This is the end-to-end check — even if processing is correct internally, outputs must reach the right destination in the right format.

**What auditors test**:
- Output validation: system verifies outputs before delivery (record counts, checksums, format checks)
- Delivery confirmation: evidence that outputs reached intended recipients
- Output access control: only authorized recipients receive the output
- Output reconciliation: recipients can verify completeness against expected results
- Error handling for failed deliveries: retry, alert, and escalation mechanisms

**Evidence to prepare**:
- Output validation rules and procedures
- Delivery confirmation logs (API responses, email delivery receipts, file transfer logs)
- Output access control configuration
- Reconciliation procedures between sender and recipient
- Failed delivery handling procedures and sample incident records

---

## PI 1.5 — Data matching and reconciliation

**Priority**: Medium | **NIST**: SI-10 | **ISO**: A.8.28

Auditors verify that the organization reconciles data across systems and processing stages. When data flows between systems, discrepancies should be detected and resolved. This is especially relevant for financial data processing, multi-system architectures, and data synchronization.

**What auditors test**:
- Cross-system reconciliation procedures defined for key data flows
- Automated reconciliation: scheduled jobs that compare records across systems
- Exception reporting: discrepancies flagged for investigation and resolution
- Resolution tracking: reconciliation exceptions are logged, investigated, and resolved within defined timeframes
- Reconciliation frequency matches the criticality of the data flow

**Evidence to prepare**:
- Reconciliation procedure documentation for each key data flow
- Automated reconciliation job configuration and schedule
- Sample reconciliation reports showing matches and exceptions
- Exception resolution records for the audit period
- Reconciliation completion metrics (percentage matched, exceptions outstanding)

---

## C 1.1 — Confidential information protection

**Priority**: High | **NIST**: AC-21, SC-28 | **ISO**: A.5.14, A.8.24

Auditors verify that information classified as confidential is protected throughout its lifecycle — collection, processing, storage, and transmission. Protection must be proportionate to the classification level and consistent across all systems where confidential data resides.

**What auditors test**:
- Data classification scheme exists: at least 2-3 levels (e.g., public, internal, confidential)
- Confidential data identified and inventoried: the organization knows where its confidential data lives
- Encryption at rest for all stores containing confidential data (databases, file storage, backups)
- Access restricted based on classification: not everyone can access confidential data
- DLP or data handling procedures: controls to prevent unauthorized sharing or exfiltration

**Evidence to prepare**:
```bash
# GCP: encryption configuration for Cloud SQL
gcloud sql instances describe {instance} --format=json | jq '{diskEncryptionConfiguration, diskEncryptionStatus}'

# GCP: bucket encryption
gcloud storage buckets describe gs://{bucket} --format=json | jq '.encryption'

# Azure: storage encryption
az storage account show --name {account} --query '{encryption: encryption.services}' --output json
```
- Data classification policy with definitions for each level
- Data inventory or data flow diagram showing where confidential data resides
- Encryption configuration evidence for all stores with confidential data
- Access control lists for confidential data repositories
- Data handling procedures for sharing or transferring confidential information

**Startup pitfalls**:
- No data classification — everything treated the same regardless of sensitivity
- Classification scheme exists on paper but not implemented in systems (no labels, no access differentiation)
- Customer data not identified as confidential — stored in general-purpose repositories accessible to all engineers

---

## C 1.2 — Confidential information disposal

**Priority**: Medium | **NIST**: MP-6, SI-12 | **ISO**: A.7.14, A.8.10

Auditors verify that confidential information is disposed of securely when retention periods expire or when the information is no longer needed. Disposal must be verifiable — "we deleted it" without a log or procedure is insufficient.

**What auditors test**:
- Data retention policy defines retention periods for different data types
- Disposal procedures documented: what method is used for different media types
- Disposal records: evidence of data deletion or destruction (logs, certificates, screenshots)
- Automated retention enforcement: scheduled deletion jobs for data past retention period
- Verification: disposal method renders data irrecoverable (cryptographic erasure, overwrite, physical destruction)

**Evidence to prepare**:
- Data retention schedule (data type, retention period, disposal method)
- Disposal records from the audit period (database purge logs, media destruction certificates)
- Automated retention policy configuration (object lifecycle rules, database TTL settings)
- Hardware disposal records with certificates of destruction
- Policy covering disposal standards (reference NIST 800-88 for media sanitization)
