## Context

We already have local filesystem workspace operations in
`@open-agreements/contracts-workspace`. Users now need those operations
available as local MCP tools so they can demo and operate through Claude local
connector workflows.

## Goals

- Provide local-only MCP access over stdio.
- Reuse existing workspace core functions to avoid behavior drift.
- Keep tool interfaces simple and deterministic for agents.

## Non-Goals

- Remote MCP deployment and auth.
- New workspace behaviors beyond current init/catalog/status functionality.
- Signature request workflows and PDF signature-pack processing.

## Decisions

- Create a sibling package `@open-agreements/contracts-workspace-mcp`.
- Implement MCP tools as thin wrappers around workspace core APIs.
- Use explicit `root_dir` inputs (default `process.cwd()`) to support predictable
  local-folder operation.
- Return structured JSON payloads for success/failure summaries.

## Alternatives Considered

- Shell out to `open-agreements-workspace` CLI from MCP:
  - Rejected due to brittle parsing and duplicated error handling.
- Add MCP support directly into the CLI package:
  - Rejected to keep transport/server concerns separate from core CLI concerns.

## Risks and Mitigations

- Risk: Tool semantics diverge from CLI behavior.
  - Mitigation: call shared core modules (workspace-structure/catalog/indexer/lint).
- Risk: Local path misuse by agents.
  - Mitigation: clear `root_dir` parameter docs and default to cwd only.
- Risk: Demo friction from setup complexity.
  - Mitigation: add copy-paste setup commands for Claude Code/Desktop local flows.
