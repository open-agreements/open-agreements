# mcp-server Spec Delta: extract_revisions Tool

## ADDED Requirements

### Requirement: Revision Extraction Returns Structured Per-Paragraph Diffs

The `extract_revisions` tool SHALL walk tracked-change markup in a session document and return a JSON array of per-paragraph revision records, each containing before text, after text, individual revision details, and associated comments. Paragraph matching uses `jr_para_*` bookmark IDs as primary keys across accepted/rejected clones, not positional traversal.

#### Scenario: extracting revisions from a document with insertions and deletions
- **GIVEN** a session containing a document with `w:ins` and `w:del` tracked changes
- **WHEN** `extract_revisions` is called with that session
- **THEN** the response contains a `changes` array with one entry per changed paragraph
- **AND** each entry has `para_id`, `before_text`, `after_text`, and `revisions[]`
- **AND** `before_text` reflects the document state with all changes rejected (deleted text restored via `w:delText` → `w:t` conversion)
- **AND** `after_text` reflects the document state with all changes accepted
- **AND** each revision has `type` (one of `INSERTION`, `DELETION`, `MOVE_FROM`, `MOVE_TO`, `FORMAT_CHANGE`), `text`, and `author`

#### Scenario: extracting revisions from a document with no tracked changes
- **GIVEN** a session containing a clean document with no tracked changes
- **WHEN** `extract_revisions` is called
- **THEN** the response has `total_changes: 0` and an empty `changes` array

#### Scenario: extracting revisions includes associated comments
- **GIVEN** a session containing a document with tracked changes and comments anchored to changed paragraphs
- **WHEN** `extract_revisions` is called
- **THEN** each changed paragraph entry includes a `comments[]` array
- **AND** each comment has `author`, `text`, and `date` (ISO 8601 string or null)
- **AND** threaded replies are nested under their parent comment

#### Scenario: property-only changes are included in extraction
- **GIVEN** a session containing a document with `w:rPrChange` or `w:pPrChange` elements
- **WHEN** `extract_revisions` is called
- **THEN** paragraphs with only formatting changes appear in the `changes` array
- **AND** the revision `type` is `FORMAT_CHANGE`

#### Scenario: inserted-only paragraph has empty before text
- **GIVEN** a session containing a document where a paragraph was entirely inserted (tracked)
- **WHEN** `extract_revisions` is called
- **THEN** the entry for that paragraph has `before_text: ""` and a non-empty `after_text`

#### Scenario: deleted-only paragraph has empty after text
- **GIVEN** a session containing a document where a paragraph was entirely deleted (tracked)
- **WHEN** `extract_revisions` is called
- **THEN** the entry for that paragraph has a non-empty `before_text` and `after_text: ""`

#### Scenario: changed paragraphs inside table cells are extracted
- **GIVEN** a session containing a document with tracked changes inside `w:tc` table cells
- **WHEN** `extract_revisions` is called
- **THEN** the changes array includes entries for those table-cell paragraphs

#### Scenario: structurally-empty inserted paragraphs are filtered out
- **GIVEN** a session containing a document with an empty paragraph bearing only a paragraph-level insertion marker (`w:pPr/w:rPr/w:ins`) and no text content
- **WHEN** `extract_revisions` is called
- **THEN** that paragraph is NOT included in the `changes` array
- **AND** `total_changes` does not count it

#### Scenario: real DOCX redline with tracked changes extracts correctly
- **GIVEN** a session opened from a real DOCX file containing tracked changes (insertions and deletions across multiple paragraphs)
- **WHEN** `extract_revisions` is called
- **THEN** `total_changes` is greater than zero
- **AND** each change has a non-empty `para_id`, at least one revision entry, and at least one of `before_text` or `after_text` non-empty
- **AND** revision types are all valid (`INSERTION`, `DELETION`, `MOVE_FROM`, `MOVE_TO`, or `FORMAT_CHANGE`)

### Requirement: Revision Extraction Supports Pagination

The `extract_revisions` tool SHALL support 0-based `offset` and `limit` parameters for paginating large revision sets. Results are ordered by document position for deterministic pagination.

#### Scenario: paginating through revisions with offset and limit
- **GIVEN** a session containing a document with more than 10 changed paragraphs
- **WHEN** `extract_revisions` is called with `limit: 5` and no offset
- **THEN** the response contains at most 5 entries in `changes`
- **AND** `total_changes` reflects the full count
- **AND** `has_more` is `true`

#### Scenario: retrieving subsequent pages with offset
- **GIVEN** a first call returned `has_more: true` with 5 results
- **WHEN** `extract_revisions` is called with `offset: 5, limit: 5`
- **THEN** the response contains the next page of results
- **AND** entries do not overlap with the first page

#### Scenario: offset beyond total returns empty page
- **GIVEN** a document with 3 changed paragraphs
- **WHEN** `extract_revisions` is called with `offset: 10`
- **THEN** the response has an empty `changes` array and `has_more: false`

#### Scenario: invalid limit is rejected
- **GIVEN** `extract_revisions` is called with `limit: 0` or `limit: 501`
- **WHEN** the tool validates the input
- **THEN** the response is an `INVALID_LIMIT` error with hint about valid range (1–500)

#### Scenario: invalid offset is rejected
- **GIVEN** `extract_revisions` is called with `offset: -1`
- **WHEN** the tool validates the input
- **THEN** the response is an `INVALID_OFFSET` error

### Requirement: Revision Extraction Is Read-Only and Cached

The `extract_revisions` tool SHALL NOT mutate the session document. The cloned accept/reject operations used to derive before/after text operate on ephemeral copies. Extraction results SHALL be cached per session by `edit_revision` to avoid recomputation during pagination.

#### Scenario: session document is unchanged after extraction
- **GIVEN** a session with tracked changes and a known `edit_revision`
- **WHEN** `extract_revisions` is called
- **THEN** the session's `edit_revision` is unchanged
- **AND** a subsequent `read_file` returns the same content as before extraction

#### Scenario: repeated extraction at same revision uses cache
- **GIVEN** an extraction was already computed for the current `edit_revision`
- **WHEN** `extract_revisions` is called again (e.g. for page 2)
- **THEN** the response is served from cache without recomputing
- **AND** `total_changes` is consistent with the first call

#### Scenario: new edit invalidates extraction cache
- **GIVEN** an extraction was cached for `edit_revision` N
- **WHEN** an edit creates `edit_revision` N+1
- **THEN** the next `extract_revisions` call recomputes from the updated document

### Requirement: Revision Extraction Requires Session Context

The `extract_revisions` tool SHALL require a session (via `session_id` or `file_path`) to provide the document with tracked changes.

#### Scenario: missing session context returns error
- **GIVEN** no `session_id` or `file_path` is provided
- **WHEN** `extract_revisions` is called
- **THEN** the response is `MISSING_SESSION_CONTEXT` error

#### Scenario: two-file comparison then extraction workflow
- **GIVEN** a redline DOCX produced by `compare_documents` and saved to disk
- **WHEN** `extract_revisions` is called with `file_path` pointing to the redline
- **THEN** the revisions are extracted from the redline document
- **AND** the response contains the structured diff
