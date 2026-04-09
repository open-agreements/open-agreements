# Stockholder Consent for SAFE Financing

Action by written consent of the stockholders of a Delaware corporation approving the
issuance of one or more Simple Agreements for Future Equity (SAFEs).

## Source

- **URL**: https://github.com/cooleyLLP/seriesseed
- **Derived from**: Series Seed — Stockholder Consent
- **License**: CC0 1.0 Universal Public Domain Dedication

## Fields

### Parties

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `company_name` | string | yes | Full legal name of the company |

### Terms

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `effective_date` | date | yes | Date the consent is effective |

### Deal Terms

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `purchase_amount` | string | yes | Aggregate SAFE purchase amount (e.g., "500,000") |

### Signatures

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `stockholder_1_name` | string | yes | Full name of the first stockholder |
| `stockholder_2_name` | string | yes | Full name of the second stockholder |
| `stockholder_3_name` | string | yes | Full name of the third stockholder |

## Notes

- This consent is scoped to **Delaware corporations** and references Section 228 of the
  Delaware General Corporation Law.
- Resolutions become effective only after Board approval, with a **60-day maximum window**
  from delivery.
- The consent authorizes **one or more SAFEs** in a round — individual investor names and
  economic terms are carried by each SAFE agreement, not this stockholder consent.
- The consent does **not** cover concurrent charter amendments, conversion of outstanding
  convertible notes, or side letters granting pro rata or information rights. Consult
  counsel for those matters.

## Attribution

Derived from the Cooley Series Seed Stockholder Consent, available at
https://github.com/cooleyLLP/seriesseed. Made available under CC0 1.0
Universal Public Domain Dedication.
