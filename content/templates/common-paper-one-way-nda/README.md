# Common Paper One-Way NDA

A one-way (unilateral) non-disclosure agreement based on [Common Paper's](https://commonpaper.com) standard terms. The Discloser shares confidential information with the Receiver.

## Source

- **URL**: https://commonpaper.com/standards/one-way-nda/1.0
- **Version**: 1.0
- **License**: CC BY 4.0

## Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `discloser_name_and_address` | string | yes | Company name and address of the Discloser |
| `effective_date` | date | yes | Date the NDA takes effect |
| `purpose` | string | yes | How Confidential Information may be used |
| `nda_term` | string | yes | Period for sharing Confidential Information |
| `confidentiality_term_start` | string | yes | When the confidentiality term begins counting |
| `governing_law` | string | yes | State whose laws govern the agreement |
| `jurisdiction` | string | yes | Courts with jurisdiction over disputes |
| `changes_to_standard_terms` | string | no | Any modifications to the Standard Terms |


### Signature Block

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `recipient_signatory_type` | enum (`entity` / `individual`) | no | Whether the Recipient signatory is an entity or individual (default: `entity`) |
| `recipient_signatory_name` | string | no | Full legal name of the Recipient's signatory |
| `recipient_signatory_title` | string | no | Title/role of the Recipient's signatory (entity only) |
| `recipient_signatory_company` | string | no | Company name for the Recipient signatory (entity only) |
| `recipient_signatory_email` | string | no | Notice email address for the Recipient |

> **Note:** `*_title` and `*_company` are only rendered when the corresponding `*_type` is `entity` (default). When set to `individual`, those cells are left blank even if values are provided.

## Attribution

Based on the Common Paper One-Way NDA, available at https://commonpaper.com.
Licensed under CC BY 4.0. Copyright Common Paper, Inc.
