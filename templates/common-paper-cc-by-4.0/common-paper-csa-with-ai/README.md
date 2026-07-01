# Common Paper CSA With AI

A cloud service agreement with AI provisions based on [Common Paper's](https://commonpaper.com) standard terms. Extends the standard CSA with AI-specific terms covering model training, input/output rights, and AI usage policies.

## Source

- **URL**: https://commonpaper.com/standards/cloud-service-agreement/2.1
- **Version**: 2.1
- **License**: CC BY 4.0

## Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `company_name` | string | yes | Company name (shown in header) |
| `provider_name` | string | yes | Name of the Provider |
| `customer_name` | string | yes | Name of the Customer |
| `key_terms_effective_date` | string | yes | Effective Date of the Key Terms |
| `cloud_service` | string | yes | Description of the cloud service |
| `custom_start_date` | string | no | Custom start date |
| `subscription_period` | string | yes | Length of access to the service |
| `pilot_period` | string | no | Length of pilot/trial period |
| `fees` | string | no | Subscription fee amount |
| `fee_unit` | string | no | Fee billing unit |
| `fill_in_value` | string | no | General fill-in value |
| `payment_frequency` | string | no | Payment frequency |
| `payment_terms_days` | string | no | Days to pay after invoice |
| `payment_due_from` | string | no | When payment terms start |
| `non_renewal_notice_days` | string | no | Non-renewal notice days |
| `technical_support` | string | no | Description of support |
| `support_policy_reference` | string | no | Reference to support policy |
| `professional_services_reference` | string | no | SOW or PSA reference |
| `professional_services_description` | string | no | Professional services description |
| `custom_effective_date` | string | no | Custom effective date |
| `governing_law` | string | yes | Governing law |
| `jurisdiction` | string | yes | Jurisdiction |
| `general_cap_amount` | string | no | General liability cap amount |
| `cap_multiplier` | string | no | Liability cap multiplier |
| `increased_cap_amount` | string | no | Increased liability cap amount |
| `greater_of_dollar` | string | no | Greater-of dollar amount |
| `greater_of_multiplier` | string | no | Greater-of multiplier |
| `dpa_reference` | string | no | DPA reference |
| `ai_policy_reference` | string | no | Reference to AI usage policy (URL or attached) |
| `ai_additional_terms` | string | no | Additional AI-specific terms |


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

Based on the Common Paper CSA With AI, available at https://commonpaper.com.
Licensed under CC BY 4.0. Copyright Common Paper, Inc.
