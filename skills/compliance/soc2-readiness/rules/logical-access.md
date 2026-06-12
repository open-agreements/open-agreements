# Logical and Physical Access — CC 6.1–6.8

Per-criterion audit guidance for access control, provisioning, physical security, threat detection, and data protection.

## CC 6.1 — Logical access security

**Priority**: Critical | **NIST**: AC-2, AC-3, IA-2, SC-28 | **ISO**: A.5.15, A.8.5, A.8.24

Auditors assess whether the organization restricts system access to authorized users through layered controls — identity verification, role-based permissions, encryption, and session management. The focus is on whether controls work together as a system, not just whether individual tools are configured.

**What auditors test**:
- Sample 10-15 user accounts across systems: verify each account's access matches the person's documented role
- Confirm MFA is enforced (not just available) on all systems storing or processing sensitive data
- Verify encryption at rest (AES-256 or equivalent) for databases, object storage, and backups
- Check for shared or generic accounts — each should be documented with a named owner
- Test that failed login attempts are logged and trigger alerts after threshold (typically 5-10 attempts)

**Evidence to prepare**:
```bash
# Google Workspace: user list with MFA enforcement status
gam print users fields primaryEmail,name,orgUnitPath,isAdmin,isEnforcedIn2Sv

# GitHub: org-level security settings
gh api orgs/{org} | jq '{two_factor_requirement_enabled, default_repository_permission}'

# GCP: IAM bindings showing role assignments
gcloud projects get-iam-policy {project} --format=json | jq '.bindings[] | {role, members}'

# TLS configuration check
openssl s_client -connect {host}:443 -tls1_2 < /dev/null 2>&1 | grep "Protocol\|Cipher"

# Azure: list role assignments
az role assignment list --all --output json | jq '.[] | {principalName, roleDefinitionName, scope}'
```

**Startup pitfalls**:
- Using personal Gmail/GitHub accounts for company systems — creates access gaps when people leave
- MFA "enabled" but not "enforced" — users can skip enrollment indefinitely
- Encryption at rest assumed because "cloud provider handles it" — auditors want explicit confirmation per service
- Shared credentials for CI/CD, monitoring, or SaaS tools with no documented owner

---

## CC 6.2 — Access provisioning and deprovisioning

**Priority**: Critical | **NIST**: AC-2, PS-4, PS-5 | **ISO**: A.5.18, A.6.5

Auditors verify that access is granted through a documented authorization process and revoked promptly when no longer needed. The provisioning-to-deprovisioning lifecycle is one of the most frequently tested areas in a SOC 2 audit — expect auditors to trace individual employees from hire to termination.

**What auditors test**:
- Sample 5-10 new hires: verify access was authorized before provisioning (ticket, email approval, or workflow)
- Sample 5-10 terminations: verify access was revoked within 24-48 hours across all systems
- Cross-reference HR termination dates with last-active dates in IdP, GitHub, cloud consoles, and SaaS tools
- Check for orphaned accounts — active accounts with no corresponding current employee
- Verify that access request and revocation processes are documented, not just tribal knowledge

**Evidence to prepare**:
```bash
# Google Workspace: identify potentially orphaned accounts
gam print users fields primaryEmail,lastLoginTime,suspended | \
  awk -F',' '$2 < "2024-01-01" && $3 != "True" {print $1, $2}'

# GitHub: org members with activity dates
gh api orgs/{org}/members --paginate | jq '.[] | {login, type}'

# Cross-reference terminated employees (manual step):
# Export HR termination list → compare against active accounts in each system
```
- HR-to-IT onboarding workflow documentation (ticketing system or checklist)
- Termination checklist with explicit IT deprovisioning steps
- Access request approval records (email threads, Jira tickets, or HRIS workflow logs)

**Startup pitfalls**:
- No formal offboarding process — founder "remembers" to revoke access but misses secondary systems
- Deprovisioning only covers email — GitHub, cloud console, SaaS tools, and API keys are forgotten
- Relying on quarterly access reviews to catch terminations instead of event-driven revocation

---

## CC 6.3 — Access modification

**Priority**: High | **NIST**: AC-2, AC-6 | **ISO**: A.5.15, A.5.18

