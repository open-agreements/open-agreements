# Contract IR SAFE Board Consent Backport

## What was implemented

- A narrow Contract IR loader under `scripts/contract_ir/` that:
  - parses `content.md` frontmatter
  - resolves external schema and style YAML registries
  - validates variables and style slugs
  - builds a normalized paragraph-oriented model
- A renderer that emits both `template.docx` and `template.md` from that same
  normalized model
- A new canonical Contract IR template at
  `content/templates/cooley-board-consent-safe/`
- A template-local `clean.json` so the introductory note is removed from filled
  output using the repo’s existing clean-before-fill pipeline

## What remains unsupported

- Lists, tables, and arbitrary nested Markdown structures
- Rich inline style combinations beyond the small emphasis and custom inline
  style subset needed here
- Multi-template registry resolution by global ID instead of local relative
  file pointers
- Automatic metadata generation from `schema.yaml`

## Should the stockholder consent migrate next?

Yes, but only after this board-consent path is stable in normal regeneration and
validation workflows.

The stockholder consent is a reasonable next candidate because it shares the
same broad structure:

- title plus Delaware consent framing
- centered section headings
- resolution paragraphs with bold lead-ins
- signature blocks

That said, it should remain a separate follow-on change so the current proof of
concept stays narrow and the parser is extended only when its real needs are
clear.
