## Context
Safe-Docx currently models editing as an explicit session lifecycle:
1. `open_document` creates session state
2. tools consume `session_id`
3. session expires after TTL

This is correct for stateful editing, but ergonomically expensive for prompt-driven agents. We need to preserve session safety while allowing file-first entry with deterministic behavior.

## Goals / Non-Goals
- Goals:
  - Remove mandatory separate open step for normal usage.
  - Keep deterministic, inspectable session semantics.
  - Add explicit session reset/clear capabilities.
  - Add clone/fork workflow for form-copy use cases.
  - Lock quote-normalization behavior behind spec-traceable Allure coverage.
  - Deprecate `open_document` as the default entry workflow.
- Non-Goals:
  - Adding a batch-edit tool in this change.
  - Introducing index-based paragraph anchors.
  - Replacing persisted intrinsic paragraph identifiers.
  - Adding collaborative multi-user locking.

## Resolved Trade-offs
1. Auto-session scope: apply to all document tools.
2. Session reuse policy: prefer most-recently-used active session.
3. Reuse strictness: metadata warning only (non-blocking).
4. `clear_session(file_path)` semantics: clear all active sessions bound to the file.
5. `clear_session(clear_all=true)` safety: explicit confirmation required.
6. `duplicate_document` default destination: timestamped suffix.
7. `open_document` lifecycle: deprecate, with migration guidance to file-first calls.
8. Quote normalization: enforce by OpenSpec scenarios and Allure traceability tests.

## Decisions
- Decision: Session-aware tools accept either `session_id`, `file_path`, or both.
  - Why: supports old and new entry styles while enabling gradual migration.
- Decision: Auto-sessionization applies to `read_file`, `grep`, `smart_edit`, `smart_insert`, `download`, and `get_session_status`.
  - Why: every document operation should work without a separate pre-open call.
- Decision: If multiple active sessions exist for one file path, choose most-recently-used session by default.
  - Why: deterministic behavior with minimal surprise.
- Decision: Reuse stays non-blocking and must return explicit warning metadata.
  - Why: avoids interrupting agent flows while surfacing state reuse clearly.
- Decision: Add `clear_session` with session-id, file-path, and clear-all modes.
  - Why: TTL-only cleanup is insufficient for deterministic user control.
- Decision: Add `duplicate_document` to copy source bytes and immediately open a fresh session on the destination.
  - Why: common legal-form workflow; removes manual copy/open friction.
- Decision: Deprecate `open_document` in tool descriptions and examples.
  - Why: file-first workflow becomes primary; old entrypoint remains temporarily for compatibility.
- Decision: Promote quote-normalization fallback parity into explicit test-gated behavior.
  - Why: prevent regressions for smart/ASCII quote and whitespace variations.

## API Shape
- Session-aware tools input contract:
  - `session_id` (optional)
  - `file_path` (optional)
  - both allowed only when they resolve to the same file/session context
- Resolution order:
  1. If `session_id` exists, resolve it.
  2. If `file_path` exists and no `session_id`, resolve/reuse by normalized path.
  3. If no active session exists for path, create one.
  4. If both are provided and conflict, reject with conflict error and remediation hint.
- Required response metadata for resolved calls:
  - `resolved_session_id`
  - `resolved_file_path`
  - `session_resolution` (`opened_new_session` | `reused_existing_session` | `explicit_session`)
  - `warning` when reusing an existing session
  - `edit_revision`, `edit_count`, `created_at`, `last_used_at` when reuse occurs
- New `clear_session` tool:
  - args: `session_id?`, `file_path?`, `clear_all?`, `confirm?`
  - rules:
    - `clear_all=true` requires `confirm=true`
    - `file_path` clears all active sessions mapped to that file
  - response includes list of cleared session IDs and clear mode
- New `duplicate_document` tool:
  - args: `source_file_path`, `destination_file_path?`, `overwrite?`
  - default destination:
    - `<basename>.copy.<YYYYMMDDTHHMMSSZ>.docx` in same directory
  - response includes `destination_file_path`, `session_id`, `session_resolution`

## Compatibility and Migration
- `open_document` remains callable during migration but is marked deprecated in:
  - MCP tool description
  - README examples
  - response metadata (`deprecation_warning`)
- First-party examples migrate to file-first calls in this change.

## Risk and Mitigations
- Risk: hidden state reuse causes accidental continuation on old edits.
  - Mitigation: deterministic MRU selection plus explicit warning metadata.
- Risk: bulk clear deletes more sessions than expected.
  - Mitigation: clear mode in response plus confirmation gate for `clear_all`.
- Risk: quote-normalization drift from Python parity.
  - Mitigation: scenario-mapped Allure tests required by spec coverage validator.
