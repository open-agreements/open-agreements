# Connectors

## How tool references work

This skill uses `~~category` placeholders for optional integrations. The skill works without any connectors configured — they enhance the experience when available.

## Connectors for this skill

| Category | Placeholder | Recommended server | Other options |
|----------|-------------|-------------------|---------------|
| Contract templates | `~~contract-templates` | [Open Agreements Remote MCP](https://openagreements.ai/api/mcp) (zero-install, recommended) | Local CLI: [`open-agreements` on npm](https://www.npmjs.com/package/open-agreements) |

### Setting up the Remote MCP (recommended)

The remote MCP handles all 41 templates server-side. No local dependencies needed. See [openagreements.ai](https://openagreements.ai) for setup instructions.

### Alternative: Local CLI

For fully local execution (no network calls during fills), install [`open-agreements` from npm](https://www.npmjs.com/package/open-agreements). Requires Node.js >= 20. See the [README](https://github.com/open-agreements/open-agreements#use-with-claude-code) for details.
