# @open-agreements/contract-templates-mcp

Local stdio MCP server for OpenAgreements template discovery and drafting.

## Scope

This package exposes local template tools over MCP:

- `list_templates`
- `get_template`
- `fill_template`
- `get_apap_template` — export an eligible OpenAgreements-authored template as an APAP Template
- `create_apap_agreement_docx` — render APAP Concerto agreement data to a local DOCX path
- `get_forms_survey_evidence` — fetch a published forms-provider survey's evidence: a summary by
  default, or one requirement's evidence cells via `requirement_id`

It also exposes MCP **resources**: one resource per currently published
forms-provider survey evidence dataset (`resources/list` / `resources/read`).
The listing is discovered live from `openagreements.org/llms.txt` (the
upstream-gated public listing), so unlisted surveys are never exposed and no
survey slugs are hardcoded. Resource URIs are the canonical public URLs
(`https://openagreements.org/api/surveys/{topic}/forms-evidence`), reads return
the raw JSON payload (its top-level `asOf` field carries the review date, also
surfaced as `_meta.asOf`), and no authentication is required. Large surveys
approach 1 MB — prefer the `get_forms_survey_evidence` tool when only part of
the evidence is needed.

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
