# Common Paper Pilot Agreement

A pilot agreement based on [Common Paper's](https://commonpaper.com) standard terms, covering trial periods for cloud services.

## Source

- **URL**: https://commonpaper.com/standards/pilot-agreement/1.1
- **Version**: 1.1
- **License**: CC BY 4.0

## Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `company_name` | string | yes | Official company name |
| `product_description` | string | yes | Description of the product being piloted |
| `pilot_period` | string | yes | Length of the pilot period |
| `custom_start_date` | string | no | Custom start date |
| `pilot_fee` | string | no | Fee for the pilot period |
| `fees_description` | string | no | Description of fees |
| `payment_frequency` | string | no | Payment frequency |
| `payment_terms_days` | string | no | Days to pay after invoice |
| `payment_due_from` | string | no | When payment terms start |
| `technical_support` | string | no | Description of support |
| `support_policy_reference` | string | no | Reference to support policy |
| `general_cap_amount` | string | no | General liability cap amount |
| `cap_multiplier` | string | no | Liability cap multiplier |
| `governing_law` | string | yes | Governing law jurisdiction |
| `jurisdiction` | string | yes | Courts with jurisdiction |


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

Based on the Common Paper Pilot Agreement, available at https://commonpaper.com.
Licensed under CC BY 4.0. Copyright Common Paper, Inc.
