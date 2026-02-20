# Tasks

## Phase 1: Run-Level Formatting Extraction

- [x] 1.1 Wire existing `extractEffectiveRunFormatting` (`styles.ts:202`) into document view rendering
  - The function already resolves the full style chain and returns `{ bold, italic, underline, highlightVal, fontName, fontSizePt, colorHex }`
  - Extend if needed for hyperlink detection (hyperlink runs need `href` from relationship part)
  - File: `packages/docx-primitives-ts/src/styles.ts` (existing), `packages/docx-primitives-ts/src/document_view.ts` (integration)

- [x] 1.2 Add unit tests for formatting extraction
  - Test direct formatting, inherited formatting, mixed runs
  - Test hyperlink detection

## Phase 2: Base-Style Suppression

- [x] 2.1 Implement char-weighted modal baseline computation in `packages/docx-primitives-ts/src/document_view.ts`
  - Compute `(bold, italic, underline)` tuple per visible non-header run
  - Weight by character count, select modal tuple
  - Tie-break by earliest run when weights equal
  - Disable suppression when baseline covers < 60% of visible characters

- [x] 2.2 Add unit tests for baseline computation
  - Test uniform formatting (all body text) → suppression active
  - Test mixed formatting above 60% threshold
  - Test highly varied formatting below 60% threshold → suppression disabled
  - Test tie-breaking behavior

## Phase 3: Tag Rendering in TOON Output

- [x] 3.1 Implement tag rendering in DocumentView/TOON builder (`packages/docx-primitives-ts/src/document_view.ts`)
  - Emit `<b>`, `<i>`, `<u>`, `<highlighting>` tags at run boundaries where formatting deviates from baseline
  - Emit absolute tags for all runs when suppression is disabled
  - Render hyperlinks as `<a href="...">text</a>`
  - Nest tags in consistent order: `<b>` > `<i>` > `<u>` > `<highlighting>`

- [x] 3.2 Add `show_formatting` boolean option to `read_file` schema (default: `true`)
  - File: `packages/safe-docx-ts/src/tools/read_file.ts`
  - Update server schema: `packages/safe-docx-ts/src/server.ts`

- [x] 3.3 Wire `show_formatting` flag through to DocumentView rendering
  - When `false`, emit plain text as today (no tags)
  - When `true`, emit tagged text with base-style suppression

## Phase 4: Test Fixtures and Integration

- [x] 4.1 Add test fixtures with mixed-format paragraphs
  - Document with bold mid-sentence, italic terms, underlined headings
  - Document with hyperlinks
  - Document with uniform formatting (verify suppression)

- [x] 4.2 Add integration tests for TOON output with formatting tags
  - Verify tags appear at correct run boundaries
  - Verify `show_formatting=false` produces plain text
  - Verify tag vocabulary matches `smart_edit` `new_string` vocabulary

- [x] 4.3 Add test for suppression threshold behavior
  - Verify 60% threshold triggers absolute tag mode

## Phase 5: Follow-On (Separate PR)

- [x] 5.1 Extend `old_string` tag stripping in `smart_edit` (`packages/safe-docx-ts/src/tools/smart_edit.ts`)
  - `smart_edit` already strips `<definition>` and `<highlighting>` from `old_string` (smart_edit.ts:532-533)
  - Extend stripping to `<b>`, `<i>`, `<u>` tags
  - Preserve existing plain-text matching as primary path

## Dependencies

- Independent — no dependencies on other proposals
- Phase 5 is a follow-on and does not block Phases 1–4
