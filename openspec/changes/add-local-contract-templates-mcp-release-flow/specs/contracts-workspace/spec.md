## MODIFIED Requirements

### Requirement: Claude and Gemini Integration Guidance
The workspace tooling SHALL provide optional setup guidance for Claude Code and Gemini CLI that references `CONTRACTS.md` as the canonical collaboration ruleset, and SHALL support Gemini extension manifests that can declare multiple local MCP servers for separate capabilities.

#### Scenario: [OA-WKS-004] Workspace init emits AI integration guidance
- **WHEN** a user runs `open-agreements-workspace init --agents claude,gemini`
- **THEN** the tool emits or writes integration instructions for Claude Code and Gemini CLI
- **AND** references `CONTRACTS.md` as required collaboration context

#### Scenario: [OA-WKS-032] Gemini manifest supports separate local MCP capabilities
- **WHEN** Gemini extension configuration is generated/validated for OpenAgreements
- **THEN** workspace operations and template drafting are represented as separate local MCP server entries
- **AND** each entry uses explicit `npx` command wiring without repository `cwd` coupling
