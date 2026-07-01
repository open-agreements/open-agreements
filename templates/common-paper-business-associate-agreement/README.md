# Common Paper Business Associate Agreement

A HIPAA business associate agreement based on [Common Paper's](https://commonpaper.com) standard terms. Covers the use and protection of protected health information (PHI) between a covered entity and a business associate.

## Source

- **URL**: https://commonpaper.com/standards/business-associate-agreement/1.0
- **Version**: 1.0
- **License**: CC BY 4.0

## Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `company_name` | string | yes | Official company name |
| `party_role` | string | yes | Role in the agreement (Business Associate or Covered Entity) |
| `principal_agreement` | string | yes | Reference to the principal agreement |
| `subcontractor_role` | string | no | Role of subcontractors |
| `free_text` | string | no | Free text entry |
| `aggregation_restrictions` | string | no | Specific aggregation restrictions |
| `offshoring_restrictions` | string | no | Specific offshoring rights or restrictions |
| `breach_notification_unit` | string | no | Unit for breach notification period |
| `breach_notification_number` | string | no | Numeric value for the breach notification period (e.g. 5) |
| `other_changes` | string | no | Prose describing other changes to BAA Standard Terms |
| `custom_effective_date` | string | no | Custom effective date |


### Signature Block

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `provider_signatory_type` | enum (`entity` / `individual`) | no | Whether the Provider signatory is an entity or individual (default: `entity`) |
| `provider_signatory_name` | string | no | Full legal name of the Provider's signatory |
| `provider_signatory_title` | string | no | Title/role of the Provider's signatory (entity only) |
| `provider_signatory_company` | string | no | Company name for the Provider signatory (entity only) |
| `provider_signatory_email` | string | no | Notice email address for the Provider |
| `company_signatory_type` | enum (`entity` / `individual`) | no | Whether the Company signatory is an entity or individual (default: `entity`) |
| `company_signatory_name` | string | no | Full legal name of the Company's signatory |
| `company_signatory_title` | string | no | Title/role of the Company's signatory (entity only) |
| `company_signatory_company` | string | no | Company name for the Company signatory (entity only) |
| `company_signatory_email` | string | no | Notice email address for the Company |

> **Note:** `*_title` and `*_company` are only rendered when the corresponding `*_type` is `entity` (default). When set to `individual`, those cells are left blank even if values are provided.

## Attribution

Based on the Common Paper Business Associate Agreement, available at https://commonpaper.com.
Licensed under CC BY 4.0. Copyright Common Paper, Inc.
