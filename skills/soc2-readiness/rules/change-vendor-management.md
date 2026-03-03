# Change and Vendor Management — CC 8.1, CC 9.1–9.2

Per-criterion audit guidance for change control, risk mitigation, and third-party management.

## CC 8.1 — Change control

**Priority**: Critical | **NIST**: CM-3, CM-5, SA-3 | **ISO**: A.8.9, A.8.25, A.8.32

Auditors assess whether changes to production systems follow a documented, consistent process — authorization, testing, approval, and deployment. This is one of the top 5 most-tested criteria. Expect auditors to select a sample of production changes and trace each through the full lifecycle.

**What auditors test**:
- Sample 10-15 production deployments: verify each had a code review, testing evidence, and approval before merge
- Segregation of duties: the person who writes code cannot be the sole approver and deployer
- Emergency change process: hotfixes still require documentation (even if retroactive)
- Rollback capability: evidence that changes can be reverted if issues arise
- Branch protection: direct pushes to production branch are blocked; force-push is disabled

**Evidence to prepare**:
```bash
# GitHub: merged PRs with review status
gh pr list --state merged --limit 20 --json number,title,author,reviewDecision,mergedAt,mergedBy

# GitHub: branch protection rules
gh api repos/{owner}/{repo}/branches/main/protection | jq '{
  required_reviews: .required_pull_request_reviews.required_approving_review_count,
  dismiss_stale: .required_pull_request_reviews.dismiss_stale_reviews,
  enforce_admins: .enforce_admins.enabled,
  required_status_checks: .required_status_checks.contexts
}'

# GitHub: check for direct pushes bypassing PR process
gh api repos/{owner}/{repo}/commits --per-page=20 | \
  jq '[.[] | select(.parents | length == 1)] | .[] | {sha: .sha[0:8], message: .commit.message[0:60], author: .author.login}'

# CI/CD: verify automated tests run on PRs
gh api repos/{owner}/{repo}/actions/workflows --jq '.workflows[] | {name, state}'
```
- Change management policy document
- Emergency change procedure (when and how hotfixes are handled)
- Deployment runbook or CI/CD pipeline documentation

**Startup pitfalls**:
- Founders bypass branch protection using admin override — auditors see this in the commit history
- "We review in Slack" — verbal approvals aren't auditable; use PR reviews
- No emergency change process — every hotfix is undocumented and unreviewed
- Testing means "it works on my machine" — no automated test suite or staging environment

---

## CC 9.1 — Risk mitigation activities

**Priority**: High | **NIST**: CP-2, RA-7 | **ISO**: A.5.30, C.6.1.3

Auditors verify that identified risks have corresponding mitigation activities — controls, insurance, transfer, or documented acceptance. A risk register without linked mitigations is incomplete. The connection between risk assessment (CC 3) and concrete risk treatment is what auditors evaluate here.

**What auditors test**:
- Risk register entries include treatment decisions: mitigate, transfer, accept, or avoid
- Accepted risks have documented justification and management sign-off
- Mitigation controls are mapped to specific risks (traceability from risk to control)
- Business continuity plan addresses the organization's top operational risks
- Insurance coverage reviewed annually (cyber insurance, E&O, D&O as applicable)

**Evidence to prepare**:
- Risk register with treatment column (mitigate/transfer/accept/avoid) and control mapping
- Risk acceptance forms signed by management for accepted risks
- Business continuity plan covering top-5 operational risk scenarios
- Cyber insurance certificate of coverage (current policy period)
- Management review minutes where risk treatment decisions were discussed

---

## CC 9.2 — Vendor and third-party management

**Priority**: Critical | **NIST**: AC-20, SA-9 | **ISO**: A.5.19, A.5.22

Auditors verify that the organization identifies, assesses, and monitors third-party vendors who access, store, or process data on its behalf. This includes cloud providers, SaaS tools, payment processors, and contractors with system access. The vendor management program should be proportionate to risk.

**What auditors test**:
- Vendor inventory: comprehensive list of vendors with data access, criticality rating, and review dates
- Risk assessment for critical vendors: documented evaluation of security posture before onboarding
- SOC 2 or equivalent reports collected annually from critical vendors (cloud providers, data processors)
- Vendor contracts include security requirements, data handling terms, and breach notification clauses
- Ongoing monitoring: critical vendor reviews at least annually, not just at initial onboarding

**Evidence to prepare**:
```bash
# GitHub: list third-party integrations
gh api orgs/{org}/installations --jq '.installations[] | {app_slug, permissions, events}'

# GCP: list external service accounts with access
gcloud projects get-iam-policy {project} --format=json | \
  jq '.bindings[] | .members[] | select(contains("serviceAccount")) | select(contains("gserviceaccount.com") | not)'
```
- Vendor register (name, service, data access level, criticality, last review date)
- Vendor SOC 2 Type II reports for critical vendors (AWS, GCP, Azure, Stripe, etc.)
- Vendor security assessment questionnaire template
- Data processing agreements (DPAs) with vendors handling personal data
- Vendor onboarding and offboarding procedures

**Startup pitfalls**:
- No vendor inventory — dozens of SaaS tools adopted without tracking who has data access
- Relying on "they're a big company, they must be secure" instead of collecting SOC 2 reports
- No DPAs with vendors processing personal data — GDPR and SOC 2 both require this
- Vendor review is one-and-done at onboarding — no annual reassessment
