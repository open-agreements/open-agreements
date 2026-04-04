# OpenAgreements

[![npm version](https://img.shields.io/npm/v/open-agreements)](https://www.npmjs.com/package/open-agreements)
[![npm downloads](https://img.shields.io/npm/dm/open-agreements.svg)](https://npmjs.org/package/open-agreements)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![CI](https://github.com/open-agreements/open-agreements/actions/workflows/ci.yml/badge.svg)](https://github.com/open-agreements/open-agreements/actions/workflows/ci.yml)
[![codecov](https://img.shields.io/codecov/c/github/open-agreements/open-agreements/main)](https://app.codecov.io/gh/open-agreements/open-agreements)
[![Socket Badge](https://socket.dev/api/badge/npm/package/open-agreements)](https://socket.dev/npm/package/open-agreements)
[![GitHub stargazers](https://img.shields.io/github/stars/open-agreements/open-agreements?style=social)](https://github.com/open-agreements/open-agreements/stargazers)
[![Agent Skill](https://img.shields.io/badge/agent--skill-open--agreements-purple)](https://skills.sh)
[![MCP Server Status](https://img.shields.io/endpoint?url=https%3A%2F%2Fopenagreements.org%2Fapi%2Fstatus%3Fformat%3Dshields)](https://openagreements.openstatus.dev/)
[![install size](https://packagephobia.com/badge?p=open-agreements)](https://packagephobia.com/result?p=open-agreements)

[English](./README.md) | [Español](./README.es.md) | [简体中文](./README.zh.md) | [Português (Brasil)](./README.pt-br.md) | [Deutsch](./README.de.md)

<p align="center">
  <img src="https://raw.githubusercontent.com/open-agreements/open-agreements/main/docs/assets/demo-fill-nda.gif" alt="Fill a Mutual NDA in Claude Code — prompt, answer questions, get a signed-ready DOCX" width="720">
</p>

> *Demo: Claude fills a Common Paper Mutual NDA in under 2 minutes. Sped up for brevity.*

Fill standard legal agreement templates and get signable DOCX files. 41 templates covering NDAs, cloud service agreements, employment docs, contractor agreements, SAFEs, and NVCA financing documents.

Works with Claude Code, Gemini CLI, and Cursor.

## Install

```bash
npm install -g open-agreements
```

Or run directly with zero install:

```bash
npx -y open-agreements@latest list
```

## Quick Start

### With Claude Code (zero install)

Just ask Claude:

```
> Fill the Common Paper mutual NDA for my company
```

Claude discovers templates, interviews you for field values, and renders a signed-ready DOCX. No install needed — Claude runs `npx` on demand.

### With Gemini CLI

```bash
gemini extensions install https://github.com/open-agreements/open-agreements
```

Then ask Gemini to draft an agreement.

### With the CLI

```bash
# See all available templates
open-agreements list

# Fill a template from a JSON data file
open-agreements fill common-paper-mutual-nda -d values.json -o my-nda.docx

# Fill with inline values
open-agreements fill common-paper-mutual-nda --set party_1_name="Acme Corp" --set governing_law="Delaware"
```

### Example Prompts

- "Draft an NDA for our construction subcontractor"
- "Create a consulting agreement for our insurance agency"
- "Fill the independent contractor agreement for a freelance designer"
- "Generate a SAFE with a $5M valuation cap"

### What Happens

1. The agent runs `list --json` to discover templates and their fields
2. It interviews you for field values (grouped by section, a few at a time)
3. It runs `fill <template>` to render a DOCX preserving all original formatting
4. You review and sign the output document

## Templates

41 templates across 7 categories. Run `open-agreements list` for the full inventory.

- **NDAs** — Mutual and one-way (Common Paper, Bonterms)
- **Cloud & SaaS** — Cloud service agreements, order forms, SLAs, pilot agreements, software licenses
- **Services & Contractors** — Professional services, independent contractor, SOW (Common Paper, Bonterms)
- **Employment** — Offer letter, IP assignment, confidentiality acknowledgement, restrictive covenant
- **Data Privacy** — DPA, BAA, AI addendum (Common Paper)
- **SAFEs** — Valuation cap, discount, MFN, pro rata side letter (Y Combinator)
- **Venture Financing** — Stock purchase, certificate of incorporation, investors' rights, voting, ROFR, indemnification, management rights letter (NVCA)

Internal templates are CC BY 4.0. YC SAFEs are CC BY-ND 4.0 (vendored unchanged). NVCA documents are downloaded on demand from nvca.org (not bundled).

## What Gets Installed

```
open-agreements/
  bin/                    # CLI entry point
  dist/                   # Compiled TypeScript
  content/
    templates/            # Fillable DOCX templates with {tag} placeholders
    external/             # YC SAFE templates (vendored unchanged)
  skills/                 # Agent skill definitions (Claude Code, Gemini, Cursor)
  server.json             # MCP server manifest
  gemini-extension.json   # Gemini CLI extension config
  README.md, LICENSE
```

NVCA recipe templates (7) are downloaded at runtime — not bundled in the package.

<details>
<summary><strong>CLI Reference</strong></summary>

### `list`

Show available templates with license info and field counts.

```bash
open-agreements list

# Machine-readable JSON (for agent skills and automation)
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
open-agreements validate                          # All templates
open-agreements validate common-paper-mutual-nda  # One template
```

</details>

<details>
<summary><strong>Agent Setup Details</strong></summary>

### Claude Code — Agent Skill

```bash
npx skills add open-agreements/open-agreements
```

Then ask Claude to draft an agreement. Claude discovers available templates, interviews you for field values, and renders a signed-ready DOCX.

### Gemini CLI — Extension

```bash
gemini extensions install https://github.com/open-agreements/open-agreements
```

The extension provides MCP tools, context files, and skills for template discovery and filling.

### Cursor — Plugin

This repository includes a Cursor plugin manifest at `.cursor-plugin/plugin.json` with MCP wiring in `mcp.json`.

### Local vs. Hosted Execution

OpenAgreements supports two execution modes:

- **Local** (`npx`, global install, or stdio MCP): all processing happens on your machine. No document content leaves your machine.
- **Hosted** (`https://openagreements.org/api/mcp`): template filling runs server-side for fast setup. No filled documents are stored after the response.

Choose based on document sensitivity and workflow needs. See [docs/trust-checklist.md](docs/trust-checklist.md) for a 60-second data-flow summary.

</details>

## Privacy

- **Local mode** (`npx`, global install, stdio MCP): all processing happens on your machine. No document content is sent externally.
- **Hosted mode** (`https://openagreements.org/api/mcp`): template filling runs server-side. No filled documents are stored after the response is returned.

See our [Privacy Policy](https://usejunior.com/privacy_policy) for details.

## See Also

- [safe-docx](https://github.com/UseJunior/safe-docx) — surgical editing of existing Word documents with coding agents (MCP server)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to add templates, recipes, and other improvements.

## License

MIT. Template content is licensed by their respective authors — CC BY 4.0 (Common Paper, Bonterms), CC BY-ND 4.0 (Y Combinator), or proprietary (NVCA, downloaded at runtime). See each template's `metadata.yaml` for details.

This tool generates documents from standard templates. It does not provide legal advice. Consult an attorney for legal guidance.
