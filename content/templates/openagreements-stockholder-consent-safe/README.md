# OpenAgreements Stockholder Consent for SAFE Financing

Stockholder consent template for approving the issuance of one or more Simple
Agreements for Future Equity (SAFEs) by a Delaware corporation.

## Source

- **URL**: https://github.com/open-agreements/open-agreements/tree/main/content/templates/openagreements-stockholder-consent-safe
- **Version**: 1.2
- **License**: CC BY 4.0

## Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `company_name` | string | yes | Full legal name of the company |
| `effective_date` | date | yes | Date the consent is effective |
| `purchase_amount` | string | yes | Aggregate SAFE purchase amount |
| `stockholders` | array | yes | Stockholders signing the consent |

## Canonical Markdown Authoring

The stockholder consent is authored canonically in
`content/templates/openagreements-stockholder-consent-safe/template.md`, with
the generated JSON spec and rendered DOCX derived from that source.

Compiled, rendered, and filled outputs preserve the stockholder consent legal
text, Section 228 timing behavior, placeholders, and professional formatting.
The signature section expands `stockholders` into the exact number of signer
blocks without leaving loop markers in the filled output.

The SAFE stockholder consent supports a separate `recitals` body section so
WHEREAS clauses can be authored separately from operative resolutions. The
canonical source declares `<!-- oa:section type=recitals -->` before
`## Recitals` and `<!-- oa:section type=standard_terms -->` before
`## Resolutions`; rendering preserves recital text, resolution text, ordering,
and signature behavior.

## Attribution

Authored by OpenAgreements contributors. Drafting structure informed by
publicly available Series Seed SAFE stockholder consent materials. Licensed
under CC BY 4.0.
