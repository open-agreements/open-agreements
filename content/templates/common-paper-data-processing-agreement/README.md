# Common Paper Data Processing Agreement

A data processing agreement based on [Common Paper's](https://commonpaper.com) standard terms. Covers GDPR and data protection compliance, including processor/controller roles, data transfers, subprocessors, and security measures.

## Source

- **URL**: https://commonpaper.com/standards/data-processing-agreement/1.1
- **Version**: 1.1
- **License**: CC BY 4.0

## Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `company_name` | string | yes | Official company name |
| `product_name` | string | yes | Name of product or service |
| `underlying_agreement` | string | yes | Name and date of the underlying agreement |
| `customer_contact_name` | string | yes | Customer contact name |
| `customer_contact_title` | string | no | Customer contact title |
| `customer_address` | string | yes | Customer's physical address |
| `provider_contact_name` | string | yes | Provider contact name |
| `provider_contact_title` | string | no | Provider contact title |
| `provider_address` | string | yes | Provider's physical address |
| `physical_address` | string | no | Physical address for notifications |
| `contact_address` | string | no | Email and/or physical address |
| `provider_role` | string | yes | Provider's role (Controller or Processor) |
| `governing_law` | string | yes | Governing law state/province/country |
| `eu_member_state` | string | no | EU Member State for disputes |
| `uk_governing_law` | string | no | UK governing law selection |
| `subprocessor_name` | string | no | Subprocessor name |
| `custom_option` | string | no | Custom option for selections |
| `custom_options` | string | no | Multiple custom options |
| `url` | string | no | URL for references |
| `countries_list` | string | no | List of all countries for data transfers |
| `csa_reference` | string | no | Common Paper CSA reference |
| `non_csa_reference` | string | no | Non-CSA agreement reference |
| `security_measures` | string | no | Description of security measures |
| `text_box` | string | no | General text box entry |
| `fill_in_value` | string | no | General fill-in value |
| `cap_multiplier` | string | no | Liability cap multiplier |
| `policy_url` | string | no | URL of where to find policies |


### Signature Block

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `provider_signatory_type` | enum (`entity` / `individual`) | no | Whether the Provider signatory is an entity or individual (default: `entity`) |
| `provider_signatory_name` | string | no | Full legal name of the Provider's signatory |
| `provider_signatory_title` | string | no | Title/role of the Provider's signatory (entity only) |
| `provider_signatory_company` | string | no | Company name for the Provider signatory (entity only) |
| `customer_signatory_type` | enum (`entity` / `individual`) | no | Whether the Customer signatory is an entity or individual (default: `entity`) |
| `customer_signatory_name` | string | no | Full legal name of the Customer's signatory |
| `customer_signatory_title` | string | no | Title/role of the Customer's signatory (entity only) |
| `customer_signatory_company` | string | no | Company name for the Customer signatory (entity only) |

> **Note:** `*_title` and `*_company` are only rendered when the corresponding `*_type` is `entity` (default). When set to `individual`, those cells are left blank even if values are provided.

## Attribution

Based on the Common Paper Data Processing Agreement, available at https://commonpaper.com.
Licensed under CC BY 4.0. Copyright Common Paper, Inc.
