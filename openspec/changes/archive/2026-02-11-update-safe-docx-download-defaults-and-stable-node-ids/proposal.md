# Change: Update Safe Docx Download Defaults and Stable Node IDs

## Why

Safe Docx editing currently makes users do unnecessary extra work to get both clean and redline outputs, and anchor IDs can drift between sessions. In practice this creates avoidable re-edit loops, extra compute, and higher risk of targeting the wrong paragraph.

The expected behavior is:
- One edit pass should be enough to get both clean and redline outputs.
- Users should be able to re-download those outputs by `session_id` without replaying edits.
- Paragraph/node anchors should be stable and not depend on shifting paragraph indexes.

## What Changes

- Make `download` default to returning both output variants (`clean` and `redline`) unless explicitly overridden.
- Add session-level artifact caching so users can re-download previously generated outputs by `session_id` without re-applying edits.
- Use persisted intrinsic paragraph IDs (`jr_para_*`) as canonical anchor identity across MCP operations.
- Explicitly prohibit sequential/index-based node IDs (e.g., `para-17`) for MCP editing anchors.
- Preserve anchor stability across download operations (downloads MUST NOT mutate the active session's anchor mapping).
- Clarify this behavior in tool schema and response metadata so default vs override behavior is unambiguous.

Out of scope:
- Batch edit API changes.

## Impact

- Affected specs: `mcp-server`
- Affected code:
  - `packages/safe-docx-ts/src/tools/download.ts`
  - `packages/safe-docx-ts/src/tools/open_document.ts`
  - `packages/safe-docx-ts/src/session/manager.ts`
  - `packages/docx-primitives-ts/src/bookmark.ts`
  - `packages/docx-primitives-ts/src/document.ts`
  - `app/mcp_server/server.py`
  - `app/mcp_server/session_manager.py`
- Related in-flight changes to align with:
  - `add-typescript-mcp-server`
  - `standardize-internal-paragraph-id-format`
  - `add-document-session-foundation`
