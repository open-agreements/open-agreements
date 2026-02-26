# @open-agreements/contract-templates-mcp

Local stdio MCP server for OpenAgreements template discovery and drafting.

## Scope

This package exposes local template tools over MCP:

- `list_templates`
- `get_template`
- `fill_template`

It is intentionally separate from `@open-agreements/contracts-workspace-mcp`,
which focuses on repository/workspace organization and catalog/status workflows.

## Local Run

From this repository:

```bash
npm run build:contract-templates-mcp
node packages/contract-templates-mcp/bin/open-agreements-contract-templates-mcp.js
```

## Gemini CLI Local MCP Example

```json
{
  "mcpServers": {
    "contract-templates-mcp": {
      "command": "npx",
      "args": ["-y", "@open-agreements/contract-templates-mcp"]
    }
  }
}
```
