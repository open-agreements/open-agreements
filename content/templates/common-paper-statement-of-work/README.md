# Common Paper Statement of Work

A statement of work template for professional services engagements, based on [Common Paper's](https://commonpaper.com) standard form.

## Source

- **URL**: https://commonpaper.com/standards/statement-of-work
- **Version**: 1.0
- **License**: CC BY 4.0

## Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `company_name` | string | yes | Company name (shown in header) |
| `provider_name` | string | yes | Official name of the Provider |
| `customer_name` | string | yes | Official name of the Customer |
| `key_terms_effective_date` | string | yes | Effective Date of the Key Terms |
| `sow_number` | string | yes | Statement of Work number |
| `custom_sow_date` | string | no | Custom SOW date |
| `custom_end_date` | string | no | Custom end date for the SOW term |
| `term_duration_unit` | string | no | Duration unit for SOW term |
| `payment_terms` | string | yes | Payment terms |
| `fill_in_value` | string | no | General fill-in value |
| `invoice_frequency_unit` | string | no | Invoice frequency unit |
| `travel_expense_policy` | string | no | Travel and expense policy |
| `customer_owned_deliverables` | string | no | Customer-owned deliverables |


### Signature Block

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `provider_signatory_type` | enum (`entity` / `individual`) | no | Whether the Provider signatory is an entity or individual (default: `entity`) |
| `provider_signatory_name` | string | no | Full legal name of the Provider's signatory |
| `provider_signatory_title` | string | no | Title/role of the Provider's signatory (entity only) |
| `provider_signatory_company` | string | no | Company name for the Provider signatory (entity only) |
| `provider_signatory_email` | string | no | Notice email address for the Provider |
| `customer_signatory_type` | enum (`entity` / `individual`) | no | Whether the Customer signatory is an entity or individual (default: `entity`) |
| `customer_signatory_name` | string | no | Full legal name of the Customer's signatory |
| `customer_signatory_title` | string | no | Title/role of the Customer's signatory (entity only) |
| `customer_signatory_company` | string | no | Company name for the Customer signatory (entity only) |
| `customer_signatory_email` | string | no | Notice email address for the Customer |

> **Note:** `*_title` and `*_company` are only rendered when the corresponding `*_type` is `entity` (default). When set to `individual`, those cells are left blank even if values are provided.

## Attribution

Based on the Common Paper Statement of Work, available at https://commonpaper.com.
Licensed under CC BY 4.0. Copyright Common Paper, Inc.
