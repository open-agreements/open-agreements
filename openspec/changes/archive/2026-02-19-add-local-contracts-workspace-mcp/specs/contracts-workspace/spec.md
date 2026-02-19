## ADDED Requirements

### Requirement: Local MCP Server for Contracts Workspace
The contracts workspace capability SHALL provide a local MCP server that runs
over stdio and can be installed as a local connector in agent clients.

#### Scenario: Local MCP server starts on stdio
- **WHEN** a user launches the contracts-workspace MCP server binary locally
- **THEN** the server initializes an MCP stdio transport
- **AND** exposes discoverable tools for workspace operations

### Requirement: Workspace Initialization MCP Tool
The local MCP server SHALL expose a tool that initializes a lifecycle-first
contracts workspace using the same semantics as the workspace CLI init command.

#### Scenario: MCP init creates workspace scaffold
- **WHEN** an MCP client calls the workspace-init tool for a target root directory
- **THEN** lifecycle directories and default files are created if missing
- **AND** the tool response includes created/existing path summaries

### Requirement: Catalog Validation and Fetch MCP Tools
The local MCP server SHALL expose tools for catalog validation and catalog fetch
with checksum verification and pointer-only handling.

#### Scenario: MCP catalog validate returns structured errors
- **WHEN** the catalog contains schema or checksum field errors
- **THEN** the tool returns `valid: false` with a list of error messages

#### Scenario: MCP catalog fetch reports per-entry outcomes
- **WHEN** an MCP client calls catalog fetch
- **THEN** the tool returns downloaded, pointer-only, and failed summaries
- **AND** includes per-entry status details

### Requirement: Status Generation and Lint MCP Tools
The local MCP server SHALL expose tools to generate the YAML status index and to
lint workspace structure/naming/index freshness rules.

#### Scenario: MCP status generate returns index summary
- **WHEN** status generation succeeds
- **THEN** the tool writes the index file
- **AND** returns total documents plus warning/error counts

#### Scenario: MCP status lint returns findings
- **WHEN** lint checks detect rule violations
- **THEN** the tool returns structured findings with severity, code, message, and path

### Requirement: Local Setup Documentation
Project documentation SHALL include local setup instructions for using the MCP
server in Claude Code and Claude Desktop local connector workflows.

#### Scenario: User follows local setup docs
- **WHEN** a user executes documented setup commands
- **THEN** they can connect to and call the local contracts-workspace MCP tools
- **AND** complete a basic init/lint demo against a local directory
