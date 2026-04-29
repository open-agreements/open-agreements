---
title: Template Branding Pipeline
description: How OpenAgreements branded templates are generated, styled, and extended.
order: 9
section: Guides
---

# Template Branding Pipeline

This repository uses an open-source-only pipeline to generate branded
OpenAgreements templates that share the cover-standard-signature-v1 layout.

## Goals

- produce professional, consistent DOCX layout (headers, footers, tables, signatures)
- avoid Aspose in runtime fill paths
- keep placeholders compatible with `open-agreements fill`

## Primary generator (open source)

Run:

```bash
npm run generate:templates
```

This walks `content/templates/` and regenerates each template's `template.docx`
artifact from its source. Sources are auto-discovered:

- A `template.md` with canonical YAML frontmatter (containing `template_id`,
  `layout_id`, `style_id`, etc.) is treated as a **canonical source**. Its
  generated JSON spec is written to `content/templates/<slug>/.template.generated.json`
  (a hidden, generated artifact — do not edit by hand).
- A directory with `template.json` (and no canonical `template.md`) is treated
  as a **JSON source**. The JSON is hand-authored.

The generator is implemented in `scripts/generate_templates.mjs` and uses the
`docx` npm package.

### Architecture

Generation separates concerns:

- canonical sources: `content/templates/<slug>/template.md` (YAML frontmatter + Markdown body)
- generated specs: `content/templates/<slug>/.template.generated.json` (auto-written)
- hand-authored specs: `content/templates/<slug>/template.json` (legacy; new templates should be canonical)
- style profile: `scripts/template-specs/styles/openagreements-default-v1.json`
- shared renderer: `scripts/template_renderer/`
- layout module: `scripts/template_renderer/layouts/cover-standard-signature-v1.mjs`
- discovery: `scripts/template_renderer/canonical-sources.mjs`

This allows multiple contracts to share one renderer layout while keeping legal
content close to the rendered DOCX it produces.

### Add a new canonical template

1. Create `content/templates/<your-slug>/template.md` with YAML frontmatter:
   - `template_id`: must equal `<your-slug>`
   - `layout_id`: a registered layout (e.g. `cover-standard-signature-v1`)
   - `style_id`: `openagreements-default-v1` unless you intentionally introduce a new style
   - `document`: title/label/version/license metadata
   - `outputs.docx`: path to the rendered DOCX (typically `content/templates/<slug>/template.docx`)
   - `sections`: cover_terms, standard_terms, signature definitions
2. Author cover terms, standard terms, and signature blocks as Markdown in the body.
3. Run `npm run generate:templates`. The generator discovers the new canonical
   source automatically and writes `content/templates/<your-slug>/.template.generated.json`
   alongside the rendered `template.docx`.
4. Run targeted checks:
   - `npm run test:run -- integration-tests/template-renderer-json-spec.test.ts`
   - `npm run test:run -- integration-tests/canonical-source-sync.test.ts`
   - `npm run test:run -- integration-tests/canonical-source-authoring.test.ts`

### Add or extend styles and layouts

- Update spacing/colors/fonts in
  `scripts/template-specs/styles/openagreements-default-v1.json` for shared visual
  changes.
- Add a new style profile file when you need a separate visual system and set
  matching `style_id` in template frontmatter.
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
