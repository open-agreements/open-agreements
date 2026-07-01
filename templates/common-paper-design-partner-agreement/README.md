# Common Paper Design Partner Agreement

A design partner agreement based on [Common Paper's](https://commonpaper.com) standard terms, for partnerships involving early access to a product in exchange for feedback.

## Source

- **URL**: https://commonpaper.com/standards/design-partner-agreement/1.3
- **Version**: 1.3
- **License**: CC BY 4.0

## Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `company_name` | string | yes | Official company name |
| `product_description` | string | yes | Description of the product being developed |
| `billing_period` | string | no | Billing period |
| `term_length_unit` | string | no | Unit for term length |
| `discount_amount` | string | no | Discount amount |
| `free_text` | string | no | Free text entry |
| `open_text` | string | no | Open text entry |
| `other_details` | string | no | Other details |
| `governing_law` | string | yes | State whose laws govern the agreement |
| `jurisdiction` | string | yes | Courts with jurisdiction over disputes |


### Signature Block

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `provider_signatory_type` | enum (`entity` / `individual`) | no | Whether the Provider signatory is an entity or individual (default: `entity`) |
| `provider_signatory_name` | string | no | Full legal name of the Provider's signatory |
| `provider_signatory_title` | string | no | Title/role of the Provider's signatory (entity only) |
| `provider_signatory_company` | string | no | Company name for the Provider signatory (entity only) |
| `provider_signatory_email` | string | no | Notice email address for the Provider |
| `partner_signatory_type` | enum (`entity` / `individual`) | no | Whether the Partner signatory is an entity or individual (default: `entity`) |
| `partner_signatory_name` | string | no | Full legal name of the Partner's signatory |
| `partner_signatory_title` | string | no | Title/role of the Partner's signatory (entity only) |
| `partner_signatory_company` | string | no | Company name for the Partner signatory (entity only) |
| `partner_signatory_email` | string | no | Notice email address for the Partner |

> **Note:** `*_title` and `*_company` are only rendered when the corresponding `*_type` is `entity` (default). When set to `individual`, those cells are left blank even if values are provided.

## Attribution

Based on the Common Paper Design Partner Agreement, available at https://commonpaper.com.
Licensed under CC BY 4.0. Copyright Common Paper, Inc.
