# Connectors

## How tool references work

This skill uses `~~compliance` placeholders for the Internal ISO Audit MCP server. The skill works without the server configured — it falls back to embedded `rules/` files for procedural guidance.

## Connectors for this skill

| Category | Placeholder | Server | Endpoint |
|----------|-------------|--------|----------|
| Compliance data | `~~compliance` | Internal ISO Audit MCP | `https://internalisoaudit.com/api/mcp` |

### Internal ISO Audit MCP server

The MCP server at `internalisoaudit.com/api/mcp` provides ISO 27001 control guidance via JSON-RPC 2.0 (streamable HTTP). Add it to your MCP client configuration:

```json
{
  "mcpServers": {
    "internalisoaudit": {
      "type": "url",
      "url": "https://internalisoaudit.com/api/mcp"
    }
  }
}
```

#### Available tools

| Tool | Description | Key arguments |
|------|-------------|---------------|
| `get_control_guidance` | Full audit guidance for a specific control | `control_id` (e.g. `"A.5.15"`, `"Clause 9.2"`) |
| `list_controls` | List all controls, optionally filtered by domain | `domain?` (`organizational`, `people`, `physical`, `technological`, `isms`) |
| `get_nist_mapping` | ISO 27001 ↔ NIST SP 800-53 cross-reference | `control_id`, `direction?` (`iso_to_nist`, `nist_to_iso`) |
| `search_guidance` | Full-text search across control guidance | `query`, `domain?`, `limit?` (1-50) |

### Fallback: Reference only

Without the MCP server configured, the skill uses embedded `rules/` files for procedural guidance, control descriptions, and evidence checklists. No live control lookup is available in this mode.
