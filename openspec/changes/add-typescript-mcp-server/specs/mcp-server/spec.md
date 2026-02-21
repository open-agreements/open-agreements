# MCP Server Specification Delta

## ADDED Requirements

### Requirement: TypeScript MCP Server Distribution
The system SHALL provide a TypeScript implementation of the Safe Docx MCP server that can be installed via `npx @usejunior/safe-docx` without requiring Python or manual setup.

#### Scenario: Zero-friction installation on Claude Desktop
- **WHEN** a user has Claude Desktop installed (which bundles Node.js)
- **AND** the user runs `npx @usejunior/safe-docx`
- **THEN** the MCP server starts successfully
- **AND** all 7 tools are registered with Claude

#### Scenario: NPM package availability
- **WHEN** a developer searches for `@usejunior/safe-docx` on npmjs.com
- **THEN** the package is found
- **AND** the package includes TypeScript type definitions
- **AND** the package has provenance attestation

### Requirement: Tool Feature Parity
The TypeScript MCP server SHALL implement all tools with identical signatures and behavior to the Python implementation.

#### Scenario: open_document tool
- **WHEN** the `open_document` tool is called with a valid .docx file path
- **THEN** a session is created with a unique session_id
- **AND** paragraph bookmarks (jr_para_*) are inserted
- **AND** document metadata is returned

#### Scenario: read_file tool
- **WHEN** the `read_file` tool is called with a valid session_id
- **THEN** document content is returned with paragraph IDs
- **AND** pagination via offset/limit is supported

#### Scenario: grep tool
- **WHEN** the `grep` tool is called with search patterns
- **THEN** matching paragraphs are returned with IDs and context
- **AND** regex patterns are supported

#### Scenario: smart_edit tool
- **WHEN** the `smart_edit` tool replaces text in a paragraph
- **THEN** the replacement occurs at the correct location
- **AND** all formatting (bold, italic, fonts) is preserved
- **AND** the edit is atomic (single node operation)

#### Scenario: smart_insert tool
- **WHEN** the `smart_insert` tool adds a new paragraph
- **THEN** the paragraph is inserted at the specified position (BEFORE/AFTER anchor)
- **AND** formatting is copied from the anchor paragraph

#### Scenario: download tool
- **WHEN** the `download` tool is called with a save path
- **THEN** the edited document is saved to the specified location
- **AND** the saved document opens correctly in Microsoft Word

#### Scenario: get_session_status tool
- **WHEN** the `get_session_status` tool is called
- **THEN** session metadata is returned (edit_count, expires_at, filename)

### Requirement: Tool Annotations
All MCP tools SHALL include proper safety annotations as required by Anthropic's MCP Directory Policy.

#### Scenario: Read-only tools annotated correctly
- **WHEN** the MCP server registers tools
- **THEN** `open_document`, `read_file`, `grep`, and `get_session_status` have `readOnlyHint: true`
- **AND** these tools have `destructiveHint: false`

#### Scenario: Destructive tools annotated correctly
- **WHEN** the MCP server registers tools
- **THEN** `smart_edit`, `smart_insert`, and `download` have `destructiveHint: true`
- **AND** these tools have `readOnlyHint: false`

### Requirement: Atomic Node Operations
The TypeScript implementation SHALL use atomic node operations for document editing, matching the Python implementation's safety guarantees.

#### Scenario: Format-preserving text replacement
- **WHEN** text is replaced within a run that has bold formatting
- **THEN** the replacement text retains the bold formatting
- **AND** no other parts of the document are modified

#### Scenario: Bookmark-based targeting
- **WHEN** an edit targets paragraph `jr_para_003`
- **THEN** only that specific paragraph is modified
- **AND** the bookmark remains valid after the edit

#### Scenario: No XML corruption
- **WHEN** any edit operation is performed
- **THEN** the resulting document is valid OOXML
- **AND** the document opens without errors in Microsoft Word

### Requirement: Session Management
The TypeScript server SHALL manage editing sessions with the same behavior as the Python implementation.

#### Scenario: Session creation
- **WHEN** a document is opened
- **THEN** a session_id is generated in format `ses_[12 alphanumeric]`
- **AND** the session expires after 1 hour of inactivity

#### Scenario: Session expiration
- **WHEN** a session has been inactive for >1 hour
- **AND** a tool is called with that session_id
- **THEN** a `SESSION_EXPIRED` error is returned
- **AND** the user is advised to create a new session

#### Scenario: Concurrent sessions
- **WHEN** multiple documents are opened
- **THEN** each has an independent session
- **AND** edits to one document do not affect others

### Requirement: Cross-Platform Compatibility
The TypeScript MCP server SHALL work on all platforms supported by Claude Desktop.

#### Scenario: macOS compatibility
- **WHEN** the server runs on macOS (darwin)
- **THEN** file paths with `~` are expanded correctly
- **AND** the server communicates via stdio transport

#### Scenario: Windows compatibility
- **WHEN** the server runs on Windows (win32)
- **THEN** file paths with backslashes are handled correctly
- **AND** the server communicates via stdio transport

### Requirement: Error Handling
The TypeScript server SHALL provide helpful error messages matching the Python implementation's error format.

#### Scenario: File not found error
- **WHEN** `open_document` is called with a non-existent path
- **THEN** error code `FILE_NOT_FOUND` is returned
- **AND** a hint suggests copying the file to Downloads or Documents

#### Scenario: Invalid file type error
- **WHEN** `open_document` is called with a non-.docx file
- **THEN** error code `INVALID_FILE_TYPE` is returned
- **AND** a hint indicates only .docx files are supported

#### Scenario: Session not found error
- **WHEN** a tool is called with an invalid session_id
- **THEN** error code `SESSION_NOT_FOUND` is returned
- **AND** a hint suggests creating a new session

## MODIFIED Requirements

*None - this is a new capability alongside the existing Python implementation*

## REMOVED Requirements

*None - Python implementation is preserved for internal use*
