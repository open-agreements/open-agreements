# Using OpenAgreements with AI agents & the CLI

Discover templates, interview for field values, and render a signed-ready DOCX —
from a coding agent (Claude Code, Cursor, Gemini CLI) over MCP, or from the CLI.
The MCP server today focuses on **template filling**; the Legal Practice Library
is consumed as markdown or via the machine-readable web twins.

> *Local stdio MCP and the hosted HTTP server at `openagreements.org/api/mcp` expose the same workflow; the hosted server adds a `search_templates` tool.*

## Machine-readable content twins

Every practice guide, survey, and checklist is plain markdown in
[`legal-practice-library/`](https://github.com/open-agreements/open-agreements/tree/main/legal-practice-library) — clone or fetch it directly. The pages also publish machine-readable twins on openagreements.org, which vary by content type:

| Content | Markdown | JSON | Other |
|---------|----------|------|-------|
| Practice guides | `.md` or `/markdown` | `.json` or `/json` | — |
| Law surveys | — | `.json` or `/json` | `.csv` (spreadsheet import) |
| Checklists | `.md` or `/markdown` | `.json` or `/json` | `contract-api.json` (some contract checklists) |

For example: `https://openagreements.org/practice-guides/non-compete/us/texas.json`, `https://openagreements.org/surveys/non-compete/us.csv`.

The Legal Practice Library is a one-way projection from the OpenAgreements publishing workflow at [openagreements.org](https://openagreements.org); fixes land upstream, not in this repo. Content is licensed CC BY 4.0.

## Quick start

### With Claude Code

Ask Claude:

```text
Fill the Common Paper mutual NDA for my company
```

Claude can discover templates, interview you for field values, and render a signed-ready DOCX.

### With the CLI

```bash
# See all available templates
open-agreements list

# Fill a template from a JSON data file
open-agreements fill common-paper-mutual-nda -d values.json -o my-nda.docx

# Fill with inline values
open-agreements fill common-paper-mutual-nda --set party_1_name="Acme Corp" --set governing_law="Delaware"
```

### Example prompts

- "Draft an NDA for our construction subcontractor"
- "Create a consulting agreement for our insurance agency"
- "Fill the independent contractor agreement for a freelance designer"
- "Generate a SAFE with a $5M valuation cap"

### What happens

1. The agent runs `list --json` to discover templates and their fields.
2. It interviews you for field values grouped by section.
3. It runs `fill <template>` to render a DOCX preserving the source formatting.
4. You review and sign the output document.

## What gets installed

```text
open-agreements/
  bin/                    # CLI entry point
  dist/                   # Compiled TypeScript
  templates/              # All content: templates/<source>-<rights>/<slug>/
                          #   fillable DOCX templates, vendored no-derivatives
                          #   forms (e.g. YC SAFEs), and field-selector
                          #   instructions — kind is set per slug in metadata.yaml
  legal-practice-library/ # Practice guides, surveys, and checklists (markdown)
  skills/                 # Agent skill definitions
  server.json             # MCP server manifest
  gemini-extension.json   # Gemini CLI extension config
  README.md, LICENSE
```

NVCA field-selector templates are downloaded at runtime and are not bundled in the package.

## CLI reference

### `list`

Show available templates with license info and field counts.

```bash
open-agreements list

# Machine-readable JSON for agent skills and automation
open-agreements list --json
```

### `fill <template>`

Render a filled DOCX from a template.

```bash
# From a JSON data file
open-agreements fill common-paper-mutual-nda -d data.json -o output.docx

# With inline --set flags
open-agreements fill common-paper-mutual-nda --set party_1_name="Acme Corp" --set governing_law="Delaware"
```

### `validate [template]`

Run the validation pipeline on one or all templates.

```bash
open-agreements validate
open-agreements validate common-paper-mutual-nda
```

## Install

### Agent skill (recommended)

```bash
npx skills add open-agreements/open-agreements
```

### Remote MCP

Connect any MCP-compatible agent to the hosted server at `https://openagreements.org/api/mcp`.

**Claude Code**

```bash
claude mcp add --transport http open-agreements https://openagreements.org/api/mcp
```

**Codex CLI**

```bash
codex mcp add open-agreements --url https://openagreements.org/api/mcp
```

**Other agents** — point your client at `https://openagreements.org/api/mcp` (streamable HTTP).

### Gemini CLI extension

```bash
gemini extensions install https://github.com/open-agreements/open-agreements
```

### Cursor

This repository includes a Cursor plugin manifest at `.cursor-plugin/plugin.json` with MCP wiring in `mcp.json`.

### CLI

```bash
npm install -g open-agreements
```

Or run directly with zero install:

```bash
npx -y open-agreements@latest list
```

## Local vs hosted execution

- **Local**: `npx`, global install, or stdio MCP. Processing happens on your machine.
- **Hosted**: `https://openagreements.org/api/mcp`. Template filling runs server-side for faster setup.

Choose based on document sensitivity and internal policy. See the [trust checklist](trust-checklist.md) for the data-flow summary.
