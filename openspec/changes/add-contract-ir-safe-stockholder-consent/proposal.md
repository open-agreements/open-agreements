# Change: Add Contract IR backport path for SAFE stockholder consent

## Why

The SAFE board consent proved that OpenAgreements can author a real corporate
consent canonically in Contract IR and render it back to professional DOCX and
readable Markdown. The next question is whether that path generalizes cleanly
to the matching stockholder consent without introducing a parallel renderer or
template-specific architecture.

## What Changes

- Add a canonical Contract IR version of the SAFE stockholder consent.
- Reuse the existing Contract IR parser, schema/style registry pointers, and
  renderer with only template-local additions.
- Generate `template.docx` and `template.md` for the stockholder consent from
  the same canonical `content.md`.
- Add focused tests for loading, validation, rendering, fidelity against the
  current Joey Tsang source, and filled-output cleanup behavior.

## Impact

- Affected specs: `open-agreements`
- Affected code:
  - `content/templates/openagreements-stockholder-consent-safe/*`
  - `scripts/generate_contract_ir_templates.mjs`
  - `integration-tests/contract-ir-stockholder-consent.test.ts`
  - `openspec/changes/add-contract-ir-safe-stockholder-consent/*`
