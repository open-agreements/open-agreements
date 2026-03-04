# Common Paper Mutual NDA

A mutual non-disclosure agreement based on [Common Paper's](https://commonpaper.com) standard terms.

## Source

- **URL**: https://github.com/CommonPaper/Mutual-NDA
- **Version**: 2.0
- **License**: CC BY 4.0

## Fields

### Terms

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `purpose` | string | yes | How Confidential Information may be used |
| `effective_date` | date | yes | Date the NDA takes effect |
| `mnda_term` | string | yes | Period for sharing Confidential Information (e.g. "1 year", "2 years") |
| `confidentiality_term` | string | yes | How long Confidential Information remains protected |
| `confidentiality_term_start` | string | yes | When the confidentiality term begins counting |

### Legal

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `governing_law` | string | yes | State whose laws govern the agreement |
| `jurisdiction` | string | yes | Courts with jurisdiction over disputes |
| `changes_to_standard_terms` | string | no | Any modifications to the Common Paper Standard Terms |

### Signature Block

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `party_1_type` | enum (`entity` / `individual`) | no | Whether the first party is an entity or individual (default: `entity`) |
| `party_1_name` | string | no | Full legal name of the first party's signatory |
| `party_1_title` | string | no | Title/role of the first party's signatory (entity only) |
| `party_1_company` | string | no | Company name for the first party (entity only) |
| `party_1_email` | string | no | Notice email address for the first party |
| `party_2_type` | enum (`entity` / `individual`) | no | Whether the second party is an entity or individual (default: `entity`) |
| `party_2_name` | string | no | Full legal name of the second party's signatory |
| `party_2_title` | string | no | Title/role of the second party's signatory (entity only) |
| `party_2_company` | string | no | Company name for the second party (entity only) |
| `party_2_email` | string | no | Notice email address for the second party |

> **Note:** `party_N_title` and `party_N_company` are only rendered when `party_N_type` is `entity` (default). When set to `individual`, those cells are left blank even if values are provided.

## Attribution

Based on the Common Paper Mutual NDA, available at https://commonpaper.com.
Licensed under CC BY 4.0. Copyright Common Paper, Inc.
