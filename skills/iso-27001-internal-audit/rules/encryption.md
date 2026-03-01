# Encryption Rules

Per-control audit guidance for cryptographic controls.

## A.8.24 — Use of Cryptography

**Tier**: Critical | **NIST**: SC-8, SC-12, SC-13, SC-17, SC-28

Define and implement rules for cryptographic controls including key management. Use cryptography to protect data confidentiality, integrity, and authenticity — both in transit and at rest.

**Auditor hints**:
- Auditors check TWO things: (1) is encryption enabled, (2) is key management documented
- "Encryption at rest" must cover databases, backups, AND local storage (laptops)
- "Encryption in transit" means TLS 1.2+ for all external connections — auditors will check with `openssl s_client`
- Key rotation policy must exist even if rotation is automated — document the cadence
- Deprecated algorithms are findings: MD5, SHA-1, DES, 3DES, RC4, TLS 1.0/1.1

**Evidence collection**:
```bash
# Check TLS configuration on a domain
openssl s_client -connect example.com:443 -tls1_2 < /dev/null 2>&1 | grep -E "Protocol|Cipher"

# GCP: check encryption at rest (default is Google-managed keys)
gcloud sql instances describe {instance} --format="json(settings.ipConfiguration,settings.dataDiskEncryptionConfiguration)"

# Azure: check encryption at rest
az storage account show --name {account} --query "encryption" --output json

# GitHub: check for secrets in repos (Dependabot/secret scanning)
gh api repos/{owner}/{repo}/secret-scanning/alerts --paginate | jq 'length'

# macOS FileVault status
fdesetup status
```

**Startup pitfalls**:
- Using default cloud encryption (fine) but not documenting the key management approach
- Storing API keys/secrets in code repositories — use vault/secrets manager
- No certificate inventory — TLS certs expire and cause outages
- Assuming HTTPS means all traffic is encrypted — internal service-to-service traffic may not use TLS

---

## A.8.10 — Information Deletion

**Tier**: Relevant | **NIST**: SC-28

Delete information when no longer needed, in accordance with the retention policy. Deletion should be verifiable and cover all copies (backups, replicas, caches).

**Auditor hints**:
- Auditors check the DATA RETENTION SCHEDULE and verify it's being followed
- "We keep everything forever" is technically compliant but a GDPR risk if you handle PII
- Backup retention is often overlooked — if backups contain deleted data, the deletion isn't complete
- Soft-delete vs. hard-delete: auditors want to know which you use and whether soft-deleted data is eventually purged

---

## A.8.11 — Data Masking

**Tier**: Relevant | **NIST**: SC-28

Use data masking techniques to limit exposure of sensitive data, especially in non-production environments. Masking should maintain data utility while preventing unauthorized access to actual values.

**Auditor hints**:
- The main question: "Does your staging/dev environment use production data?"
- If yes, is it masked/anonymized? If no, how do you generate test data?
- Masking must be irreversible for non-production — tokenization is acceptable if the token store is access-controlled
- Logs are a common masking gap — sensitive data in debug logs

---

## A.8.12 — Data Leakage Prevention

**Tier**: Relevant | **NIST**: MP-7

Apply measures to prevent unauthorized disclosure of information. Monitor for and block data exfiltration through email, web uploads, USB devices, and other channels.

**Auditor hints**:
- For startups, DLP usually means: email scanning for attachments with sensitive data, endpoint USB controls, and cloud storage access restrictions
- Auditors won't expect enterprise DLP software from a startup, but they will ask: "What prevents an employee from emailing the customer database?"
- GitHub is a DLP vector — check that repos are private by default and secret scanning is enabled

**Evidence collection**:
```bash
# GitHub: verify private-by-default repo setting
gh api orgs/{org} | jq '{default_repository_permission, members_can_create_public_repositories}'

# GitHub: secret scanning alerts
gh api orgs/{org}/secret-scanning/alerts --paginate | jq 'length'

# macOS: check if USB storage is restricted
profiles show -type configuration | grep -i "removable"
```
