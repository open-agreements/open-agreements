# Change: Add Docx Helper Tooling to Safe-Docx

## Why

Safe-Docx currently supports core read/edit/insert/download flows, but it does not expose comment authoring — the most-requested missing helper — which requires entirely new OOXML primitives for comment insertion, threading, and XML part bootstrapping. Additionally, `smart_edit` can't find text fragmented across format-identical runs without prior normalization.

## What Changes

- Add `add_comment` as a new MCP tool (root comments + threaded replies with OOXML wiring).
- Add comment-part bootstrap behavior (create `comments.xml`, `commentsExtended.xml`, `people.xml` and required relationships/content-types when missing) using inline XML template strings.
- Enhance `smart_edit` with an optional `normalize_first` flag that merges format-identical adjacent runs before searching, enabling find/replace on text fragmented across runs.
- Add comment OOXML primitives to `docx-primitives-ts` (bootstrapping, insertion, threading).

### Scope reduction from original proposal

The following items were evaluated and deliberately excluded:

- **`convert_to_pdf`**: Dropped — LibreOffice dependency is too heavy for a local MCP package.
- **`replace_text`**: Absorbed into `smart_edit` via the `normalize_first` option — `smart_edit` already covers formatting-preserving replacement.
- **`merge_runs`**: Remains an internal primitive (exercised through normalize-on-open), not a standalone MCP tool.
- **`simplify_redlines`**: Remains an internal primitive (exercised through normalize-on-open), not a standalone MCP tool.
- **`validate_document`**: Remains an internal primitive (exercised through validate-before-download), not a standalone MCP tool.

## Impact

- Affected specs:
  - `mcp-server`
- Affected code:
  - `packages/docx-primitives-ts/src/comments.ts` (new comment OOXML primitives)
  - `packages/docx-primitives-ts/src/document.ts` (addComment, addCommentReply, mergeRunsOnly methods)
  - `packages/docx-primitives-ts/src/namespaces.ts` (W14/W15/WPC/CT namespace constants)
  - `packages/docx-primitives-ts/src/zip.ts` (hasFile, listFiles utilities)
  - `packages/safe-docx-ts/src/tools/add_comment.ts` (new MCP tool)
  - `packages/safe-docx-ts/src/tools/smart_edit.ts` (normalize_first option)
  - `packages/safe-docx-ts/src/server.ts` (tool registration and dispatch)
  - `packages/safe-docx-ts/test/` and `packages/docx-primitives-ts/test/` (coverage)

## Non-Goals

- No support for `.pptx`/`.xlsx` in this change.
- No PDF conversion (LibreOffice dependency too heavy for local MCP package).
- No new standalone MCP tools for `merge_runs`, `simplify_redlines`, or `validate_document` — these remain internal primitives exercised through existing normalize-on-open and validate-before-download paths.
- No change to existing `smart_edit`/`smart_insert` semantics beyond the optional `normalize_first` flag.
