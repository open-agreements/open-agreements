## ADDED Requirements

### Requirement: Automatic Document Normalization
The Safe-Docx MCP server SHALL automatically normalize documents on open by running merge_runs and simplify_redlines preprocessing, improving text matching accuracy and read_file context efficiency.

#### Scenario: document is normalized on open by default
- **WHEN** a document is opened via `open_document` or file-first entry without `skip_normalization`
- **THEN** the server SHALL run merge_runs and simplify_redlines on the working copy
- **AND** SHALL report normalization stats (`runs_merged`, `redlines_simplified`) in session metadata

#### Scenario: skip_normalization bypasses preprocessing
- **WHEN** a document is opened with `skip_normalization=true`
- **THEN** the server SHALL NOT run merge_runs or simplify_redlines
- **AND** session metadata SHALL report `normalization_skipped=true`

#### Scenario: normalization stats in session metadata
- **GIVEN** a document that has been normalized on open
- **WHEN** `get_session_status` is called
- **THEN** the response SHALL include `runs_merged`, `redlines_simplified`, and `normalization_skipped` fields

#### Scenario: jr_para_* IDs stable across normalization
- **GIVEN** a document opened with normalization enabled
- **AND** the same document opened with normalization disabled
- **WHEN** `read_file` is called in both sessions
- **THEN** unchanged paragraphs SHALL receive the same `jr_para_*` identifiers regardless of normalization

## MODIFIED Requirements

### Requirement: Tool Session Entry for Safe-Docx MCP
The Safe-Docx MCP server SHALL support file-first entry for document tools while preserving explicit session semantics. Session creation SHALL include automatic normalization by default.

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

#### Scenario: new session creation includes normalization
- **WHEN** a new session is created (via `open_document` or file-first entry)
- **AND** `skip_normalization` is not set to `true`
- **THEN** the session creation pipeline SHALL run: `load → normalize → allocate jr_para bookmarks → cache view`
- **AND** normalization stats SHALL be included in session metadata
