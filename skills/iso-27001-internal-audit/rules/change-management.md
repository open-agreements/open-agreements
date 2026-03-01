# Change Management Rules

Per-control audit guidance for SDLC, configuration management, and change control.

## A.8.25 — Secure Development Lifecycle

**Tier**: Critical | **NIST**: SA-3, SA-8

Establish rules for secure development of software and systems. Apply security requirements throughout the SDLC — design, development, testing, deployment, and maintenance.

**Auditor hints**:
- Auditors want to see SDLC DOCUMENTED, not just practiced informally
- They'll check: threat modeling (even lightweight), secure coding guidelines, pre-deployment security checks
- For startups: a documented PR review checklist that includes security considerations is sufficient
- "We do code review" is not enough — show that security is part of the review criteria

**Evidence collection**:
```bash
# GitHub: branch protection requires reviews
gh api repos/{owner}/{repo}/branches/{branch}/protection | jq '{
  required_pull_request_reviews: .required_pull_request_reviews.required_approving_review_count,
  enforce_admins: .enforce_admins.enabled,
  required_status_checks: .required_status_checks.contexts
}'

# GitHub: recent PRs showing review process
gh pr list --state merged --limit 10 --json number,title,reviewDecision,mergedAt
```

---

## A.8.26 — Application Security Requirements

**Tier**: Relevant | **NIST**: SA-3

Define and document security requirements for applications, including authentication, authorization, input validation, and data protection requirements.

**Auditor hints**:
- Auditors check if security requirements are captured BEFORE development, not added after
- For web apps: OWASP Top 10 coverage is expected
- API security requirements should address authentication, rate limiting, and input validation
- If you use third-party libraries, security requirements should cover dependency management

---

## A.8.27 — Secure System Architecture and Engineering Principles

**Tier**: Checkbox | **NIST**: SA-8

Apply secure engineering principles to system architecture. Design systems with defense in depth, least privilege, and fail-secure defaults.

**Auditor hints**:
- Auditors look for architecture documentation that shows security considerations
- Network segmentation (or VPC design) is the most common check
- Zero trust principles are increasingly expected but not yet required
- For cloud: show that environments are isolated (dev/staging/prod separation)

---

## A.8.28 — Secure Coding

**Tier**: Relevant | **NIST**: SI-10, SI-11

Apply secure coding practices to minimize vulnerabilities. Address input validation, output encoding, error handling, and cryptographic usage in code.

**Auditor hints**:
- Auditors may review a recent security-relevant code change to verify practices
- SAST (static analysis) tool usage is strong evidence — even a free tool like Semgrep or CodeQL
- Dependency scanning (Dependabot, Snyk) counts as part of secure coding
- Error messages should not leak internal details (stack traces, SQL queries, file paths)

**Evidence collection**:
```bash
# GitHub: code scanning alerts (CodeQL/SAST)
gh api repos/{owner}/{repo}/code-scanning/alerts --paginate | jq 'length'

# GitHub: Dependabot alerts
gh api repos/{owner}/{repo}/dependabot/alerts?state=open | jq 'length'
```

---

## A.8.29 — Security Testing in Development and Acceptance

**Tier**: Checkbox | **NIST**: SA-11

Define and implement security testing processes during development and before production deployment. This includes functional security testing, vulnerability scanning, and penetration testing.

**Auditor hints**:
- Annual penetration test is expected for SOC 2 and increasingly for ISO
- For startups: automated security scanning in CI/CD is acceptable evidence between annual pentests
- Acceptance testing should include security test cases, not just functional tests
- Bug bounty programs count as continuous security testing

---

## A.8.30 — Outsourced Development

**Tier**: Checkbox | **NIST**: SR-5

When development is outsourced, define and enforce security requirements with the external party. Monitor compliance and ensure secure handover.

**Auditor hints**:
- If you use contractors for development, auditors check: NDAs, access provisioning/deprovisioning, code ownership
- Contractor access should be time-limited and revoked at contract end
- Code review requirements should apply equally to internal and external developers

