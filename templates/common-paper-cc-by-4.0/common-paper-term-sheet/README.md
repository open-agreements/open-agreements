# Common Paper Term Sheet

A term sheet template for outlining key business terms, based on [Common Paper's](https://commonpaper.com) standard form.

## Source

- **URL**: https://commonpaper.com/standards/term-sheet
- **Version**: 1.0
- **License**: CC BY 4.0

## Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `company_name` | string | yes | Official name of the company |
| `topic` | string | yes | Topic or subject area of the term |
| `topic_details` | string | yes | Details about the topic |


### Signature Block

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `party_1_signatory_type` | enum (`entity` / `individual`) | no | Whether the first party signatory is an entity or individual (default: `entity`) |
| `party_1_signatory_name` | string | no | Full legal name of the first party's signatory |
| `party_1_signatory_title` | string | no | Title/role of the first party's signatory (entity only) |
| `party_1_signatory_company` | string | no | Company name for the first party signatory (entity only) |
| `party_1_signatory_email` | string | no | Notice email address for the first party |
| `party_2_signatory_type` | enum (`entity` / `individual`) | no | Whether the second party signatory is an entity or individual (default: `entity`) |
| `party_2_signatory_name` | string | no | Full legal name of the second party's signatory |
| `party_2_signatory_title` | string | no | Title/role of the second party's signatory (entity only) |
| `party_2_signatory_company` | string | no | Company name for the second party signatory (entity only) |
| `party_2_signatory_email` | string | no | Notice email address for the second party |

> **Note:** `*_title` and `*_company` are only rendered when the corresponding `*_type` is `entity` (default). When set to `individual`, those cells are left blank even if values are provided.

## Attribution

Based on the Common Paper Term Sheet, available at https://commonpaper.com.
Licensed under CC BY 4.0. Copyright Common Paper, Inc.
