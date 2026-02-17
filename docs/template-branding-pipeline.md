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

- `templates/openagreements-employment-offer-letter/template.docx`
- `templates/openagreements-employee-ip-inventions-assignment/template.docx`
- `templates/openagreements-employment-confidentiality-acknowledgement/template.docx`

The generator is implemented in `scripts/generate_employment_templates.mjs` and
uses the `docx` npm package.

## Optional LibreOffice normalization (offline, one-time)

If you want the final base templates to be normalized through LibreOffice,
run:

```bash
npm run generate:employment-templates:libreoffice
```

Requirements:

- `soffice` or `libreoffice` on PATH
- headless conversion support (`--headless --convert-to docx`)

On macOS:

```bash
brew install --cask libreoffice
```

## Runtime fill remains open source

Runtime filling (`open-agreements fill`) continues to use open-source rendering
(`docx-templates`) and does not require Aspose licensing.
