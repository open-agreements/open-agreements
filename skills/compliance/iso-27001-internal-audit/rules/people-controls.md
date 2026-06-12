# People Controls Rules

Per-control audit guidance for HR security lifecycle.

## A.6.1 — Screening

**Tier**: Critical | **NIST**: PS-1, PS-2, PS-3

Conduct background verification checks on all candidates before employment, proportionate to the role's access to sensitive information. Re-screen at defined intervals for high-risk roles.

**Auditor hints**:
- Auditors sample employee files to verify background checks were completed BEFORE start date
- For startups: at minimum, verify identity and right to work; criminal background checks for roles with data access
- Contractor/vendor screening is often missed — if they access your systems, they need screening too
- Re-screening is recommended but not always required — document your policy either way
- International hires need jurisdiction-appropriate screening

**Evidence collection**:
- HR records showing background check completion dates vs. start dates
- Background check provider contract/agreement
- Screening policy document defining scope per role type

---

## A.6.2 — Terms and Conditions of Employment

**Tier**: Critical | **NIST**: PS-6

Employment agreements should include information security responsibilities, including confidentiality obligations, acceptable use, and consequences for non-compliance. These apply during and after employment.

**Auditor hints**:
- Auditors check that EVERY employee has a signed agreement with security clauses — even founders
- The agreement must cover: confidentiality, IP assignment, acceptable use, and post-termination obligations
- Contractors need equivalent agreements (often separate NDAs)
- Auditors sample 3-5 employee files to verify signatures exist

**Evidence collection**:
- Template employment agreement (showing security clauses)
- Sample of signed agreements (redacted as needed)
- Contractor NDA/security agreement template

---

## A.6.3 — Information Security Awareness, Education, and Training

**Tier**: Relevant | **NIST**: AT-1, AT-2

Ensure all personnel receive appropriate security awareness training at onboarding and regular intervals. Training should cover the organization's security policies, incident reporting, and role-specific threats.

**Auditor hints**:
- Auditors want COMPLETION RECORDS, not just "we have a training program"
- Annual refresher training is the minimum expected cadence
- Phishing simulation results count as evidence of awareness training effectiveness
- Role-specific training (developers get secure coding, admins get privilege management) earns extra credit
- New hire training should happen within first 30 days — auditors check dates

**Evidence collection**:
- Training completion records (export from LMS or training platform)
- Training content outline/syllabus
- Phishing simulation results (if applicable)
- New hire onboarding checklist showing training step

---

## A.6.4 — Disciplinary Process

**Tier**: Relevant | **NIST**: PS-8

Establish a formal disciplinary process for personnel who commit security policy violations. The process should be communicated to all employees and applied consistently.

**Auditor hints**:
- Auditors check that a policy EXISTS and is communicated — they won't ask for examples of disciplinary actions
- The policy should be referenced in the employee handbook or security policy
- It should cover: escalation levels, investigation process, possible sanctions
- For startups: having this documented in the employee handbook is sufficient

---

## A.6.5 — Responsibilities After Termination or Change of Employment

**Tier**: Critical | **NIST**: PS-4, PS-5

Define and enforce information security responsibilities that remain valid after employment ends or changes. Promptly revoke access when employment terminates.

**Auditor hints**:
- This is the #1 people control that fails — auditors cross-reference termination dates with access revocation dates
- "48-hour rule": access should be revoked within 24-48 hours of termination, ideally same-day
- Role changes should trigger access review — people accumulate permissions over time
- Departing employees should return all company equipment and confirm data deletion from personal devices
- Exit interviews should include security reminders (ongoing confidentiality obligations)

**Evidence collection**:
```bash
# Cross-reference: get list of terminated users, check against active accounts
# Google Workspace: suspended users (should correlate with terminations)
gam print users fields primaryEmail,suspended,suspensionReason | grep "True"

# GitHub: check for org members who should have been removed
gh api orgs/{org}/members --paginate | jq '.[].login'

# Compare against HR termination list (manual step)
```

---

## A.6.6 — Confidentiality or Non-Disclosure Agreements

**Tier**: Relevant | **NIST**: PS-6

Identify and document confidentiality requirements, and ensure agreements are signed by personnel and external parties who access organizational information.

**Auditor hints**:
- Auditors verify that NDAs/confidentiality agreements cover: employees, contractors, vendors, and any third party with system access
- The agreement should define: what's confidential, duration of obligation, consequences of breach
- For startups: confidentiality clause in the employment agreement + separate NDA for contractors
- Auditors sample files to verify signatures — electronic signatures are acceptable

---

## A.6.7 — Remote Working

**Tier**: Relevant | **NIST**: AC-17, PE-17

Define security requirements for remote working, including endpoint protection, network security, physical security of work environment, and data handling.

**Auditor hints**:
- With remote-first startups, this control is increasingly important
- Auditors check: VPN/zero-trust access, endpoint encryption, screen lock policy, acceptable use for home networks
- Physical security of home office is hard to verify — document the policy and self-attestation
- Wi-Fi security: employees should not work on public networks without VPN

**Evidence collection**:
```bash
# macOS: verify FileVault encryption
fdesetup status

# macOS: verify screen lock
system_profiler SPConfigurationProfileDataType | grep -A5 "maxInactivity"

# MDM: endpoint compliance status (depends on your MDM tool)
```

---

## A.6.8 — Information Security Event Reporting

**Tier**: Relevant | **NIST**: IR-4, IR-6

All personnel should know how to identify and report security events through defined channels. The organization should make reporting easy and ensure no negative consequences for good-faith reporting.

**Auditor hints**:
- Auditors will ask random employees: "How would you report a security incident?"
- The answer should be consistent (same channel/process) — if it varies, training is inadequate
- False positive reports are GOOD — they show the system is working and people are vigilant
- No-retaliation policy should be explicit in the security policy

**Evidence collection**:
- Incident reporting procedure document
- Training records confirming reporting awareness
- Reporting channel configuration (Slack channel, email alias, ticketing system)
- Sample of reported events (even false positives)
