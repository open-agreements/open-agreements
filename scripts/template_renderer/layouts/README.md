# Layout modules

Each `*-v1.mjs` here is a layout module: a renderer that takes a validated
contract spec + style profile and emits a `docx.Document`. Templates pick a
layout via `layout_id` in their canonical-source frontmatter.

## Apple Pages compatibility floor (load-bearing)

**Every layout that targets Pages compatibility MUST follow these rules.**
Pages is materially less forgiving than Word and LibreOffice: it drops or
inherits paragraph properties when paragraphs lack an explicit `pStyle`
reference, and it ignores inline `w:jc`/run formatting that isn’t backed by a
named style in `styles.xml`.

The contract is:

1. **Define a real `Normal` paragraph style** in `buildDocumentStyles`. Other
   styles base on `Normal`.
2. **Define a concrete named style** for every visual variant (centered title,
   centered+underlined heading, centered signature-page-follows note, etc.).
   The style itself must carry the variant’s `<w:jc>` / `<w:b>` / `<w:u>` /
   spacing — not an inline override on the paragraph.
3. **Every visible-text paragraph references one of those named styles** via
   `style: 'OAFoo'` or `style: 'Normal'`. Inline alignment without a `pStyle`
   is unreliable in Pages. Body paragraphs explicitly need `style: 'Normal'`
   or Pages will carry forward the previous heading’s formatting.
4. **Footer/header paragraphs also need `style: 'Normal'`** for the same
   inheritance reason.
5. **Empty paragraphs that exist only to carry `<w:sectPr>` are exempt** —
   Pages doesn’t mis-render what isn’t there.

## Incident history

- **First incident (2026-Q1, original Contract IR backport)** —
  centered headings rendered left-aligned in Pages. Resolved by establishing
  the floor above. Was previously documented at
  `docs/contract-ir-safe-board-consent.md` (deleted in #254).
- **Second incident (2026-05-04, PR #257 → fixed in PR #262)** — new
  `traditional-consent-v1.mjs` layout was written from scratch and silently
  regressed the floor. Title and `[Signature Page Follows]` rendered
  left-aligned; an interim fix that registered named styles but missed
  `style: 'Normal'` on body paragraphs caused every body paragraph to inherit
  the previous heading’s centered+underlined formatting. Tracked in #261.

## Regression test

`integration-tests/canonical-{board,stockholder}-consent.test.ts` asserts:

- Required named styles (`Normal`, `OATitle`, `OAClauseHeading`,
  `OABlockSignatureFollow`) exist in `styles.xml` with the expected
  alignment / bold / underline / spacing properties.
- Every visible-text `<w:p>` in `word/document.xml` has a `<w:pStyle>`.
- Specific paragraphs use the expected named styles (title → `OATitle`,
  section headings → `OAClauseHeading`, etc.).

A `pStyle`-presence-only check is **not** sufficient — it would still pass
if someone reintroduced inline-centered headings on `Normal`. Assert the
style properties.

## Out of scope (today)

`cover-standard-signature-v1.mjs` does not currently satisfy this invariant
on every paragraph (the employment offer letter has 75 paragraphs, only 24
with `pStyle`). It renders OK in Pages today because its visual variants
happen to be left-aligned, but this is structurally fragile. A future PR
should retrofit it to the same contract.
