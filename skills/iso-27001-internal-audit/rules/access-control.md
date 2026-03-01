# Access Control Rules

Per-control audit guidance for identity, authentication, and authorization controls.

## A.5.15 — Access Control Policy & Enforcement

**Tier**: Critical | **NIST**: AC-1, AC-2, AC-3, AC-6

Ensure access to information and systems is restricted based on business and security requirements. The access control policy should define rules for granting, reviewing, and revoking access based on the principle of least privilege.

**Auditor hints**:
- Auditors want to see the access control POLICY and evidence it's being FOLLOWED — not just that a policy document exists
- They'll sample 3-5 joiners and 3-5 leavers to verify access was provisioned/revoked correctly
- Look for: quarterly access reviews with documented decisions (retain/revoke), not just screenshots of user lists
- Common gap: policy says "least privilege" but admin accounts are used for daily work

**Evidence collection**:
```bash
# GitHub org members and roles
gh api orgs/{org}/members --paginate | jq '.[] | {login, role: .role}'

# GCP IAM bindings
gcloud projects get-iam-policy {project} --format=json | jq '.bindings'

# Azure role assignments
az role assignment list --all --output json

# Google Workspace users
gam print users fields name,email,orgUnitPath,suspended,isAdmin
```

**Startup pitfalls**:
- Using shared accounts ("the deploy key") instead of individual credentials
- No documented process for access requests — "just Slack the admin" isn't auditable
- Access reviews never done or done once then abandoned

---

## A.5.16 — Identity Management

**Tier**: Critical | **NIST**: AC-2, IA-2, IA-4, IA-8, IA-12

Manage the full lifecycle of identities — from provisioning through changes to deprovisioning. Each person should have a unique identity; shared/generic accounts should be documented exceptions.

**Auditor hints**:
- Auditors check for unique user IDs — generic accounts like "admin@" or "deploy@" are flags
- They'll look for identity lifecycle evidence: joiner provisioning, mover role changes, leaver deprovisioning
- Service accounts count as identities — they need owners and review cycles too

**Evidence collection**:
```bash
# List all identities in IdP
gam print users fields primaryEmail,name,creationTime,lastLoginTime,suspended

# Service accounts (GCP)
gcloud iam service-accounts list --format=json | jq '.[] | {email, displayName, disabled}'

# GitHub service/bot accounts
gh api orgs/{org}/members --paginate | jq '[.[] | select(.type == "Bot")]'
```

---

## A.5.17 — Authentication Information

**Tier**: Critical | **NIST**: IA-1, IA-5

Manage authentication credentials (passwords, tokens, keys, certificates) through their lifecycle. Define minimum strength requirements and enforce MFA where available.

**Auditor hints**:
- MFA is the #1 thing auditors check — if it's not enforced on production systems and admin accounts, expect a finding
- They'll verify password policy in the IdP matches the documented policy
- API keys and tokens need rotation schedules — "we'll rotate if compromised" is not a policy
- SSH keys should have expiration dates or documented rotation cadence

**Evidence collection**:
```bash
# Google Workspace MFA enforcement
gam print users fields primaryEmail,isEnrolledIn2Sv,isEnforcedIn2Sv

# GitHub org MFA requirement
gh api orgs/{org} | jq '{two_factor_requirement_enabled}'

# Azure AD MFA status
az ad user list --query "[].{name:displayName,mfa:strongAuthenticationDetail}" --output json
```

---

## A.5.18 — Access Rights

**Tier**: Critical | **NIST**: AC-2, PS-5

Provision, review, modify, and revoke access rights in accordance with the access control policy. Access rights should be reviewed at regular intervals and promptly revoked when no longer needed.

**Auditor hints**:
- The "48-hour rule": auditors expect access revocation within 24-48 hours of termination, not just at the next quarterly review
- They'll cross-reference HR termination dates with last-active dates in systems
- Role changes (promotions, transfers) should trigger access reviews — people accumulate permissions over time
- Look for orphaned accounts: users who left but still show as active

**Evidence collection**:
```bash
# Cross-reference terminated users with active accounts
# Step 1: Get terminated users from HR system (export CSV)
# Step 2: Check against active users
gam print users fields primaryEmail,suspended,lastLoginTime | grep -v "True"

# GitHub: check for stale members
gh api orgs/{org}/members --paginate | jq '.[] | {login, updated_at}'
```

---

## A.8.2 — Privileged Access Rights

**Tier**: Critical | **NIST**: AC-6

Restrict and manage the allocation of privileged access rights (admin, root, superuser). Privileged access should be time-limited where possible and subject to enhanced monitoring.

**Auditor hints**:
- Auditors want a LIST of all privileged users across all systems — if you can't produce this, it's a finding
- "Everyone is admin" is a common startup pattern and a guaranteed finding
- Just-in-time (JIT) access is best practice but not required — having a small, documented set of admins is sufficient
- Privileged access should have separate credentials from daily-use accounts

**Evidence collection**:
```bash
# GCP: users with Owner/Editor roles
gcloud projects get-iam-policy {project} --format=json | \
  jq '.bindings[] | select(.role == "roles/owner" or .role == "roles/editor")'

# GitHub: org owners
gh api orgs/{org}/members?role=admin --paginate | jq '.[].login'

# Azure: Global Admins (via MS Graph)
az rest --method GET \
  --url "https://graph.microsoft.com/v1.0/directoryRoles/$(az rest --method GET --url 'https://graph.microsoft.com/v1.0/directoryRoles' --query "value[?displayName=='Global Administrator'].id" -o tsv)/members" \
  --query "value[].{displayName:displayName,upn:userPrincipalName}" -o json
```

---

## A.8.3 — Information Access Restriction

**Tier**: Critical | **NIST**: AC-3, AC-6

Restrict access to information and application functions based on the access control policy. Systems should enforce access restrictions, not rely on user self-governance.

**Auditor hints**:
- Auditors test this by checking if users have access they shouldn't — especially cross-environment (dev accessing prod data)
- Database access is a common gap: developers often have direct production database access "for debugging"
- API key scoping: keys that grant broad access when narrow scope would suffice

**Evidence collection**:
```bash
# GCP: check for overly broad IAM roles
gcloud projects get-iam-policy {project} --format=json | \
  jq '.bindings[] | select(.role | test("roles/(owner|editor|viewer)"))'

# GitHub: repo access by team
gh api orgs/{org}/teams --paginate | jq '.[].slug' | while read team; do
  echo "=== $team ===" && gh api orgs/{org}/teams/$team/repos --paginate | jq '.[].name'
done
```

---

## A.8.5 — Secure Authentication

**Tier**: Critical | **NIST**: AC-7, IA-2, IA-6, IA-8, SC-23

Implement secure authentication mechanisms including MFA, session management, account lockout, and authentication feedback controls.

**Auditor hints**:
- MFA enforcement is non-negotiable for production and admin access
- Session timeout should be configured (15-30 min inactive for sensitive systems)
- Account lockout after failed attempts — check IdP configuration
- SSO is strongly preferred over individual application passwords

**Evidence collection**:
```bash
# Google Workspace: session control and MFA
gam print users fields primaryEmail,isEnforcedIn2Sv

# GitHub: org settings
gh api orgs/{org} | jq '{two_factor_requirement_enabled, default_repository_permission}'

# Check session timeout in cloud console (usually screenshot needed)
# macOS: screencapture -x ~/evidence/session-config_$(date +%Y-%m-%d).png
```
