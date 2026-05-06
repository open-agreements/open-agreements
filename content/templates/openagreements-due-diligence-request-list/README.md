# OpenAgreements Legal Due Diligence Request List

A modular legal due-diligence request list (DDRL) for corporate transactions.
Free to use under CC BY 4.0.

## Structure

The template ships a base form covering the eleven categories that appear in
90%+ of public-source DDRLs (corporate organization, capitalization,
subsidiaries, financial/tax, debt, material contracts, property, IP,
privacy/cybersecurity, employment, litigation, compliance, insurance,
related-party). Four optional industry riders gate via boolean toggles in
`metadata.yaml`:

| Section | Rider | Toggle field | When to enable |
|---------|-------|--------------|----------------|
| O | Tech / SaaS | `tech_rider_enabled` | Software, SaaS, marketplace, or data-heavy targets |
| P | Life Sciences | `life_sciences_rider_enabled` | Biotech, pharma, medtech, diagnostics targets with FDA-regulated pipelines |
| Q | Healthcare Provider | `healthcare_provider_rider_enabled` | Clinics, hospitals, physician groups, telehealth providers with payer-reimbursement exposure |
| R | Cross-Border / Trade Compliance | `cross_border_rider_enabled` | Foreign subsidiaries, foreign customers, government customers, controlled-jurisdiction exposure |

Each rider is rendered in `template.docx` inside its own `{IF rider_enabled}…{END-IF}` sub-table so the docx-templates "one IF per row" constraint is honored.

## AI augmentation

Each rider has a paired `additional_questions_<rider>` array field. AI
workflows (or human drafters) populate these arrays with target-specific
custom questions; the DOCX renders them via `{FOR q IN <array>}` loops at
the end of the matching section. A separate `additional_questions_general`
array covers cross-cutting questions that don't belong to any rider.

The arrays are independent because the OA validator's `SAFE_TAG_RE` forbids
inline filtering of a shared array (see `validation/template.ts:252`). When
a future renderer extension lifts that constraint, the arrays can be merged
into a single shared array filtered by section.

## Materiality and lookback

The cover sheet specifies a global dollar threshold (`materiality_threshold_usd`,
default `$100,000`), a relative-revenue threshold
(`materiality_threshold_revenue_pct`, default `5%`), and a default lookback
(`lookback_years`, default `3`). Three optional override fields
(`litigation_lookback_years`, `tax_lookback_years`, `compliance_lookback_years`)
let drafters extend specific sections without changing the global default.

The dollar-threshold fields are stored as pre-formatted strings (e.g.,
`"$100,000"`) because the OA fill engine has no currency formatter. When a
formatter is added, these can become `type: number`.

## Sources and attribution

The category structure is drawn from public-source consensus across 15 Am
Law firm, bar association, and legal publisher DDRLs (Cooley, Skadden,
Morgan Lewis, Gunderson Dettmer, Lowenstein Sandler, Holland & Knight,
Foley & Lardner, Software Equity Group, the International Bar Association,
the American Bar Association, Bass Berry & Sims, and Carta). All language
is original; no source language was reused. The companion practice note
at `practice-notes/due-diligence/request-list/practice-note.md` in the
`legal-context` repo (synced as `practice-note.md` in this directory)
provides citations and consensus analysis.

## Files

- `metadata.yaml` — field definitions and template metadata.
- `template.docx` — fillable Word document with `{field}` placeholders and `{IF}` rider gates. (TODO: generate via the spec-driven renderer in a follow-up PR; the v1 release ships metadata + markdown only.)
- `template.md` — flat human-readable mirror of the document body.
- `practice-note.md` — synced from `legal-context`; provides citations and drafting context.
- `README.md` — this file.

## License

CC BY 4.0. Attribute "OpenAgreements contributors."
