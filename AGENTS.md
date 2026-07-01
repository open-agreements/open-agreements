# Repository guide

OpenAgreements publishes primary-source-backed U.S. legal content and standard
agreement templates, organized as first-class directories:

- `practice-guides/` — jurisdiction practice guides, every claim cited to primary law
- `checklists/` — RFC 2119-style requirement-by-requirement review checklists
- `surveys/` — 50-state comparison tables (with machine-readable `.json` / `.csv` twins)
- `templates/` — fill-ready standard agreement templates
- `skills/` — installable agent skills

See `README.md` for the full catalog and `CONTRIBUTING.md` before opening a pull request.

## Local MCP servers

Two MCP servers power local OpenAgreements workflows over stdio (no hosted endpoint
required; both operate on local filesystem paths):

- `contracts-workspace-mcp` (`@open-agreements/contracts-workspace-mcp`) — workspace
  setup planning (`workspace_init`), catalog validation/fetch (`catalog_validate`,
  `catalog_fetch`), and status generation/lint (`status_generate`, `status_lint`).
- `contract-templates-mcp` (`@open-agreements/contract-templates-mcp`) — template
  discovery (`list_templates`), inspection (`get_template`), and drafting/fill
  output (`fill_template`).

Typical flow: `workspace_init` to plan folders → `list_templates` / `get_template`
to pick and inspect a template → `fill_template` to render a local DOCX → workspace
status tools to track draft/executed lifecycle state.
