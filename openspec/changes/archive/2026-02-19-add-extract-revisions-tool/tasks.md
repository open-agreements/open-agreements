# Tasks: add-extract-revisions-tool

## Phase 1: Primitives in docx-primitives-ts

### 1.1 Expose DOM clone accessors on `DocxDocument`
- [x] 1.1.1 Add `getDocumentXmlClone(): Document` to `DocxDocument` — returns a deep clone of the internal `documentXml` DOM
- [x] 1.1.2 Add `getCommentsXmlClone(): Document | null` to `DocxDocument` — returns a deep clone of `word/comments.xml` if present, or `null`
- [x] 1.1.3 Export types if needed from `packages/docx-primitives-ts/src/index.ts`

### 1.2 Add `rejectChanges()` to docx-primitives-ts
- [x] 1.2.1 Implement `rejectChanges(doc: Document): RejectChangesResult` in `packages/docx-primitives-ts/src/reject_changes.ts`
  - Inverse of `acceptChanges()`:
    - **Phase A**: Identify paragraphs to remove — paragraphs where `w:ins` is the only substantive content (paragraph-level insertion markers in `w:pPr/w:rPr/w:ins`)
    - **Phase B**: Preserve cross-paragraph bookmark boundaries before removing inserted paragraphs (relocate orphaned `w:bookmarkStart`/`w:bookmarkEnd` to adjacent kept paragraphs)
    - **Phase C**: Remove insertions — remove `w:ins` wrapper AND its content entirely
    - **Phase D**: Unwrap deletions — unwrap `w:del` wrappers, then rename all `w:delText` elements to `w:t` so text becomes visible to `getParagraphText()`
    - **Phase E**: Revert moves — unwrap `w:moveFrom` (keep content at original position), remove `w:moveTo` AND its content, remove move range markers
    - **Phase F**: Restore original properties — for each `*PrChange` type (`rPrChange`, `pPrChange`, `sectPrChange`, `tblPrChange`, `trPrChange`, `tcPrChange`): replace the parent property element with the child properties stored inside the change element. When original props inside `*PrChange` are empty, remove the parent property element entirely.
    - **Phase G**: Cleanup — strip paragraph-level revision markers and `w:rsidDel` attributes
  - Return stats: `{ insertionsRemoved, deletionsRestored, movesReverted, propertyChangesReverted }`
- [x] 1.2.2 Export from `packages/docx-primitives-ts/src/index.ts`
- [x] 1.2.3 Write tests in `packages/docx-primitives-ts/src/reject_changes.test.ts`
  - Scenario: reject insertion removes inserted content
  - Scenario: reject deletion restores deleted text (w:delText → w:t conversion verified)
  - Scenario: reject move reverts to original position
  - Scenario: reject property change restores original formatting
  - Scenario: reject property change with empty original props
  - Scenario: inserted-paragraph removal
  - Scenario: document with no tracked changes returns zero stats
  - Scenario: empty body and missing body

### 1.3 Add `extractRevisions()` to docx-primitives-ts
- [x] 1.3.1 Implement `extractRevisions()` in `packages/docx-primitives-ts/src/extract_revisions.ts`
  Algorithm:
  1. Clone DOM twice → `acceptChanges()` on accepted clone, `rejectChanges()` on rejected clone
  2. Walk **all** `w:p` elements in the **original tracked DOM** (including inside `w:tc` table cells)
  3. For each paragraph with revision wrappers or property changes, use `jr_para_*` bookmark ID as key
  4. Detect entirely-inserted paragraphs (before_text="") and entirely-deleted paragraphs (after_text="") to avoid stale bookmark lookups from relocated bookmarks
  5. Look up `before_text` in rejected clone by bookmark name; look up `after_text` in accepted clone by bookmark name
  6. Collect individual revision entries with type, text, author
  7. Join comments from `getComments()` output by matching `anchoredParagraphId` to `para_id`
  8. Apply 0-based offset/limit pagination
