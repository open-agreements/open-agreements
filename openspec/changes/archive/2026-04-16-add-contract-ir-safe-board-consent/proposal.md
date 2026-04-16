# Change: Add Contract IR backport path for SAFE board consent

## Why

OpenAgreements currently supports two canonical authoring patterns for contract
content: vendored DOCX templates and JSON-driven DOCX generation for a narrow
set of branded templates. That leaves no human-readable canonical source for
legal content that still needs professional DOCX fidelity.

The SAFE board consent is a good proof-of-concept for a third path: a canonical
Markdown content document that points to shared schema and style registries,
then renders deterministically to DOCX and a readable preview. This keeps the
scope narrow while proving the Contract IR architecture on one real form.

## What Changes

- Add a minimal Contract IR ingestion path for one template family.
- Support frontmatter pointers from `content.md` to external schema and style
  YAML files.
- Validate referenced variables and style slugs before rendering.
- Render the SAFE board consent from Contract IR into both `template.docx` and
  `template.md`.
- Add focused tests for parser validation, rendering, and fidelity smoke checks
  against the current Joey Tsang SAFE board consent source.

## Impact

- Affected specs: `open-agreements`
- Affected code:
  - `content/templates/openagreements-board-consent-safe/*`
  - `scripts/contract_ir/*`
  - `scripts/generate_contract_ir_templates.mjs`
  - `package.json`
  - `integration-tests/*`