When employees change roles, get promoted, or shift teams, their access should be reviewed and adjusted. Auditors look for permission accumulation — people who retain old access after moving to a new role, gradually amassing broader access than any single role requires.

**What auditors test**:
- Sample 3-5 internal transfers or promotions: verify previous role's access was reviewed and excess removed
- Check for users with permissions spanning multiple business functions (e.g., engineering + finance access)
- Verify that role changes trigger an access review workflow, not just additive provisioning
- Look for dormant permissions: access granted months ago that hasn't been used

**Evidence to prepare**:
```bash
# GCP: identify users with multiple high-privilege roles
gcloud projects get-iam-policy {project} --format=json | \
  jq '[.bindings[] | .members[] as $m | {member: $m, role: .role}] | group_by(.member) | map(select(length > 2))'

# GitHub: users who are members of multiple teams
gh api orgs/{org}/members --paginate | jq '.[].login' | while read user; do
  teams=$(gh api orgs/{org}/members/$user/teams 2>/dev/null | jq length)
  echo "$user: $teams teams"
done
```
- Access review records from most recent quarterly review cycle
- Documentation of role-change access review process

---

## CC 6.4 — Physical access controls

**Priority**: High | **NIST**: PE-2, PE-3, PE-6 | **ISO**: A.7.2, A.7.4

Physical access to facilities housing systems and data must be restricted to authorized personnel. For cloud-native companies, this primarily means relying on cloud provider SOC 2 reports for data center controls while managing office and endpoint physical security directly.

**What auditors test**:
- For on-premises: visitor logs, badge access records, security camera footage availability
- For cloud-hosted: confirm cloud provider SOC 2 Type II report covers physical security and review for exceptions
- Office security: verify that server rooms, network closets, or sensitive areas have restricted access
- Remote workforce: endpoint encryption and screen lock policies serve as compensating controls
- Verify that physical access lists are reviewed periodically (at least annually)

**Evidence to prepare**:
```bash
# macOS: verify FileVault disk encryption
fdesetup status

# macOS: verify screen lock is configured
system_profiler SPConfigurationProfileDataType 2>/dev/null | grep -A5 "maxInactivity"
```
- Cloud provider SOC 2 Type II reports (AWS, GCP, Azure) — specifically the physical security sections
- Office badge access logs or visitor sign-in records (if applicable)
- Clean desk policy documentation
- Remote work security policy with endpoint requirements

---

## CC 6.5 — Asset disposal

**Priority**: Medium | **NIST**: MP-6 | **ISO**: A.7.10, A.7.14

When hardware, media, or storage containing sensitive data is decommissioned, the organization must ensure data is irrecoverably destroyed. Auditors verify that disposal is documented and that data can't be recovered from retired assets.

**What auditors test**:
- Inventory of disposed hardware and storage media during the audit period
- Certificates of destruction from disposal vendors (for physical media)
- Verification that cloud storage and database instances are fully deleted, not just "stopped"
- Data wiping procedures for laptops and devices before reassignment or disposal

**Evidence to prepare**:
```bash
# GCP: list deleted instances (audit log)
gcloud logging read 'resource.type="gce_instance" AND protoPayload.methodName="v1.compute.instances.delete"' \
  --limit=20 --format=json | jq '.[].protoPayload | {timestamp: .requestMetadata.requestAttributes.time, instance: .resourceName}'

# Azure: activity log for resource deletions
az monitor activity-log list --offset 90d --query "[?operationName.value=='Microsoft.Compute/virtualMachines/delete']" --output json
```
- Hardware disposal log (serial number, date, method, witness)
- Certificates of destruction from e-waste or shredding vendors
- Policy document covering data sanitization standards (NIST 800-88 reference)

---

## CC 6.6 — Threat and vulnerability detection

**Priority**: Critical | **NIST**: RA-5, SI-4 | **ISO**: A.8.8, A.8.16

Auditors verify that the organization proactively identifies vulnerabilities and threats before they're exploited. This means automated scanning, not just reactive patching. Expect auditors to ask for scan reports and remediation timelines.

**What auditors test**:
- Vulnerability scanning: automated scans running at least weekly against production infrastructure
- Scan coverage: all production-facing systems are in scope, not just a subset
- Remediation SLAs: critical vulnerabilities patched within 14-30 days, with evidence of tracking
- Penetration testing: at least annual, with documented findings and remediation
- Dependency scanning: automated checks for known vulnerabilities in third-party libraries

