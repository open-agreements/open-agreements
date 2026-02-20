# Change: Sessionless Entry and Session Controls for Safe-Docx MCP

## Why
The current Safe-Docx MCP workflow requires an explicit `open_document` step before `read_file`, `grep`, and editing/download calls. In practice, this creates avoidable friction for LLM agents and increases stale-runtime confusion when prompts assume file-based entry. We also need explicit session-control and duplication primitives so users can safely reset or fork editing state.

## What Changes
- Add file-based session resolution across all document tools (`read_file`, `grep`, `smart_edit`, `smart_insert`, `download`, `get_session_status`) so they can auto-create or reuse a session when `file_path` is provided.
- Add deterministic session reuse metadata and non-blocking warnings when an existing session for the same file is selected by default (most-recently-used session policy).
- Add `clear_session` tooling to explicitly end one or more sessions, including clearing all active sessions for a file path.
- Add `duplicate_document` tooling to clone a source document and create a fresh editing session on the clone, with a timestamped default destination suffix.
- Deprecate `open_document` as a required entry step and migrate guidance to file-first calls.
- Add explicit OpenSpec + Allure regression coverage for quote-normalized matching behavior (Python parity).

## Impact
- Affected specs: `mcp-server`
- Affected code:
  - `packages/safe-docx-ts/src/server.ts`
  - `packages/safe-docx-ts/src/session/manager.ts`
  - `packages/safe-docx-ts/src/tools/read_file.ts`
  - `packages/safe-docx-ts/src/tools/grep.ts`
  - `packages/safe-docx-ts/src/tools/smart_edit.ts`
  - `packages/safe-docx-ts/src/tools/smart_insert.ts`
  - `packages/safe-docx-ts/src/tools/download.ts`
  - `packages/safe-docx-ts/src/tools/open_document.ts`
  - `packages/safe-docx-ts/src/tools/get_session_status.ts`
  - `packages/safe-docx-ts/src/tools/clear_session.ts`
  - `packages/safe-docx-ts/src/tools/duplicate_document.ts`
  - `packages/safe-docx-ts/test/*.allure.test.ts`
  - `packages/safe-docx-ts/scripts/validate_openspec_coverage.mjs`
