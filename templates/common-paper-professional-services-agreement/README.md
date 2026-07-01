# Common Paper Professional Services Agreement

A professional services agreement based on [Common Paper's](https://commonpaper.com) standard terms. Covers consulting and professional services engagements including deliverables, IP ownership, fees, and liability.

## Source

- **URL**: https://commonpaper.com/standards/professional-services-agreement/1.1
- **Version**: 1.1
- **License**: CC BY 4.0

## Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `company_name` | string | yes | Official company name |
| `provider_name` | string | yes | Official name of the Provider |
| `customer_name` | string | yes | Official name of the Customer |
| `key_terms_effective_date` | string | yes | Effective Date of Key Terms |
| `custom_effective_date` | string | no | Custom effective date |
| `custom_sow_date` | string | no | Custom SOW date |
| `sow_number` | string | yes | Statement of Work number |
| `term_duration_unit` | string | no | Duration unit for term |
| `custom_end_date` | string | no | Custom end date |
| `payment_terms` | string | yes | Payment terms |
| `invoice_frequency_unit` | string | no | Invoice frequency unit |
| `fill_in_value` | string | no | General fill-in value |
| `fill_in_detail` | string | no | Additional detail |
| `payment_terms_days` | string | no | Days to pay after invoice |
| `non_renewal_notice_days` | string | no | Non-renewal notice days |
| `general_cap_amount` | string | no | General liability cap |
| `cap_multiplier` | string | no | Cap multiplier |
| `increased_cap_amount` | string | no | Increased cap amount |
| `greater_of_dollar` | string | no | Greater-of dollar amount |
| `governing_law` | string | yes | Governing law |
| `jurisdiction` | string | yes | Jurisdiction |
| `travel_expense_policy` | string | no | Travel and expense policy |
| `customer_owned_deliverables` | string | no | Customer-owned deliverables |
| `support_policy_reference` | string | no | Support policy reference |
| `dpa_reference` | string | no | DPA reference |


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

Based on the Common Paper Professional Services Agreement, available at https://commonpaper.com.
Licensed under CC BY 4.0. Copyright Common Paper, Inc.