**Evidence to prepare**:
```bash
# GitHub: Dependabot alerts summary
gh api repos/{owner}/{repo}/dependabot/alerts --jq '[.[] | {severity: .security_advisory.severity, state}] | group_by(.severity) | map({severity: .[0].severity, count: length})'

# GitHub: code scanning alerts
gh api repos/{owner}/{repo}/code-scanning/alerts --jq '[.[] | {severity: .rule.severity, state}] | group_by(.state) | map({state: .[0].state, count: length})'

# GCP: Security Command Center findings
gcloud scc findings list organizations/{org_id} --format=json | jq '.[].finding | {category, severity, state}'
```
- Most recent vulnerability scan report (redacted if needed)
- Penetration test report and remediation status
- Vulnerability management policy with remediation SLAs by severity

**Startup pitfalls**:
- Dependabot enabled but alerts ignored — hundreds of unresolved alerts is worse than no scanner
- No penetration test ever conducted — budget at least one external test before audit
- Scanning only covers web app, not infrastructure, containers, or dependencies

---

## CC 6.7 — Transmission security

**Priority**: High | **NIST**: SC-8 | **ISO**: A.5.14, A.8.24

Data in transit must be protected from interception and tampering. Auditors verify that TLS/encryption is enforced on all channels carrying sensitive data — not just the main web app, but internal service communication, API endpoints, and data transfers.

**What auditors test**:
- TLS 1.2+ enforced on all public-facing endpoints (TLS 1.0/1.1 disabled)
- Internal service-to-service communication encrypted (mutual TLS or service mesh)
- Email encryption for sensitive communications (TLS enforcement on mail servers)
- File transfer mechanisms use encrypted protocols (SFTP, SCP — not plain FTP)
- Certificate management: no expired certificates, automated renewal preferred

**Evidence to prepare**:
```bash
# Check TLS version and cipher on production endpoint
openssl s_client -connect {host}:443 -tls1_2 < /dev/null 2>&1 | grep "Protocol\|Cipher"

# Verify TLS 1.0/1.1 are rejected
openssl s_client -connect {host}:443 -tls1 < /dev/null 2>&1 | grep "alert"
openssl s_client -connect {host}:443 -tls1_1 < /dev/null 2>&1 | grep "alert"

# GCP: SSL policy check
gcloud compute ssl-policies describe {policy-name} --format=json | jq '{minTlsVersion, profile}'

# Check certificate expiration
echo | openssl s_client -connect {host}:443 2>/dev/null | openssl x509 -noout -dates
```
- Network architecture diagram showing encryption boundaries
- TLS configuration documentation for internal services

---

## CC 6.8 — Malware prevention

**Priority**: High | **NIST**: SI-2, SI-3 | **ISO**: A.8.7, A.8.19

Auditors verify that endpoint and server protection mechanisms detect, prevent, and respond to malware. For cloud-native organizations, this extends to container image scanning and CI/CD pipeline protections.

**What auditors test**:
- Endpoint protection deployed on all company-managed devices (laptops, workstations)
- Endpoint agent is active and reporting — not just installed but disabled
- Server/container protection: image scanning in CI/CD, runtime protection in production
- Patch management: OS and application patches applied within defined SLAs
- Email filtering: anti-phishing and attachment scanning on inbound email

**Evidence to prepare**:
```bash
# macOS: check for endpoint protection agent
ls /Library/Application\ Support/ | grep -i -E "(crowdstrike|sentinel|carbon|defender)"

# macOS: verify OS is current
sw_vers

# GitHub: check for container scanning in CI
gh api repos/{owner}/{repo}/actions/workflows --jq '.workflows[].name' | grep -i -E "scan|security|snyk|trivy"
```
- Endpoint protection dashboard export showing device coverage and status
- Patch management report showing compliance percentage
- Container image scanning results from CI/CD pipeline
- Email security configuration (SPF, DKIM, DMARC records)

**Startup pitfalls**:
- "We use Macs, Macs don't get malware" — auditors expect endpoint protection regardless of OS
- Endpoint agent installed during onboarding but never verified as running
- No patch management cadence — relying on users to update their own devices
