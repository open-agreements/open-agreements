# Tasks

## Phase 1: Normalization Primitives

- [x] 1.1 Implement `merge_runs` primitive with safety barriers
  - Merge adjacent runs with equivalent effective run properties
  - Safety barriers: never merge across `fldChar`/`instrText`, comment range, bookmark, or tracked-change boundaries
  - Strip `proofErr` elements and `rsid` attributes on merged runs
  - Return count of runs merged
  - File: `packages/docx-primitives-ts/src/merge_runs.ts`

- [x] 1.2 Implement `simplify_redlines` primitive with same-author constraint
  - Merge adjacent tracked-change wrappers (`w:ins` or `w:del`) from the same author
  - Do not merge across different change types or non-whitespace separators
  - Return count of wrappers consolidated
  - File: `packages/docx-primitives-ts/src/simplify_redlines.ts`

- [x] 1.3 Add unit tests for merge_runs safety barriers
  - Test merge of format-identical adjacent runs
  - Test barrier: runs separated by `fldChar` are NOT merged
  - Test barrier: runs separated by comment range markers are NOT merged
  - Test barrier: runs separated by bookmark markers are NOT merged
  - Test barrier: runs inside different tracked-change wrappers are NOT merged

- [x] 1.4 Add unit tests for simplify_redlines
  - Test merge of adjacent same-author `w:ins` wrappers
  - Test merge of adjacent same-author `w:del` wrappers
  - Test no merge across different authors
  - Test no merge across different change types (`w:ins` + `w:del`)

## Phase 2: Pipeline Integration

- [x] 2.1 Add normalization step to session creation pipeline
  - Pipeline order: `load → normalize → bookmark allocation → cache view`
  - File: `packages/safe-docx-ts/src/tools/open_document.ts`

- [x] 2.2 Add `skip_normalization` boolean parameter to `open_document` and file-first entry
  - Default: `false` (normalization runs)
  - When `true`: skip normalization step entirely
  - File: `packages/safe-docx-ts/src/server.ts` (schema update)
  - File: `packages/safe-docx-ts/src/tools/session_resolution.ts`

- [x] 2.3 Add normalization stats to session metadata response
  - Fields: `runs_merged`, `redlines_simplified`, `normalization_skipped`
  - Available via `get_session_status`

## Phase 3: Regression and Benchmark Testing

- [x] 3.1 Add regression test: jr_para_* IDs stable after normalization
  - Open same document with and without normalization
  - Verify unchanged paragraphs receive the same jr_para_* identifiers

- [x] 3.2 Add regression test: merge barriers prevent unsafe run consolidation
  - Document with fields, comments, bookmarks, and tracked changes
  - Verify no merge occurs across any barrier type

- [x] 3.3 Benchmark on existing .docx fixtures in repo
  - Measure normalization time and impact (runs merged, redlines simplified)
  - Document results in test output

## Phase 4: Implicit Validation on Download

- [x] 4.1 Add implicit `validate_document` step during download/pack
  - Run validation automatically before producing download artifacts
  - Report validation warnings in download response metadata
  - This proposal does not prescribe whether `validate_document` is also available as an explicit tool

## Dependencies

- Phase 1 (normalization primitives) can proceed independently
- Phase 2 depends on Phase 1 (primitives must exist before pipeline integration)
- Phase 3 depends on Phase 2 (pipeline must be integrated for regression testing)
- Phase 4 is independent of Phases 1–3
