# Connectors

## How tool references work

This skill uses `~~category` placeholders for optional integrations. The skill works without any connectors configured — they enhance the experience when available.

## Connectors for this skill

| Category | Placeholder | Recommended server | Other options |
|----------|-------------|-------------------|---------------|
| Compliance data | `~~compliance` | Compliance MCP server (planned — not yet available) | Local `compliance/` directory files |

### Local compliance data (current default)

If the `compliance/` directory exists with SOC 2 test metadata, the skill reads those directly. No MCP server needed.

### Compliance MCP server (planned)

A dedicated compliance MCP server with live SOC 2 test pass/fail data and readiness scores is planned but not yet available. When released, it will be installable as a standard MCP server. Until then, the skill operates in local-data or reference-only mode.

### Fallback: Reference only

Without any connector, the skill uses embedded criteria mapping and checklists. No organization-specific status data is available in this mode.
