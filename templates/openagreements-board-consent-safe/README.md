# OpenAgreements Board Consent for SAFE Financing

Board consent template for approving the issuance of one or more Simple
Agreements for Future Equity (SAFEs) by a Delaware corporation.

## Source

- **URL**: https://github.com/open-agreements/open-agreements/tree/main/templates/openagreements-board-consent-safe
- **Version**: 1.2
- **License**: CC BY 4.0

## Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `company_name` | string | yes | Full legal name of the company |
| `effective_date` | date | yes | Date the consent is effective |
| `purchase_amount` | string | yes | Aggregate SAFE purchase amount |
| `board_members` | array | yes | Directors signing the consent |

## Canonical Markdown Authoring

The board consent is authored canonically in
`templates/openagreements-board-consent-safe/template.md`, with the
generated JSON spec and rendered DOCX derived from that source.

Compiled, rendered, and filled outputs preserve the board consent legal text,
resolution flow, placeholders, and professional formatting. The signature
section expands `board_members` into the exact number of signer blocks without
leaving loop markers in the filled output.

The SAFE board consent supports a separate `recitals` body section so WHEREAS
clauses can be authored separately from operative resolutions. The canonical
source declares `<!-- oa:section type=recitals -->` before `## Recitals` and
`<!-- oa:section type=standard_terms -->` before `## Resolutions`; rendering
preserves recital text, resolution text, ordering, and signature behavior.

## Behavioral Scenarios

### [OA-TMP-059] SAFE board consent canonical source preserves source fidelity
- **WHEN** the SAFE board consent canonical source is compiled, rendered, and
  filled
- **THEN** the generated outputs preserve the board consent legal text,
  resolution flow, placeholders, and professional formatting
- **AND** the signature section expands `board_members` into the exact number
  of signer blocks without leaving loop markers in the filled output

### [OA-TMP-056] SAFE consents separate WHEREAS and RESOLVED content
- **WHEN** a SAFE board or stockholder consent canonical source declares
  `<!-- oa:section type=recitals -->` before `## Recitals` and
  `<!-- oa:section type=standard_terms -->` before `## Resolutions`
- **THEN** WHEREAS clauses compile into the `recitals` section
- **AND** RESOLVED clauses compile into the operative section
- **AND** the rendered traditional consent output preserves the recital text,
  resolution text, ordering, and signature behavior

## Attribution

Authored by OpenAgreements contributors. Drafting structure informed by
publicly available Series Seed SAFE board consent materials. Licensed under
CC BY 4.0.
