# Change: Add JSON contract specifications with a shared template renderer

## Why

The current template generation path mixes rendering logic and contract content
inside `scripts/generate_employment_templates.mjs`. That coupling slows review,
makes content diffs harder for legal reviewers, and does not scale well for a
forms library where many contracts share the same visual layout.

If five contracts use the same structure (cover terms, standard terms, signature
section), we should not need five renderers. We need one reusable renderer with
data-driven content.

## What Changes

- Introduce a JSON-based contract specification model that separates:
  - content (titles, clause text, labels, signatures)
  - layout selection (shared renderer layout id)
  - style tokens (spacing, typography, color primitives)
- Add a shared `template-renderer` architecture that renders DOCX from:
  - a contract JSON spec
  - a layout module
  - a style profile
- Define schema validation for JSON specs and style profiles with actionable
  errors before DOCX generation.
- Migrate the employment template generator to the JSON spec flow using a shared
  layout, preserving existing placeholder names and fill compatibility.
- Add regression tests to enforce formatting invariants (including Standard Terms
  6pt paragraph spacing) and prevent drift during future migrations.

## Scope Boundaries

### In scope

- Shared renderer contract for reusable layouts
- JSON content/spec format for generated templates
- Style token model for spacing and visual primitives
- Employment templates as first migration set

### Out of scope

- Converting every template family in a single change
- Replacing runtime fill (`open-agreements fill`) with a new engine
- Editing third-party licensed template source models

## Impact

- Affected specs:
  - `open-agreements`
- Affected code (planned):
  - `scripts/generate_employment_templates.mjs` (refactor to consume JSON specs)
  - new renderer/layout/style modules
  - JSON schema + validation utilities
  - test suite for spacing/layout invariants and schema validation
- Compatibility:
  - additive/non-breaking for CLI fill behavior
  - existing placeholder/tag semantics remain unchanged
