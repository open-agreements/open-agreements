# Common Paper Mutual NDA

A mutual non-disclosure agreement based on [Common Paper's](https://commonpaper.com) standard terms.

## Source

- **URL**: https://github.com/CommonPaper/Mutual-NDA
- **Standard Terms**: https://commonpaper.com/standards/mutual-nda/1.0
- **Version**: 1.0
- **License**: CC BY 4.0

> **Correction, 2026-08-20.** This line previously read `**Version**: 2.0`. There has
> never been a Common Paper Mutual NDA 2.0 — this was wrong from the day the record was
> created, not a version that later went stale. `commonpaper.com/standards/mutual-nda/2.0`
> returns HTTP 404 while `/1.0` returns 200, and `github.com/CommonPaper/Mutual-NDA` has
> exactly one release: "Common Paper Mutual NDA v1.0", published 2021-12-17. The error
> entered as a copy-paste from the sibling Cloud Service Agreement README, written in the
> same OpenAgreements bootstrap commit (546238a6, 2026-02-07), where `2.0` was then the
> correct Common Paper version. `metadata.yaml` was corrected to `1.0` early (69ac93f1)
> and every generated artifact has said 1.0 since; only this hand-written line disagreed.

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

## Selection Semantics

The fill flow preserves only selected option text for checkbox-style Mutual NDA
term and confidentiality-term choices, while marking selected choices with
`[ x ]`.

- Fixed-duration `mnda_term` and fixed-term `confidentiality_term` choices mark
  the fixed-term options with `[ x ]` and remove conflicting alternatives such
  as "until terminated" or "in perpetuity".
- `until terminated` and `In perpetuity` choices mark those selected options
  with `[ x ]` and remove non-selected fixed-term alternatives.

## Behavioral Scenarios

### [OA-TMP-007] Fixed term selection removes non-selected options
- **GIVEN** the user sets `mnda_term` to a fixed duration
- **AND** sets `confidentiality_term` to fixed-term language
- **WHEN** the template is filled
- **THEN** fixed-term options are marked with `[ x ]`
- **AND** conflicting alternatives (for example "until terminated" or "in perpetuity") are removed

### [OA-TMP-008] Perpetual selection marks selected options
- **GIVEN** the user sets `mnda_term` to `until terminated`
- **AND** sets `confidentiality_term` to `In perpetuity`
- **WHEN** the template is filled
- **THEN** the selected until-terminated and perpetuity options are marked with `[ x ]`
- **AND** non-selected fixed-term alternatives are removed

## Attribution

Based on the Common Paper Mutual NDA, available at https://commonpaper.com.
Licensed under CC BY 4.0. Copyright Common Paper, Inc.
