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
  `content/templates/openagreements-board-consent-safe/`
- A template-local `clean.json` so the introductory note is removed from filled
  output using the repo’s existing clean-before-fill pipeline

## Renderer compatibility notes

The canonical renderer shape should remain the style-based version from the
backport, not the more direct-format-heavy experiment variants.

What the incremental Pages tests showed:

- Letter vs A4 was not the deciding factor. `page_size` does wire through from
  `styles.yaml`, but changing it alone did not fix the Pages mismatch.
- `pStyle` references alone were not enough. Pages still mis-rendered centered
  headings when the referenced paragraph styles were missing from `styles.xml`.
- Custom paragraph styles without a concrete `Normal` base produced worse
  inheritance behavior in Pages.
- The compatibility floor was an explicit paragraph style tree:
  - a real `Normal` style in `styles.xml`
  - concrete custom paragraph styles for referenced IDs like `OAHeading2` and
    `OABlockNote`
  - paragraphs in `document.xml` pointing at those styles

That means the renderer should favor explicit paragraph styles plus minimal
inline overrides over “cleaner” direct formatting. The extra XML is acceptable
because OpenAgreements already consumes DOCX through token-efficient tooling,
and the style tree is the more robust cross-editor contract.

## OOXML package notes

The generated SAFE board consent is not unusually minimal relative to the
`docx` library baseline. A fresh `docx`-generated file includes the same core
package skeleton:

- `_rels/.rels`
- `word/_rels/document.xml.rels`
- `[Content_Types].xml`
- `word/styles.xml`
- `word/settings.xml`
- `word/fontTable.xml`
- `word/comments.xml`
- `word/footnotes.xml`
- `word/endnotes.xml`

Important nuance:

- `rels` files and `[Content_Types].xml` are structural and required.
- `comments.xml` is emitted as an empty container by `docx`; it does not mean
  the document actually contains user-visible comments.
- `footnotes.xml` and `endnotes.xml` are emitted with separator defaults even
  when no user-authored notes exist.
- Headers, footers, theme parts, and media parts are conditional. Templates
  like the offer letter include header/footer rels because they use them; the
  SAFE board consent does not.

## What remains unsupported

- Lists, tables, and arbitrary nested Markdown structures
- Rich inline style combinations beyond the small emphasis and custom inline
  style subset needed here
- Multi-template registry resolution by global ID instead of local relative
  file pointers
- Automatic metadata generation from `schema.yaml`

## Stockholder consent follow-on

The SAFE stockholder consent has now been migrated as the second Contract IR
template under `content/templates/openagreements-stockholder-consent-safe/`.

That follow-on reuse is the main signal that the board-consent backport was not
a one-off. The same parser, registry pointers, renderer, clean-before-fill
pipeline, and fidelity-test pattern carried over with only template-local
content changes.
