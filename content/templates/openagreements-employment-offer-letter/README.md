# OpenAgreements Employment Offer Letter

Startup-oriented employment offer letter for hiring workflows where teams want
clear, editable terms and source transparency.

## Source

- **URL**: https://github.com/open-agreements/open-agreements/tree/main/templates/openagreements-employment-offer-letter
- **Version**: 1.1
- **License**: CC BY 4.0

## Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `employer_name` | string | yes | Legal name of the employer |
| `employer_signatory_name` | string | no | Full name of the authorized signatory signing for the employer |
| `employer_signatory_title` | string | no | Title of the authorized signatory signing for the employer |
| `employee_name` | string | yes | Full legal name of the employee |
| `position_title` | string | yes | Offered role title |
| `employment_type` | enum | yes | `full-time` or `part-time` |
| `start_date` | date | yes | Employment start date |
| `reporting_manager` | string | no | Manager or role this position reports to |
| `base_salary` | string | yes | Base salary or hourly amount |
| `bonus_terms` | string | no | Bonus eligibility summary |
| `equity_terms` | string | no | Equity grant summary, if any |
| `work_location` | string | yes | Primary work location and/or remote status |
| `governing_law` | string | yes | Governing law state for the offer letter |
| `offer_expiration_date` | date | yes | Date by which the offer must be accepted |

## Rendering and Memo Behavior

The employment template renderer honors signer-mode arrangements so canonical
employment templates can express asymmetric entity/individual signature blocks
without mirrored title rows or row-level suppression flags.

When `cover-standard-signature-v1` renders this template with `mode: signers`
and `arrangement=entity-plus-individual`, it renders a stacked entity signer
block followed by a stacked individual signer block in DOCX. Markdown output
preserves the same signer order, the individual signer block omits any `Title`
row, and legacy `two-party` rendering remains unchanged.

When `fill` is invoked with `--emit-memo` for an employment template matching
jurisdiction rules, JSON output includes disclaimer, findings, and jurisdiction
warnings. When no rules match, jurisdiction warnings are not fabricated.
Deterministic baseline variance findings are produced against the selected
baseline template. Markdown output includes the mandatory disclaimer and
citations.

When memo text contains prescriptive wording or prohibited phrases, the language
guard rewrites prescriptive wording and blocks prohibited phrases.

The employment template formatting integrity check renders DOCX with the
expected cover-page layout, section headings, signature block, and no leaked
template directives. Formatting diff boundary checks distinguish intentional
formatting differences from unintentional contract text drift.

Employment templates maintain paragraph style names and spacing values (e.g.
6pt) in Standard Terms sections across all employment template variants.
Run-level formatting operations preserve underline boundaries while stripping
heading-leading brackets and trimming trailing unmatched brackets without moving
anchored text.

## Behavioral Scenarios

### [OA-FIL-016] Employment memo content generation
- **WHEN** an employment template fill triggers memo generation with matching jurisdiction rules
- **THEN** output includes mandatory disclaimer, compliance findings, and jurisdiction-specific warnings
- **AND** deterministic baseline variance findings are produced against the selected baseline template
- **AND** markdown output includes mandatory disclaimer and citations

### [OA-FIL-017] Employment memo language guard
- **WHEN** memo text contains prescriptive wording or prohibited phrases
- **THEN** the language guard rewrites prescriptive wording and blocks prohibited phrases

### [OA-FIL-020] Employment template paragraph styles and spacing
- **WHEN** employment templates are examined for Standard Terms sections
- **THEN** paragraph style names match expected values
- **AND** spacing values are preserved (e.g. 6pt)

### [OA-FIL-021] Formatting boundary preservation
- **WHEN** bracket stripping operates on underlined heading text
- **THEN** underline boundaries are preserved
- **AND** trailing unmatched brackets are trimmed without moving underlined anchor text

### [OA-FIL-029] Entity-plus-individual signers draw the entity name above the line and distinguish the human signatory
- **WHEN** `cover-standard-signature-v1` renders a template with
  `mode: signers` and `arrangement=entity-plus-individual`
- **THEN** the entity signer block draws the entity's legal name in a header row
  **above** the signature line — the caps party label in the left cell, the
  entity legal-name value in the right cell, with **no rule** under it (the name
  sits above the line; it is not a line to sign on)
- **AND** the entity block renders distinct `Signatory Name` and `Title` rows for
  the human who signs on the entity's behalf (no `Print Name` row), and the
  `Signature` row is taller so the ruled line has room to sign on
- **AND** exactly one entity legal-name line is required (its label equals the
  signer `label`, e.g. `Employer: {employer_name}`); zero or duplicate is an
  authoring error that fails the render
- **AND** the individual signer block is unchanged — bold party header plus a
  `Print Name` row — and it omits any `Title` row
- **AND** the Markdown output likewise shows the entity name above the signature
  line and preserves signer order
- **AND** legacy `two-party` rendering remains unchanged

## Attribution

Authored by OpenAgreements contributors. Drafting structure informed by publicly
available permissive sources including the DocuSign template library (MIT) and
Papertrail legal-docs (CC0). Licensed under CC BY 4.0.
