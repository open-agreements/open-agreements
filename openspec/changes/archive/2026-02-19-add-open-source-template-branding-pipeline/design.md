## Context

We need "law-firm-grade" visual output while preserving OpenAgreements'
open-source runtime model and license posture. The current fill runtime is already
open source (`docx-templates`), but base template styling has involved Aspose.
This change shifts branding/layout generation to open-source scripts and keeps
Aspose out of runtime requirements.

## Goals

- Generate branded base templates offline with open-source tooling.
- Improve perceived quality via repeatable structural design primitives:
  headers, footers, tables, spacing, signature components.
- Preserve existing placeholder contract (`{field_name}`) so fill pipeline stays
  unchanged.
- Provide optional LibreOffice-based normalization for teams that want explicit
  LibreOffice provenance.

## Non-Goals

- Full migration of every template family in one change.
- Runtime document transformation through LibreOffice/Aspose.

## Architecture

### 1) Open-source branded generator (primary)

`generate_employment_templates.mjs` becomes the canonical source for branded
employment templates.

It emits DOCX directly with `docx` (open-source) and encodes design primitives:

- section headers (accent bar + all-caps running label)
- footer metadata and page number fields
- fixed-width table grids and horizontal-rule styling
- signature table components with dedicated layout rows
- defined-term run styling in clause text

### 2) Optional LibreOffice normalization/export (secondary)

A separate script runs only in offline generation workflows:

- input: generated DOCX templates
- tool: `soffice --headless --convert-to docx`
- output: normalized DOCX files

This is optional and never required by runtime fill APIs.

### 3) Runtime fill remains unchanged

`fillTemplate` / `fillDocx` continue to operate on `{tag}` placeholders using
existing open-source engine(s). No Aspose or LibreOffice runtime dependency is
introduced.

## Key Decisions

1. Keep one-time generation and runtime filling decoupled.
2. Encode signature layout as table structures, not text underscores.
3. Use form-level footer copy including version and CC BY 4.0 notice.
4. Keep section-specific headers to match premium form conventions.

## Risks and Mitigations

- Risk: Styling drift over time.
  - Mitigation: Add structural regression tests on generated DOCX XML parts.
- Risk: LibreOffice availability differences across environments.
  - Mitigation: Keep LibreOffice path optional and explicit; primary generator is
    pure Node.js.
- Risk: Placeholder breakage during redesign.
  - Mitigation: run existing template validation and fill tests; preserve exact
    field names.

## Rollout

1. Generate updated employment templates via open-source generator.
2. Run validation/tests.
3. Optionally run LibreOffice normalization script in release workflow.
