# Common Paper Partnership Agreement

A partnership agreement based on [Common Paper's](https://commonpaper.com) standard terms, covering business partnerships.

## Source

- **URL**: https://commonpaper.com/standards/partnership-agreement/1.1
- **Version**: 1.1
- **License**: CC BY 4.0

## Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `company_name` | string | yes | Official company name |
| `custom_effective_date` | string | no | Custom effective date |
| `term_duration_unit` | string | no | Duration unit for term |
| `custom_end_date` | string | no | Custom end date |
| `non_renewal_notice_days` | string | no | Non-renewal notice days |
| `territory` | string | no | Geographic areas |
| `fill_in_value` | string | no | General fill-in value |
| `fill_in_detail` | string | no | Additional detail |
| `payment_terms_days` | string | no | Days to pay after invoice |
| `general_cap_amount` | string | no | General liability cap |
| `cap_multiplier` | string | no | Liability cap multiplier |
| `increased_cap_amount` | string | no | Increased liability cap |
| `dpa_reference` | string | no | DPA reference |
| `governing_law` | string | yes | Governing law |
| `jurisdiction` | string | yes | Jurisdiction |


### Signature Block

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `company_signatory_type` | enum (`entity` / `individual`) | no | Whether the Company signatory is an entity or individual (default: `entity`) |
| `company_signatory_name` | string | no | Full legal name of the Company's signatory |
| `company_signatory_title` | string | no | Title/role of the Company's signatory (entity only) |
| `company_signatory_company` | string | no | Company name for the Company signatory (entity only) |
| `company_signatory_email` | string | no | Notice email address for the Company |
| `partner_signatory_type` | enum (`entity` / `individual`) | no | Whether the Partner signatory is an entity or individual (default: `entity`) |
| `partner_signatory_name` | string | no | Full legal name of the Partner's signatory |
| `partner_signatory_title` | string | no | Title/role of the Partner's signatory (entity only) |
| `partner_signatory_company` | string | no | Company name for the Partner signatory (entity only) |
| `partner_signatory_email` | string | no | Notice email address for the Partner |

> **Note:** `*_title` and `*_company` are only rendered when the corresponding `*_type` is `entity` (default). When set to `individual`, those cells are left blank even if values are provided.

## Attribution

Based on the Common Paper Partnership Agreement, available at https://commonpaper.com.
Licensed under CC BY 4.0. Copyright Common Paper, Inc.
