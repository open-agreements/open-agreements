# @open-agreements/contract-templates-mcp

Local stdio MCP server for OpenAgreements template discovery and drafting.

## Scope

This package exposes local template tools over MCP:

- `list_templates`
- `get_template`
- `fill_template`
- `get_apap_template` — export an eligible OpenAgreements-authored template as an APAP Template
- `create_apap_agreement_docx` — render APAP Concerto agreement data to a local DOCX path

The APAP pilot is intentionally limited to the OpenAgreements-authored CIIAA.
The DOCX tool returns a file path rather than inline base64 so clients do not
need to decode or manually reconstruct binary attachments.

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
