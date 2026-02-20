## 1. Sessionless Entry and Resolution
- [x] 1.1 Add shared session resolution helper that accepts `session_id` and/or `file_path` and returns deterministic resolution metadata.
- [x] 1.2 Extend `read_file` and `grep` to auto-open/reuse session via `file_path` when `session_id` is omitted.
- [x] 1.3 Apply the same session resolution contract to `smart_edit`, `smart_insert`, `download`, and `get_session_status`, with conflict checks.
- [x] 1.4 Implement most-recently-used session selection when multiple active sessions exist for one file path.
- [x] 1.5 Add explicit non-blocking reuse-warning metadata (`session_resolution`, `warning`, `resolved_session_id`, `resolved_file_path`, `edit_revision`, `edit_count`, `created_at`, `last_used_at`).
- [x] 1.6 Deprecate `open_document` in MCP descriptions and response metadata while keeping compatibility behavior during migration.

## 2. Session Control
- [x] 2.1 Add `clear_session` MCP tool with targeted and bulk-clear modes.
- [x] 2.2 Implement safe guardrails for bulk clear (explicit confirmation).
- [x] 2.3 Implement `clear_session(file_path)` to clear all active sessions bound to the file path.
- [x] 2.4 Add tests for clear-by-session-id, clear-by-file-path (all sessions), and clear-all behavior.

## 3. Document Duplication
- [x] 3.1 Add `duplicate_document` MCP tool to clone source file and open a new editing session on the clone.
- [x] 3.2 Add overwrite protection and timestamped destination default (`.copy.<YYYYMMDDTHHMMSSZ>.docx`).
- [x] 3.3 Add tests validating duplicate path, content equality, and independent session state.

## 4. Quote-Normalization Regression Guarantees
- [x] 4.1 Add explicit OpenSpec scenario coverage for quote-normalized/flexible-whitespace/quote-optional matching fallback behavior.
- [x] 4.2 Add Allure traceability tests tied to those scenarios.
- [x] 4.3 Ensure spec-coverage validator enforces these scenario mappings.

## 5. Documentation and UX Clarity
- [x] 5.1 Update tool descriptions in MCP registration and README to describe file-path auto-session behavior and `open_document` deprecation.
- [x] 5.2 Document session reuse warnings and `clear_session`/`duplicate_document` workflows.
- [x] 5.3 Include examples for first-call file-path usage, session-id reuse, and explicit session clearing.
