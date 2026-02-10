# OpenAgreements

[![npm version](https://img.shields.io/npm/v/open-agreements)](https://www.npmjs.com/package/open-agreements)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Agent Skill](https://img.shields.io/badge/agent--skill-open--agreements-purple)](https://skills.sh)

Fill standard legal agreement templates and produce signable DOCX files. 25 templates covering NDAs, cloud terms, contractor agreements, SAFEs, and NVCA financing documents.

## Use with Claude Code

OpenAgreements works as a [Claude Code plugin](https://docs.anthropic.com/en/docs/claude-code/plugins) and [Agent Skill](https://agentskills.io). No pre-installation required — Claude downloads and runs the CLI on demand via `npx`.

### Option 1: Agent Skill (recommended)

```bash
npx skills add open-agreements/open-agreements
```

Then ask Claude to draft an agreement:

```
> Draft an NDA between Acme Corp and Beta Inc
```

Claude discovers available templates, interviews you for field values, and renders a signed-ready DOCX.

### Option 2: Direct with Claude Code

If you have Node.js >= 20, just ask Claude:

```
> Fill the Common Paper mutual NDA for my company
```

Claude runs `npx -y open-agreements@latest list --json` to discover templates, then `npx -y open-agreements@latest fill <template>` to render the output. Zero install.

### Option 3: CLI

```bash
# Install globally
npm install -g open-agreements

# List available templates
open-agreements list

# Fill a template
open-agreements fill common-paper-mutual-nda -d values.json -o my-nda.docx
```

### What Happens

1. Claude runs `list --json` to discover 25 templates and their fields
2. Claude interviews you for field values (grouped by section, up to 4 questions per round)
3. Claude runs `fill <template>` to render a DOCX preserving all original formatting
4. You review and sign the output document

## Templates

25 templates across three tiers. Run `open-agreements list` for the full inventory.

| Tier | Count | Source | How It Works |
|------|-------|--------|--------------|
| Internal templates | 14 | [Common Paper](https://commonpaper.com), [Bonterms](https://bonterms.com) | Shipped in package, CC BY 4.0 |
| External templates | 4 | [Y Combinator](https://www.ycombinator.com/documents) | Vendored unchanged, CC BY-ND 4.0 |
| Recipes | 7 | [NVCA](https://nvca.org/model-legal-documents/) | Downloaded on demand (not redistributable) |

**Internal templates** (NDAs, cloud terms, contractor agreements, etc.) are CC BY 4.0 — we ship the DOCX with `{tag}` placeholders.

**External templates** (YC SAFEs) are CC BY-ND 4.0 — we vendor the original unchanged. The filled output is a transient derivative on your machine.

**Recipes** (NVCA financing documents) are freely downloadable but not redistributable — we ship only transformation instructions and download the source DOCX from nvca.org at runtime.

Each template is a self-contained directory:

```
templates/<name>/
├── template.docx     # DOCX with {tag} placeholders
├── metadata.yaml     # Fields, license, source, attribution
└── README.md         # Template-specific documentation
```

## CLI Commands

### `fill <template>`

Render a filled DOCX from a template.

```bash
# Using a JSON data file
open-agreements fill common-paper-mutual-nda -d data.json -o output.docx

# Using inline --set flags
open-agreements fill common-paper-mutual-nda --set party_1_name="Acme Corp" --set governing_law="Delaware"
```

### `validate [template]`

Run the validation pipeline on one or all templates.

```bash
open-agreements validate                          # All templates
open-agreements validate common-paper-mutual-nda  # One template
```

### `list`

Show available templates with license info and field counts.

```bash
open-agreements list

# Machine-readable JSON output (for agent skills and automation)
open-agreements list --json
```

## Contracts Workspace CLI (Separate Package)

OpenAgreements now includes a sibling package for repository/workspace operations:

- Package: `@open-agreements/contracts-workspace`
- Binary: `open-agreements-workspace`
- Docs: `docs/contracts-workspace.md`

This package is intentionally separate from `open-agreements` so teams can adopt:

- template filling only
- workspace management only
- or both together

Core workspace features:

- lifecycle-first `init` (`forms/`, `drafts/`, `incoming/`, `executed/`, `archive/`)
- forms catalog with URL + SHA-256 validation
- YAML status indexing and linting with filename-driven `_executed` status

The v1 model is filesystem-only and works in locally synced cloud-drive folders (for example, Google Drive sync). No Drive API/OAuth integration is required.

## Local MCP for Workspace Demo

For local connector demos, there is a local stdio MCP package:

- Package: `@open-agreements/contracts-workspace-mcp`
- Binary: `open-agreements-workspace-mcp`
- Docs: `docs/contracts-workspace.md`

Quick start:

```bash
npm run build:workspace-mcp
node packages/contracts-workspace-mcp/bin/open-agreements-workspace-mcp.js
```

## Optional Content Roots (Future-Proofing)

To support logical unbundling as form libraries grow, `open-agreements` can load content from additional roots via:

- env var: `OPEN_AGREEMENTS_CONTENT_ROOTS`
- format: path-delimited list of absolute/relative directories (for example, `dirA:dirB` on macOS/Linux)
- expected structure under each root: `templates/`, `external/`, and/or `recipes/`

Lookup precedence is:

1. roots in `OPEN_AGREEMENTS_CONTENT_ROOTS` (in listed order)
2. bundled package content (default fallback)

This keeps default installs simple while allowing advanced users to move large content libraries outside the core package.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to add templates, recipes, and other improvements.

- [Adding templates](docs/adding-templates.md) (CC BY 4.0 / CC0 sources)
- [Adding recipes](docs/adding-recipes.md) (non-redistributable sources)

## Architecture

- **Language**: TypeScript
- **DOCX Engine**: [docx-templates](https://www.npmjs.com/package/docx-templates) (MIT)
- **CLI**: [Commander.js](https://www.npmjs.com/package/commander)
- **Validation**: [Zod](https://www.npmjs.com/package/zod) schemas
- **Skill Pattern**: Agent-agnostic `ToolCommandAdapter` interface

```
src/
├── cli/              # Commander.js CLI
├── commands/         # fill, validate, list, recipe, scan
├── core/
│   ├── engine.ts     # docx-templates wrapper
│   ├── metadata.ts   # Zod schemas + loader
│   ├── recipe/       # Recipe pipeline (clean → patch → fill → verify)
│   ├── external/     # External template support
│   ├── validation/   # template, license, output, recipe
│   └── command-generation/
│       ├── types.ts  # ToolCommandAdapter interface
│       └── adapters/ # Claude Code adapter
└── index.ts          # Public API
```

## Resources

- [Claude Code Documentation](https://docs.anthropic.com/en/docs/claude-code)
- [Claude Code Plugins Guide](https://docs.anthropic.com/en/docs/claude-code/plugins)
- [Agent Skills Specification](https://agentskills.io)

## License

MIT

Template content is licensed by their respective authors — CC BY 4.0 (Common Paper, Bonterms), CC BY-ND 4.0 (Y Combinator), or proprietary (NVCA, downloaded at runtime). See each template's `metadata.yaml` for details.

## Disclaimer

This tool generates documents from standard templates. It does not provide legal advice. No affiliation with or endorsement by Common Paper, Bonterms, Y Combinator, NVCA, or any template source is implied. Consult an attorney for legal guidance.
