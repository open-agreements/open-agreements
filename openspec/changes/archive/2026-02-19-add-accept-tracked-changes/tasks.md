# Tasks

## Phase 1: Core Revision Acceptance Logic

- [x] 1.1 Extract `acceptAllChanges` from `docx-comparison/trackChangesAcceptorAst.ts` into `docx-primitives-ts/src/accept_changes.ts`
  - Refactor to add stats reporting (insertions, deletions, moves, property changes resolved)
  - Add `w:rsid*` attribute cleanup on affected elements
  - Update `docx-comparison` to import from `@usejunior/docx-primitives` instead of internal module
  - Ensure `docx-comparison` existing test suite passes after extraction

- [x] 1.2 Implement `w:ins` acceptance (unwrap: promote children, remove wrapper)
  - Handle nested content (runs, paragraphs, tables)
  - Preserve all child formatting

- [x] 1.3 Implement `w:del` acceptance (remove element and all children)
  - Handle `w:del` containing runs, paragraph marks, table content

- [x] 1.4 Implement property change acceptance
  - `w:rPrChange` — remove change record from `w:rPr`, keep current formatting
  - `w:pPrChange` — remove change record from `w:pPr`, keep current formatting
  - `w:sectPrChange`, `w:tblPrChange`, `w:trPrChange`, `w:tcPrChange` — same pattern

- [x] 1.5 Implement move acceptance (`w:moveFrom` / `w:moveTo`)
  - Remove `w:moveFrom` and all children (source)
  - Unwrap `w:moveTo` children to parent (destination)
  - Handle orphaned moves (missing pair) with safe fallback

- [x] 1.6 Clean up revision metadata attributes after acceptance
  - Strip `w:rsidR`, `w:rsidRPr`, `w:rsidDel` from affected elements only

## Phase 2: MCP Tool Integration

- [x] 2.1 Create `accept_changes` MCP tool with input/output schema
  - Input: `session_id` or `file_path` (file-first entry)
  - Output: acceptance stats (insertions accepted, deletions accepted, moves resolved, property changes resolved)
  - File: `packages/safe-docx-ts/src/tools/accept_changes.ts`

- [x] 2.2 Register tool in server
  - File: `packages/safe-docx-ts/src/server.ts`

- [x] 2.3 Wire session integration
  - After acceptance, replace working copy with accepted document
  - Invalidate cached DocumentView for refresh on next `read_file`

## Phase 3: Testing

- [x] 3.1 Add unit tests for each revision type acceptance
  - `w:ins` unwrapping, `w:del` removal, property changes, moves
  - Nested revisions (revision inside revision)
  - Orphaned move handling

- [x] 3.2 Add integration tests with sample redlined documents
  - Document with insertions and deletions
  - Document with formatting changes
  - Document with moved paragraphs
  - Verify accepted document opens cleanly in Microsoft Word

- [x] 3.3 Add test for original document immutability
  - Verify source document is not modified after acceptance

## Dependencies

- Independent — pure TypeScript, no external dependencies
- No dependencies on other proposals
