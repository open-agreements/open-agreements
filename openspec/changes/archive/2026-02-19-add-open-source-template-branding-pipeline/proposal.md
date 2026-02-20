# Change: Add branded open-source template generation pipeline

## Why

OpenAgreements templates currently fill correctly but do not consistently match the
visual quality of professionally published agreement forms. The recent bake-off
showed recurring issues in generated outputs:

- narrow/non-professional table geometry
- weak or missing header/footer identity
- plain signature layouts that rely on underscore text
- inconsistent paragraph rhythm and section framing

In parallel, we need to remove dependency risk from proprietary offline tooling.
Branding and base template generation should be reproducible with open-source
tooling, and runtime fill in cloud environments must not require Aspose.

## What Changes

- Add a branded base-template generation pipeline for OpenAgreements employment
  templates using open-source tooling only.
- Rework the employment template generator to produce:
  - section-specific running headers with an accent top bar and all-caps label
  - footer with form/version/license text and `Page X of Y`
  - full-width fixed-layout key-terms tables using horizontal rules only
  - dedicated signature-page table components (no underscore-based line hacks)
  - defined-term accent styling in body text
- Keep runtime filling on the existing open-source renderer path
  (`docx-templates`), with no Aspose runtime requirement.
- Add an optional one-time LibreOffice normalization/export script for teams that
  want a LibreOffice-produced artifact in the provenance chain.
- Add regression tests to verify branded DOCX structure (headers/footers,
  page-number fields, license footer copy, signature table labels).

## Scope Boundaries

### In scope

- Open-source generation of branded base DOCX templates
- Employment template family (`openagreements-employment-*`)
- One-time offline generation workflow
- OSS runtime fill compatibility

### Out of scope

- Rebranding every Common Paper/Bonterms/NVCA template in this change
- Runtime cloud use of LibreOffice for every fill operation
- Introducing proprietary SDKs in runtime path

## Impact

- Affected specs:
  - `open-agreements`
- Affected code (planned):
  - `scripts/generate_employment_templates.mjs`
  - new optional LibreOffice helper script
  - tests for branded structure validation
  - docs for template generation workflow
- Compatibility:
  - additive/non-breaking for `fill` command behavior
  - existing field names and placeholder semantics are preserved
