# Common Paper Independent Contractor Agreement

An independent contractor agreement based on [Common Paper's](https://commonpaper.com) standard form.

## Source

- **URL**: https://commonpaper.com/standards/independent-contractor-agreement
- **Version**: 1.0
- **License**: CC BY 4.0

## Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `company_name_and_address` | string | yes | Name and address of the company |
| `contractor_name_and_address` | string | yes | Name and address of the contractor |
| `services_description` | string | yes | Description of services |
| `rates_and_fees` | string | yes | Applicable rates and fees |
| `payment_terms` | string | yes | Invoice and payment terms |
| `timeline` | string | yes | Timeline and milestones |
| `governing_law` | string | yes | State whose laws govern the agreement |
| `jurisdiction` | string | yes | Courts with jurisdiction |


### Signature Block

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `company_signatory_type` | enum (`entity` / `individual`) | no | Whether the Company signatory is an entity or individual (default: `entity`) |
| `company_signatory_name` | string | no | Full legal name of the Company's signatory |
| `company_signatory_title` | string | no | Title/role of the Company's signatory (entity only) |
| `company_signatory_company` | string | no | Company name for the Company signatory (entity only) |
| `company_signatory_email` | string | no | Notice email address for the Company |
| `contractor_signatory_type` | enum (`entity` / `individual`) | no | Whether the Contractor signatory is an entity or individual (default: `entity`) |
| `contractor_signatory_name` | string | no | Full legal name of the Contractor's signatory |
| `contractor_signatory_title` | string | no | Title/role of the Contractor's signatory (entity only) |
| `contractor_signatory_company` | string | no | Company name for the Contractor signatory (entity only) |
| `contractor_signatory_email` | string | no | Notice email address for the Contractor |

> **Note:** `*_title` and `*_company` are only rendered when the corresponding `*_type` is `entity` (default). When set to `individual`, those cells are left blank even if values are provided.

## Attribution

Based on the Common Paper Independent Contractor Agreement, available at https://commonpaper.com.
Licensed under CC BY 4.0. Copyright Common Paper, Inc.