---

## A.8.31 — Separation of Development, Test, and Production Environments

**Tier**: Checkbox | **NIST**: SA-3

Separate development, testing, and production environments to reduce the risk of unauthorized access or changes to production systems.

**Auditor hints**:
- Auditors check: can a developer push directly to production? Is prod data used in dev?
- Environment separation means: different accounts/projects/subscriptions, not just different folders
- Database access: dev should NOT have production database credentials
- CI/CD pipeline should be the ONLY path to production

**Evidence collection**:
```bash
# GCP: list projects (should show separate dev/staging/prod)
gcloud projects list --format="json(projectId,name)"

# Azure: list subscriptions
az account list --output json | jq '.[].{name, id, state}'
```

---

## A.8.32 — Change Management

**Tier**: Critical | **NIST**: CM-3, SA-10

Manage changes to information processing facilities and systems through a formal change management process. Changes should be requested, assessed, approved, implemented, and reviewed.

**Auditor hints**:
- Auditors want to see a CHANGE RECORD for every production change — git history is excellent evidence
- They'll sample 5-10 recent changes and check: was there a request, review, approval, and implementation record?
- Emergency changes ("hotfixes") must have retroactive review — skipping the process is acceptable if documented
- Rollback capability should exist — auditors may ask "what happens if this change fails?"

**Evidence collection**:
```bash
# GitHub: recent merged PRs (change records)
gh pr list --state merged --limit 20 --json number,title,author,reviewDecision,mergedAt,mergedBy

# GitHub: branch protection (prevents unreviewed changes)
gh api repos/{owner}/{repo}/branches/main/protection | jq '{
  required_reviews: .required_pull_request_reviews.required_approving_review_count,
  dismiss_stale_reviews: .required_pull_request_reviews.dismiss_stale_reviews
}'

# GitHub: deployment history
gh api repos/{owner}/{repo}/deployments --paginate | jq '.[0:10] | .[] | {environment, created_at, sha: .sha[0:8]}'
```

---

## A.8.33 — Test Information

**Tier**: Checkbox | **NIST**: SA-11

Ensure test data is adequately protected, especially when production data is used for testing. Anonymize or mask production data before use in non-production environments.

**Auditor hints**:
- If you use production data for testing, it must be masked — this is where many startups fail
- Synthetic test data is always preferred
- Test databases should have the same access controls as the environment warrants
- Automated tests should not contain hardcoded credentials or real PII

---

## A.8.34 — Protection of Information Systems During Audit Testing

**Tier**: Checkbox | **NIST**: CA-2

Protect production systems from disruption during audit testing. Audit activities (vulnerability scans, penetration tests) should be planned and authorized to minimize business impact.

**Auditor hints**:
- Auditors check that THEIR OWN testing is authorized and scoped — they'll ask you to sign off on the test plan
- Penetration tests should have written authorization (Rules of Engagement document)
- Vulnerability scans on production should be scheduled during low-traffic periods

---

## A.8.9 — Configuration Management

**Tier**: Critical | **NIST**: CM-1, CM-2, CM-3, CM-4, CM-6, CM-7, SA-10, SI-7

Define, document, and maintain secure configurations for hardware, software, and network components. Establish baselines and monitor for drift.

**Auditor hints**:
- Auditors want to see BASELINE CONFIGURATIONS — what is the "known good" state of your systems?
- For cloud: Infrastructure as Code (Terraform, CloudFormation) IS your configuration baseline
- Configuration drift detection is increasingly expected — even a weekly diff of IaC vs. deployed state
- Container images should be built from documented base images with pinned versions

**Evidence collection**:
```bash
# Terraform: show current state
terraform state list | head -20

# GCP: export compute instance configurations
gcloud compute instances list --format=json | jq '.[] | {name, machineType, status}'

# Docker: list base images
docker image ls --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"
```
