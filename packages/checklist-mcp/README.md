# @open-agreements/checklist-mcp

Local stdio MCP server for OpenAgreements closing checklist operations.

Provides tools for creating, reading, updating, rendering, and diffing closing checklists via the Model Context Protocol.

## Installation

```bash
npx -y @open-agreements/checklist-mcp
```

Or add to your MCP client config:

```json
{
  "mcpServers": {
    "checklist-mcp": {
      "command": "npx",
      "args": ["-y", "@open-agreements/checklist-mcp"]
    }
  }
}
```

## Tools

- `checklist_create` — Create a new closing checklist
- `checklist_read` — Read checklist state
- `checklist_update` — Apply JSON Patch operations
- `checklist_render_docx` — Render checklist as formatted DOCX
- `checklist_diff` — Import DOCX and diff against canonical state

## License

MIT
