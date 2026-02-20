## ADDED Requirements

### Requirement: Closing Checklist Document Type
The system SHALL provide a closing checklist document type that accepts structured
JSON input describing a deal's working group, documents, action items, and open
issues, and renders it as a formatted .docx file.

#### Scenario: Create closing checklist via MCP
- **WHEN** a client calls `create_closing_checklist` with valid JSON containing deal_name, created_at, updated_at, and optional arrays for working_group, documents, action_items, and open_issues
- **THEN** the system validates the input with Zod, renders a .docx using the closing-checklist template, and returns a download URL and text summary

#### Scenario: Create closing checklist via CLI
- **WHEN** a user runs `open-agreements checklist create -d data.json -o checklist.docx`
- **THEN** the system validates the JSON file, renders a .docx, and writes it to the specified output path

#### Scenario: Render closing checklist as Markdown
- **WHEN** a user runs `open-agreements checklist render -d data.json`
- **THEN** the system validates the JSON and outputs a Markdown representation to stdout

#### Scenario: Invalid checklist input rejected
- **WHEN** malformed input is provided (missing required fields, invalid enum values)
- **THEN** the system returns structured Zod validation errors

### Requirement: MCP Argument Validation with Zod
The system SHALL validate all MCP tool arguments using Zod schemas before processing,
providing structured error messages for invalid input.

#### Scenario: fill_template Zod validation
- **WHEN** a client calls `fill_template` with invalid arguments (e.g., non-string template)
- **THEN** the system returns a validation error with specific field issues

#### Scenario: list_templates Zod validation
- **WHEN** a client calls `list_templates`
- **THEN** the system validates arguments (empty object) before proceeding

### Requirement: Bilateral Issue Tracking
The system SHALL support bilateral issue positions (our_position and their_position)
on open issues within the closing checklist, with optional escalation tiers (YELLOW, RED)
and resolution fields.

#### Scenario: Issue with both positions
- **WHEN** an open issue includes our_position, their_position, and escalation_tier
- **THEN** all three values appear in both the .docx and Markdown renderings
