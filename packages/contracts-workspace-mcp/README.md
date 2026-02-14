# @open-agreements/contracts-workspace-mcp

Local stdio MCP server for contracts workspace operations.

## Scope

This package exposes local workspace tools (topic-first init planning, catalog, status) over MCP so
agents can operate on a local contracts directory without a remote server.

## Available Tools

- `workspace_init`
- `catalog_validate`
- `catalog_fetch`
- `status_generate`
- `status_lint`

## Local Run

From this repository:

```bash
npm run build:workspace-mcp
node packages/contracts-workspace-mcp/bin/open-agreements-workspace-mcp.js
```

## Claude Code Local MCP Setup

```bash
claude mcp add --transport stdio open-agreements-workspace-mcp -- node /ABSOLUTE/PATH/TO/open-agreements/packages/contracts-workspace-mcp/bin/open-agreements-workspace-mcp.js
```

Then in Claude Code, call tools like:

- `workspace_init` with `{"root_dir":"/path/to/workspace","agents":["claude","gemini"]}` to get missing folder/file suggestions (no auto-write)
- `status_generate` with `{"root_dir":"/path/to/workspace"}`

## Claude Desktop Local Connector Setup

Configure a local stdio MCP server using the same command and absolute path:

- command: `node`
- args: `[/ABSOLUTE/PATH/TO/open-agreements/packages/contracts-workspace-mcp/bin/open-agreements-workspace-mcp.js]`

Use a local directory for `root_dir` parameters (including locally synced Google
Drive folders).
