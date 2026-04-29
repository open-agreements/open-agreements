# Change: Add canonical Markdown authoring for employment templates

## Why
The Wyoming restrictive covenant template now has two competing authoring
shapes: a cleaner lawyer-facing draft and a more machine-readable draft. We
need one canonical Markdown format that stays simple enough for lawyers to edit
while preserving the structure needed to compile back into validated template
specs and rendered artifacts.

## What Changes
- Add a canonical Markdown compiler for employment templates.
- Support label-keyed cover-term tables with `Kind | Label | Value | Show When`.
- Support definitions authored as ordinary paragraphs where the first `[[...]]`
  span in each paragraph is the canonical defined term.
- Support optional alias metadata at the definition site using
  `(Aliases: [[Alias 1]], [[Alias 2]])`.
- Support optional explicit `[[...]]` references in body text that resolve
  against canonical defined terms or aliases.
- Support inline signature metadata using `oa:signature-mode` and `oa:signer`
  directives.
- Use `template.md` itself as the Wyoming template's canonical Markdown source.
- Generate the Wyoming template's JSON spec and checked-in DOCX artifact from
  that canonical Markdown source.

## Impact
- Affected specs: `open-agreements`
- Affected code: `scripts/template_renderer/`, `scripts/generate_employment_templates.mjs`,
  `content/templates/openagreements-restrictive-covenant-wyoming/`,
  integration tests for template rendering and canonical authoring
