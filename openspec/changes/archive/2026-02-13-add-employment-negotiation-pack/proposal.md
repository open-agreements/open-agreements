# Change: Add employment negotiation pack and UPL-safe review workflow

## Why

OpenAgreements currently supports contractor and commercial agreements but does
not provide a focused workflow for employment offer and onboarding negotiation.
Developers and startup teams increasingly need fast, local-first support for
reviewing and preparing employment documents while staying inside clear
information-only (non-legal-advice) boundaries.

## What Changes

- Add a dedicated employment capability with an initial template pack:
  - employment offer letter
  - employee proprietary information and inventions assignment agreement
  - employment confidentiality/IP acknowledgement companion document
- Prioritize a trust-first, permissive-license source set for v1:
  - Balanced Employee IP Agreement (CC0) as a baseline for employee IP scope
  - DocuSign template library employment materials (MIT) as offer-letter seed text
  - Papertrail legal-docs employment forms (CC0) as optional reference inputs
  - OpenAgreements-authored templates (CC BY 4.0) with explicit provenance metadata
- Add a structured "negotiation memo" output that highlights clause
  presence/absence and non-standard terms against configured baseline templates.
- Add jurisdiction-aware warning rules for high-risk clause categories (for
  example: restrictive covenants), with clear source citations and confidence
  annotations.
- Add explicit UPL-safe product language and output constraints:
  - information and workflow support only
  - no personalized legal advice or outcome guarantees
  - escalation guidance to licensed counsel for high-risk findings
- Keep all employment sources under existing licensing controls:
  - in-repo for permissive sources
  - pointer/recipe flows where redistribution is restricted or unclear
- Add a source-terms compatibility gate:
  - classify providers with restrictive terms as `restricted-no-automation`
  - block automated fetch/checksum/recipe generation for restricted providers
  - exclude Cooley GO forms from this change

## Dependency and Sequencing

- This change can start independently for drafting-focused outputs.
- Integration with `add-authorization-approval-audit-core` is recommended for
  governance of sensitive review/export actions.
- Integration with `add-signature-connectors` is deferred to follow-on phases.

## Scope Boundaries

### In scope (v1)

- Employment pack template authoring and metadata
- Interview-driven fill flow for employment templates
- Structured negotiation memo generation
- Baseline clause checks and jurisdiction-aware warnings
- UPL-safe output and copy guardrails
- Source provenance matrix with trust and license classification

### Out of scope (future changes)

- Automated legal advice or strategy recommendations
- Full legal research automation across all jurisdictions
- End-to-end e-sign dispatch as part of this change
- Enterprise CLM replacement workflows
- Cooley GO sourcing or integration

## Impact

- Affected specs:
  - `contracts-employment` (new capability)
  - `open-agreements` (template inventory and list/fill UX updates)
- Affected code (planned):
  - new employment template directories under `templates/` and/or `external/`
  - employment review/memo command surfaces in CLI
  - source policy metadata for employment providers
  - optional workspace docs updates for employment topic workflows
  - tests for clause detection, warning rules, and output guardrails
- Compatibility:
  - additive and non-breaking for existing users
  - review outputs are optional and do not alter existing fill behavior
