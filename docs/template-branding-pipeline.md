# Employment Template Branding Pipeline

This repository uses an open-source-only pipeline to generate branded
OpenAgreements employment templates.

## Goals

- produce professional, consistent DOCX layout (headers, footers, tables, signatures)
- avoid Aspose in runtime fill paths
- keep placeholders compatible with `open-agreements fill`

## Primary generator (open source)

Run:

```bash
npm run generate:employment-templates
```

This regenerates:

- `content/templates/openagreements-employment-offer-letter/template.docx`
- `content/templates/openagreements-employee-ip-inventions-assignment/template.docx`
- `content/templates/openagreements-employment-confidentiality-acknowledgement/template.docx`

The generator is implemented in `scripts/generate_employment_templates.mjs` and
uses the `docx` npm package.

### JSON-driven architecture

Employment generation now separates concerns:

- content specs: `scripts/template-specs/*.json`
- style profile: `scripts/template-specs/styles/openagreements-default-v1.json`
- shared renderer: `scripts/template_renderer/`
- layout module: `scripts/template_renderer/layouts/cover-standard-signature-v1.mjs`

This allows multiple contracts to share one renderer layout while keeping legal
content in JSON.

### Add a new template using existing layout

1. Copy an existing spec in `scripts/template-specs/` and update:
   - `template_id`
   - `output_docx_path`
   - `output_markdown_path`
   - `document` metadata and section content
2. Keep `layout_id` set to a registered layout (`cover-standard-signature-v1`)
   when the structure is the same.
3. Keep `style_id` set to `openagreements-default-v1` unless you intentionally
   introduce a new style profile.
4. Add the new spec path to `SPEC_PATHS` in
   `scripts/generate_employment_templates.mjs`.
5. Run `npm run generate:employment-templates`.
6. Run targeted checks:
   - `npm run test:run -- integration-tests/template-renderer-json-spec.test.ts`
   - `npm run test:run -- integration-tests/employment-template-spacing.test.ts`

### Add or extend styles and layouts

- Update spacing/colors/fonts in
  `scripts/template-specs/styles/openagreements-default-v1.json` for shared visual
  changes.
- Add a new style profile file when you need a separate visual system and set
  matching `style_id` in specs.
- Add a new layout module under `scripts/template_renderer/layouts/` when the
  document structure differs. Register it in
  `scripts/template_renderer/index.mjs`.

## Optional LibreOffice normalization (offline, one-time)

If you want the final base templates to be normalized through LibreOffice,
run:

```bash
npm run generate:employment-templates:libreoffice
```

Requirements:

- Repo pin config (`config/libreoffice-headless.json`) or env vars
- Successful smoke check (`npm run check:libreoffice`)

Example (macOS):

```bash
brew install --cask libreoffice
# Keep this file pinned in repo:
# config/libreoffice-headless.json
npm run check:libreoffice
```

Temporary local opt-out (not recommended for CI): `OA_ALLOW_UNPINNED_SOFFICE=1`

## Runtime fill remains open source

Runtime filling (`open-agreements fill`) continues to use open-source rendering
(`docx-templates`) and does not require Aspose licensing.
