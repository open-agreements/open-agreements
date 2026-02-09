# OpenAgreements

[![npm version](https://img.shields.io/npm/v/open-agreements)](https://www.npmjs.com/package/open-agreements)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Agent Skill](https://img.shields.io/badge/agent--skill-open--agreements-purple)](https://skills.sh)

Open-source legal template filling CLI and library. Generate standard agreements (NDAs, cloud terms, service agreements) from DOCX templates with simple variable substitution.

## Quick Start

```bash
# Install globally
npm install -g open-agreements

# Or run without installing (requires Node.js >=20)
npx -y open-agreements list

# List available templates
open-agreements list

# Fill a template with a JSON data file
open-agreements fill common-paper-mutual-nda -d values.json -o my-nda.docx

# Validate all templates
open-agreements validate
```

## How It Works

1. Choose a template (`open-agreements list`)
2. Provide field values as JSON or via CLI flags
3. The engine renders a filled DOCX preserving all formatting
4. Review the output document

### With Claude Code

Use the built-in slash command:

```
/open-agreements
```

Claude interviews you for field values, then renders the filled DOCX automatically.

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

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to add templates, recipes, and other improvements.

- [Adding templates](docs/adding-templates.md) (CC BY 4.0 / CC0 sources)
- [Adding recipes](docs/adding-recipes.md) (non-redistributable sources)

## Agent Skill

OpenAgreements is available as an [Agent Skill](https://skills.sh) for Claude Code, Cursor, Copilot, Gemini, and other AI coding agents:

```bash
npx skills add open-agreements/open-agreements
```

The skill discovers templates dynamically, interviews users for field values, and renders signable DOCX files -- all with zero pre-installation required.

## Architecture

- **Language**: TypeScript
- **DOCX Engine**: [docx-templates](https://www.npmjs.com/package/docx-templates) (MIT)
- **CLI**: [Commander.js](https://www.npmjs.com/package/commander)
- **Validation**: [Zod](https://www.npmjs.com/package/zod) schemas
- **Skill Pattern**: Agent-agnostic `ToolCommandAdapter` interface

```
src/
├── cli/              # Commander.js CLI
├── commands/         # fill, validate, list
├── core/
│   ├── engine.ts     # docx-templates wrapper
│   ├── metadata.ts   # Zod schemas + loader
│   ├── validation/   # template, license, output
│   └── command-generation/
│       ├── types.ts  # ToolCommandAdapter interface
│       └── adapters/ # Claude Code adapter
└── index.ts          # Public API
```

## License

MIT

Template content is licensed under CC BY 4.0 by their respective authors. See each template's `metadata.yaml` for attribution details.

## Disclaimer

This tool generates documents from standard templates. It does not provide legal advice. No affiliation with or endorsement by Common Paper, Bonterms, Y Combinator, NVCA, or any template source is implied. Consult an attorney for legal guidance.
