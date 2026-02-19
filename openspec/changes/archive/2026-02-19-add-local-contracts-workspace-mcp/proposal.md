# Change: Add local MCP server for contracts workspace tooling

## Why

The contracts workspace CLI can already initialize/lint/index a local contract
directory, but demo users who prefer Claude local connectors need the same
capability exposed as MCP tools over local `stdio`.

Adding a local MCP package enables direct testing in Claude Code and Claude
Desktop local extension flows without requiring a remote server.

## What Changes

- Add a new sibling package that runs a local MCP server over `stdio`.
- Expose contracts workspace operations as MCP tools:
  - workspace initialization
  - catalog validation/fetch
  - status index generation/lint
- Reuse existing `@open-agreements/contracts-workspace` core functions instead
  of shelling out to CLI commands.
- Return structured tool responses suitable for agent use (counts, findings,
  output paths, errors).
- Add docs for local connector setup in:
  - Claude Code (`claude mcp add --transport stdio ...`)
  - Claude Desktop local extension/dev config
- Keep remote MCP hosting out of scope for this change.

## Impact

- Affected specs:
  - `contracts-workspace` (new MCP access requirement)
- Affected code:
  - New package under `packages/` for local MCP server
  - Small docs updates with local setup steps
  - Tests for tool behavior and error handling
- Compatibility:
  - Non-breaking for existing `open-agreements` and `open-agreements-workspace`
    CLI users
  - MCP server is additive and local-only
