## ADDED Requirements

### Requirement: Tool Session Entry for Safe-Docx MCP
The Safe-Docx MCP server SHALL support file-first entry for document tools while preserving explicit session semantics.

#### Scenario: document tools accept file-first entry without pre-open
- **WHEN** any document tool (`read_file`, `grep`, `smart_edit`, `smart_insert`, `download`, `get_session_status`) is called with `file_path` and without `session_id`
- **THEN** the server SHALL resolve a session for that file (reusing an active one or creating a new one)
- **AND** return `resolved_session_id` and `resolved_file_path` in response metadata

#### Scenario: reuse policy selects most-recently-used session
- **GIVEN** multiple active sessions exist for the same normalized `file_path`
- **WHEN** a document tool is called with that `file_path` and no `session_id`
- **THEN** the server SHALL reuse the most-recently-used active session for that file

#### Scenario: existing session reuse is non-blocking and warns via metadata
- **GIVEN** an active editing session already exists for a file
- **WHEN** a document tool is called with that `file_path` and no `session_id`
- **THEN** the server SHALL execute the request without requiring opt-in flags
- **AND** SHALL return warning metadata indicating existing session reuse
- **AND** SHALL include reuse context (`edit_revision`, `edit_count`, `created_at`, `last_used_at`) in the response

#### Scenario: conflicting `session_id` and `file_path` is rejected
- **WHEN** a tool call provides both `session_id` and `file_path` that resolve to different sessions/files
- **THEN** the server SHALL reject the call with a conflict error
- **AND** provide remediation guidance

### Requirement: Matching Fallback Parity
The Safe-Docx MCP matching behavior SHALL retain Python-compatible fallback semantics for robust in-paragraph targeting.

#### Scenario: quote-normalized fallback matches smart quotes and ASCII quotes
- **GIVEN** paragraph text containing smart quotes
- **WHEN** `smart_edit` is called with equivalent ASCII-quote `old_string`
- **THEN** the server SHALL resolve a unique fallback match and apply the edit

#### Scenario: flexible-whitespace fallback ignores spacing variance
- **GIVEN** paragraph text containing repeated/mixed whitespace
- **WHEN** `smart_edit` is called with normalized spacing in `old_string`
- **THEN** the server SHALL resolve a unique fallback match and apply the edit

#### Scenario: quote-optional fallback matches quoted and unquoted term references
- **GIVEN** paragraph text containing quoted term occurrences
- **WHEN** `smart_edit` is called with unquoted equivalent `old_string`
- **THEN** the server SHALL resolve a unique fallback match and apply the edit

#### Scenario: quote-normalization scenarios are test-mapped in Allure coverage
- **WHEN** safe-docx Allure tests and spec-coverage validation run in CI
- **THEN** each quote-normalization fallback scenario SHALL be mapped to OpenSpec scenario IDs
- **AND** the validation step SHALL fail when mappings are missing

### Requirement: Explicit Session Control
The Safe-Docx MCP server SHALL provide explicit tools to clear session state without waiting for TTL expiry.

#### Scenario: clear one session by id
- **WHEN** `clear_session` is called with `session_id`
- **THEN** the server SHALL remove that session
- **AND** future use of that id SHALL return `SESSION_NOT_FOUND`

#### Scenario: clear sessions by file path clears all sessions for that file
- **WHEN** `clear_session` is called with `file_path`
- **THEN** the server SHALL clear all active sessions mapped to that normalized file path
- **AND** the response SHALL report exactly which session IDs were cleared

#### Scenario: clear all sessions requires explicit confirmation
- **WHEN** `clear_session` is called with `clear_all=true`
- **THEN** the server SHALL require explicit confirmation input
- **AND** reject the call if confirmation is missing

### Requirement: Document Duplication and Forked Session
The Safe-Docx MCP server SHALL support cloning a source `.docx` and opening a fresh editing session for the clone.

#### Scenario: duplicate document creates independent session
- **WHEN** `duplicate_document` is called with a valid source path and destination path
- **THEN** the server SHALL copy the source document to destination
- **AND** SHALL create and return a new editing `session_id` bound to the destination file
- **AND** edits in the new session SHALL NOT mutate the source document

#### Scenario: duplicate uses timestamped destination when path is omitted
- **WHEN** `duplicate_document` is called without `destination_file_path`
- **THEN** the server SHALL create a destination path with a timestamped suffix in the same directory
- **AND** SHALL return that resolved destination path in the response

#### Scenario: duplicate respects overwrite safety
- **WHEN** `duplicate_document` is called with an existing destination path and overwrite disabled
- **THEN** the server SHALL reject the request with an overwrite-protection error
- **AND** provide remediation guidance

### Requirement: Deprecated Explicit Open Step
The Safe-Docx MCP server SHALL deprecate `open_document` as the primary entrypoint in favor of file-first tool calls.

#### Scenario: open_document remains callable with deprecation warning
- **WHEN** `open_document` is called
- **THEN** the server SHALL continue returning a valid `session_id`
- **AND** SHALL include deprecation guidance directing callers to file-first usage
