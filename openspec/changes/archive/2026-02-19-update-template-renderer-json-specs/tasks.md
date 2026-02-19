## 1. OpenSpec alignment

- [x] 1.1 Add proposal/design/tasks for JSON spec + shared renderer approach
- [x] 1.2 Add spec delta for data-model separation and renderer reuse requirements

## 2. Schema and validation foundation

- [x] 2.1 Define contract spec JSON schema (layout/style/content sections)
- [x] 2.2 Define style profile JSON schema for typography and spacing tokens
- [x] 2.3 Add validation utilities with file/path-specific error reporting

## 3. Shared renderer architecture

- [x] 3.1 Introduce `template-renderer` entrypoint that resolves layout + style + spec
- [x] 3.2 Implement a reusable layout module for cover/standard/signature structure
- [x] 3.3 Replace hardcoded spacing literals with style-token lookups

## 4. Employment migration

- [x] 4.1 Move employment template content from JS arrays into JSON specs
- [x] 4.2 Wire employment generation flow to the shared renderer
- [x] 4.3 Preserve existing placeholder names and metadata compatibility

## 5. Regression safety

- [x] 5.1 Add tests that validate JSON specs and style profiles
- [x] 5.2 Add render regression tests for spacing/layout invariants (including 6pt Standard Terms spacing)
- [x] 5.3 Add parity checks that multiple templates can share one layout renderer

## 6. Docs and validation

- [x] 6.1 Document authoring workflow for adding new templates with JSON specs
- [x] 6.2 Document how to create or extend reusable layout/style profiles
- [x] 6.3 Run `openspec validate update-template-renderer-json-specs --strict`