- [x] 1.3.2 Define types (RevisionType, RevisionEntry, RevisionComment, ParagraphRevision, ExtractRevisionsResult)
- [x] 1.3.3 Export from `packages/docx-primitives-ts/src/index.ts`
- [x] 1.3.4 Write tests in `packages/docx-primitives-ts/src/extract_revisions.test.ts`
  - Scenario: extracts insertions and deletions with before/after text
  - Scenario: inserted-only paragraph has `before_text=""` and non-empty `after_text`
  - Scenario: deleted-only paragraph has non-empty `before_text` and `after_text=""`
  - Scenario: extracts formatting changes (FORMAT_CHANGE)
  - Scenario: changed paragraphs inside table cells are extracted
  - Scenario: associates comments with changed paragraphs via `anchoredParagraphId`
  - Scenario: skips unchanged paragraphs
  - Scenario: empty document returns zero changes
  - Scenario: pagination with offset and limit returns correct window
  - Scenario: pages do not overlap in document order
  - Scenario: offset beyond total returns empty array with `has_more: false`

## Phase 2: MCP Tool in safe-docx-ts

### 2.1 Add extraction cache to SessionManager
- [x] 2.1.1 Add `ExtractionCacheEntry` type and `extractionCache` field to `Session`
- [x] 2.1.2 Add `getExtractionCache(session)` and `setExtractionCache(session, data)` methods
- [x] 2.1.3 Invalidate extraction cache in `markEdited()`

### 2.2 Wire `extract_revisions` tool
- [x] 2.2.1 Create `packages/safe-docx-ts/src/tools/extract_revisions.ts`
  - Resolve session via `resolveSessionForTool()`
  - Check extraction cache by `session.editRevision`; if miss, compute via `extractRevisions()`
  - Validate `limit` (1–500, default 50) and `offset` (>= 0, default 0)
  - Return `INVALID_LIMIT` / `INVALID_OFFSET` errors for out-of-bounds values
  - Paginate from cached array
  - Return `ok({ changes, total_changes, has_more, edit_revision, ... })` merged with session metadata
  - Do NOT call `manager.markEdited()` — read-only tool
- [x] 2.2.2 Add tool definition to `MCP_TOOLS` in `packages/safe-docx-ts/src/server.ts`
- [x] 2.2.3 Add handler branch in `server.ts` CallToolRequestSchema handler
- [x] 2.2.4 Add import for `extract_revisions` tool in server.ts

### 2.3 Write allure tests for MCP tool
- [x] 2.3.1 Create `packages/safe-docx-ts/src/tools/extract_revisions.allure.test.ts`
  - Scenario: extracting revisions from a document with insertions and deletions
  - Scenario: extracting revisions from a document with no tracked changes
  - Scenario: property-only changes are included in extraction
  - Scenario: paginating through revisions with offset and limit
  - Scenario: session document is unchanged after extraction (edit_revision preserved)
  - Scenario: missing session context returns error
  - Scenario: invalid limit returns INVALID_LIMIT error
  - Scenario: invalid offset returns INVALID_OFFSET error
  - Scenario: extract_revisions tool is registered in MCP_TOOLS
  - Scenario: repeated extraction with same edit_revision uses cache

## Phase 3: Verification

### 3.1 Type checks and test pass
- [x] 3.1.1 `npx tsc --noEmit` passes in both `docx-primitives-ts` and `safe-docx-ts`
- [x] 3.1.2 All new tests pass: `npx vitest run src/reject_changes.test.ts src/extract_revisions.test.ts` in docx-primitives-ts (21 tests)
- [x] 3.1.3 All new tests pass: `npx vitest run src/tools/extract_revisions.allure.test.ts` in safe-docx-ts (10 tests)
- [x] 3.1.4 Existing tests still pass — docx-primitives-ts: 204/204, safe-docx-ts: 174/174
