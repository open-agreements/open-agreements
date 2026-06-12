# Supplier Management Rules

Per-control audit guidance for third-party and supply chain risk.

## A.5.19 — Information Security in Supplier Relationships

**Tier**: Relevant | **NIST**: AC-20, SA-4, SA-9, SR-1, SR-3

Define and implement processes to manage security risks associated with supplier relationships. Establish security requirements in supplier agreements and monitor compliance.

**Auditor hints**:
- Auditors want a VENDOR INVENTORY — a list of all suppliers who access your data or systems
- Each vendor should have: a contract with security clauses, a risk assessment, and periodic review
- SOC 2 Type II reports from vendors are the gold standard evidence — request annually
- For SaaS tools: the vendor's security page or trust center is a starting point, but not sufficient alone

**Evidence collection**:
- Vendor inventory/register with risk classification
- Vendor security agreements or contract clauses
- SOC 2 / ISO 27001 reports from critical vendors
- Vendor risk assessment records

---

## A.5.20 — Addressing Information Security Within Supplier Agreements

**Tier**: Relevant | **NIST**: PS-7, SR-3, SR-8

Include information security requirements in agreements with suppliers and service providers. Agreements should address access controls, incident notification, audit rights, and data handling.

**Auditor hints**:
- Auditors sample 3-5 vendor contracts to verify security clauses exist
- Key clauses to check: data protection, incident notification timeline, right to audit, sub-processor controls
- For cloud providers: Data Processing Agreements (DPAs) should be in place if handling PII
- "We use their standard terms" — auditors want to see you REVIEWED those terms for security adequacy

---

## A.5.21 — Managing Information Security in the ICT Supply Chain

**Tier**: Relevant | **NIST**: AC-20, SA-4, SA-9, SR-2, SR-3

Address information security risks in the ICT supply chain. Assess risks from third-party components, open-source dependencies, and outsourced development.

**Auditor hints**:
- For startups: this is primarily about dependency management — what open-source libraries do you use and how do you track vulnerabilities?
- Auditors check: dependency scanning tool (Dependabot, Snyk), process for responding to critical CVEs
- Software Bill of Materials (SBOM) is increasingly expected but not yet universally required
- Container image provenance — know where your base images come from

**Evidence collection**:
```bash
# GitHub: Dependabot alerts
gh api repos/{owner}/{repo}/dependabot/alerts?state=open | jq 'length'

# GitHub: Dependabot configuration
gh api repos/{owner}/{repo}/contents/.github/dependabot.yml 2>/dev/null | jq '.content' -r | base64 -d

# npm: audit
# npm audit --json

# Python: pip-audit
# pip-audit --format=json
```

---

## A.5.22 — Monitoring, Review, and Change Management of Supplier Services

**Tier**: Relevant | **NIST**: AC-20, SA-9, SR-2, SR-5, SR-6

Regularly monitor, review, and manage changes to supplier services. Track supplier security posture and assess impact of supplier-side changes.

**Auditor hints**:
- Auditors want to see PERIODIC REVIEW of vendor security — not just at onboarding
- Annual review of critical vendor SOC 2 reports is the minimum expectation
- Track vendor security incidents — sign up for vendor status pages and security advisories
- Change management: when a vendor changes their service (new features, infrastructure migration), assess security impact

---

## A.5.23 — Information Security for Use of Cloud Services

**Tier**: Checkbox | **NIST**: SA-9

Define and manage information security requirements for cloud service usage. Establish processes for cloud service acquisition, operation, monitoring, and exit.

**Auditor hints**:
- Auditors check that you have a CLOUD SECURITY POLICY or that cloud usage is addressed in your general security policy
- For cloud-native startups: demonstrate that you've reviewed your cloud provider's shared responsibility model
- Data residency and jurisdictional requirements should be documented (where is data stored?)
- Cloud exit strategy: what happens if you need to migrate away? Is data exportable?
