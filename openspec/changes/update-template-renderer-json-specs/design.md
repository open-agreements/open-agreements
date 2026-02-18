## Context

OpenAgreements is now a forms library with many templates and evolving
presentation requirements. The current employment generator demonstrates that
layout code can be shared, but content is still embedded in JavaScript.
That causes high coupling and expensive changes when legal text is updated.

## Goals

- Separate template content from rendering code.
- Reuse one renderer across many contracts that share layout structure.
- Keep style decisions explicit and testable (for example 6pt Standard Terms
  spacing) without manually editing DOCX artifacts.
- Preserve runtime fill compatibility and existing `{field_name}` placeholders.

## Non-Goals

- Full replacement of all existing template families in one iteration.
- Runtime replacement of `docx-templates` fill pipeline.
- Introducing template authoring via AI-generated free-form structures.

## Decisions

### 1) Introduce a JSON contract spec model

Each generated template uses a JSON spec containing:

- `layout_id`: selects a renderer layout module
- `style_id`: selects a style token profile
- content blocks:
  - title and footer identity
  - cover rows
  - standard-term clauses
  - signature sections

This keeps legal/content edits in JSON while rendering remains in code.

### 2) Use a shared layout renderer registry

A single renderer entrypoint resolves `layout_id` to a layout module.
Multiple contracts can reference the same layout. Layout modules are responsible
for DOCX structural assembly only (sections, headers/footers, tables, rows).

### 3) Use style token profiles

Style tokens define spacing and visual constants (for example paragraph spacing,
font sizes, colors, table rhythm). Layout modules consume these tokens instead of
hardcoded values.

This allows consistent cross-template updates and makes spacing rules explicit.

### 4) Validate specs before render

JSON specs and style profiles are schema-validated before generation. Validation
errors must identify file, path, and violated constraint.

### 5) Migrate employment templates first

Employment templates become first adopters. This proves the architecture in a
controlled family before broader migration.

## Architecture

### Data flow

1. Load contract spec JSON.
2. Validate contract spec against schema.
3. Load style profile by `style_id`; validate schema.
4. Resolve layout module by `layout_id`.
5. Render DOCX via shared renderer APIs.
6. Run formatting/content regression tests.

### Suggested module boundaries

- `src/template-renderer/index.ts` (entrypoint)
- `src/template-renderer/layouts/*.ts` (layout modules)
- `src/template-renderer/styles/*.json` (style profiles)
- `src/template-renderer/schema/*.ts` (Zod schemas)
- `templates-specs/*.json` (content specs)

Exact paths can be adjusted during implementation, but ownership boundaries
should remain.

## Risks and Trade-offs

- Risk: Over-generalizing layout API too early.
  - Mitigation: start with one shared layout family and expand incrementally.
- Risk: Migration churn while old and new paths coexist.
  - Mitigation: keep old generator behavior covered by parity tests until
    migration completes.
- Risk: JSON spec flexibility creating invalid or inconsistent docs.
  - Mitigation: strict schemas + required invariants tests.

## Migration Plan

1. Define schemas and renderer/layout contracts.
2. Build shared renderer for employment layout family.
3. Move employment content into JSON specs.
4. Keep generated output validated with existing and new tests.
5. Deprecate direct content-in-JS approach once parity is stable.

## Open Questions

- Should style profiles be versioned with semantic ids (for example
  `openagreements-default-v1`)?
- Should JSON specs live near templates (`templates/<id>/spec.json`) or in a
  centralized registry directory?
