## 1. OpenSpec and design alignment

- [x] 1.1 Add proposal/design/tasks for branded open-source template generation
- [x] 1.2 Add spec delta for branded template layout and OSS generation constraints

## 2. Branded generator implementation

- [x] 2.1 Refactor `scripts/generate_employment_templates.mjs` to emit branded sections (headers, footers, tables, signatures) — uses JSON-driven renderer via `scripts/template_renderer/layouts/cover-standard-signature-v1.mjs`
- [x] 2.2 Add structured signature table components replacing underscore line conventions — `twoPartySignatureTable()` / `onePartySignatureTable()` with border-driven lines
- [x] 2.3 Add footer copy with version/license and page number fields — `sectionFooter()` emits label, version, CC BY 4.0, Page X of Y
- [x] 2.4 Ensure placeholder names remain unchanged for runtime fill compatibility

## 3. Optional LibreOffice one-time flow

- [x] 3.1 Add optional script to normalize/export generated templates through LibreOffice headless — `scripts/generate_employment_templates_libreoffice.mjs` + `scripts/libreoffice_headless.mjs`
- [x] 3.2 Document behavior when LibreOffice is unavailable — covered in `docs/template-branding-pipeline.md` + programmatic error messages

## 4. Tests and docs

- [x] 4.1 Add branded-template regression tests (header/footer/page fields/signature labels) — `integration-tests/employment-template-spacing.test.ts` + `employment-template-style-spacing.test.ts`
- [x] 4.2 Add documentation for the one-time open-source generation workflow — `docs/template-branding-pipeline.md`

## 5. Regenerate and verify

- [x] 5.1 Regenerate employment templates with the new open-source generator
- [x] 5.2 Run targeted tests for template validation and branding checks
- [ ] 5.3 Run `openspec validate add-open-source-template-branding-pipeline --strict`
