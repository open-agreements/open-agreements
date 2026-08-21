# Common Paper One-Way NDA

A one-way (unilateral) non-disclosure agreement based on [Common Paper's](https://commonpaper.com) standard terms. The Discloser shares confidential information with the Receiver.

## Source

- **URL**: https://commonpaper.com/standards/one-way-nda
- **Document page**: https://commonpaper.com/documents/one-way-nda/
- **Version**: 1.0 — an OpenAgreements record version. Common Paper does not
  publish a version number for this form.
- **License**: CC BY 4.0

> **Correction, 2026-08-20.** The source URL previously read
> `https://commonpaper.com/standards/one-way-nda/1.0`, which returns HTTP 404 — the
> citation could not be followed to anything. The `/1.0` suffix was carried over
> from the sibling Mutual NDA, whose standard terms genuinely are published at a
> version-pinned `/standards/mutual-nda/1.0`. Common Paper publishes the One-Way NDA
> **unversioned**: `commonpaper.com/standards/one-way-nda` and
> `commonpaper.com/documents/one-way-nda/` both return 200, and this form prints its
> terms in the document rather than incorporating them by a version-pinned URL. This
> record's own `metadata.yaml` already carried the correct unversioned `source_url`,
> so only this hand-written line was wrong. The `Version: 1.0` above is
> OpenAgreements' own record version and is not a Common Paper version number —
> cite no Common Paper version for this form, and ship the printed terms pages with
> the cover page.

## Fields

> **Correction, 2026-08-20.** The Term of Confidentiality could not be set
> independently of the NDA Term. `template.docx` interpolated `{nda_term}` in the
> *Term of Confidentiality* cover-page row, and `selections.json` used the same
> variable in that row's default marker, so the two rows always printed the same
> period no matter what was filled in — the ordinary split of a short disclosure
> window against a longer protection period (a 1-year NDA Term with a 3-year Term
> of Confidentiality) was unrepresentable, and the form printed a plausible wrong
> number rather than failing. `metadata.yaml` had no `confidentiality_term` field
> at all, so passing one was silently discarded as an unknown field. The sibling
> Mutual NDA has carried a distinct `confidentiality_term` since the same
> bootstrap commit, which makes this a one-template omission rather than a design
> choice. `selections.json`'s "In perpetuity" option was keyed to
> `confidentiality_term_start` for the same reason and is now keyed to
> `confidentiality_term`, matching the Mutual NDA.


| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `discloser_name_and_address` | string | yes | Company name and address of the Discloser |
| `effective_date` | date | yes | Date the NDA takes effect |
| `purpose` | string | yes | How Confidential Information may be used |
| `nda_term` | string | yes | Period for sharing Confidential Information (the **NDA Term**) |
| `confidentiality_term` | string | yes | How long Confidential Information remains protected (the **Term of Confidentiality**) |
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
