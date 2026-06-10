# Design — Cover-notice cross-reference + hyperlinks

## Decision: static linked "Section N", not Word REF fields

A spike rendered a REF-field + bookmark + hyperlink fixture through the repo's **pinned**
LibreOffice (25.8.7.3, via `scripts/render_docx_pages.mjs`):

- Word `REF` fields with the number switches (`\r`, `\w`) render **blank** in the LibreOffice
  preview; a baked cached value is dropped, not shown. A plain `REF \h` renders the **whole heading
  text**, not just the number. Root cause: REF number switches need native Word list numbering
  (`w:numPr`), but this project numbers clauses with **literal text** ("1. Heading") re-sequenced by
  `renumberClauseHeadings`. So no REF form yields just "Section 12" here.
- Internal `w:anchor` hyperlinks and external hyperlinks both render their visible text in the
  LibreOffice preview and are clickable in Word.

So a live, auto-updating REF cross-reference is **not achievable without first migrating clause
numbering to native Word numbering** — a large, cross-cutting change tracked on #420. For this
change we use a **static linked literal number**: resolve a sentinel to "Section N" (correct at
delivery) wrapped in an internal hyperlink that jumps to the clause. It renders correctly in both
Word and the LibreOffice catalog preview today.

Earlier dynamic peer-review verification (Codex) confirmed that `docx` `Bookmark`,
`InternalHyperlink`, `ExternalHyperlink`, and `fldSimple` all survive the docx-templates
`createReport` fill unmangled, and that the external hyperlink relationship is preserved in
`word/_rels/document.xml.rels`.

## Bookmark naming
`oa_xref_<sha1(id)[:16]>` (e.g. `oa_xref_6eb93a20e7f56b6c`). Hashed — not the raw clause id —
because Word bookmark names must be ≤40 chars, start with a letter, and contain only letters/digits/
underscore, while clause ids are long and hyphenated. The same name is embedded in the bullet's
`<<xref:…>>` sentinel, so the post-fill resolver never needs to know the hashing scheme: it reads
bookmark names off headings and matches the captured token.

## Sentinel shape
`<<xref:<bookmark>>>` (angle-bracket delimiters), NOT `{{…}}`: docx-templates strips `{`/`}` as its
command delimiters during fill, so a brace sentinel would not survive. `<<…>>` passes through fill
intact. In `word/document.xml` it is XML-escaped to `&lt;&lt;…&gt;&gt;`; the post-fill DOM pass reads
unescaped `textContent`, the string-based `humanizeDocx` matches the escaped form.

## Resolution location
Folded into `renumberClauseHeadings` (one parse/serialize). First loop assigns sequential numbers
and records `bookmark → number` for any `oa_xref_*` bookmark on a heading. Second loop rewrites
`<<xref:<bookmark>>>` sentinels to `Section <number>` via the existing `rewriteTextRange` helper. The
early-return is taken only when neither renumbering nor sentinel resolution changed anything.

## Verification evidence
- Filled Florida (covered, unconfirmed): bullet reads "• Section 11 — CHOICE Act Counsel Advisal and
  Notice (Covered Employee) — for more details see https://openagreements.org/legal/non-compete/
  florida"; "Section 11" is an internal hyperlink to the heading bookmark; the heading is "11."; the
  URL is an external hyperlink relationship. Rendered page-one PNG via pinned LibreOffice confirms
  both links render on the yellow banner.
- Omission: when an earlier clause drops, the bookmarked heading and the bullet's "Section N" shift
  together (OA-TMP-074).
