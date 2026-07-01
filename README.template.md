<p align="center">
  <img src="https://raw.githubusercontent.com/open-agreements/open-agreements/main/docs/assets/oa-seal.svg" alt="OpenAgreements seal" width="140">
</p>

# OpenAgreements

[![npm version](https://img.shields.io/npm/v/open-agreements)](https://www.npmjs.com/package/open-agreements)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![CI](https://github.com/open-agreements/open-agreements/actions/workflows/ci.yml/badge.svg)](https://github.com/open-agreements/open-agreements/actions/workflows/ci.yml)
[![codecov](https://img.shields.io/codecov/c/github/open-agreements/open-agreements/main)](https://app.codecov.io/gh/open-agreements/open-agreements)
[![Agent Skill](https://img.shields.io/badge/agent--skill-open--agreements-purple)](https://skills.sh)

Open, primary-source-backed U.S. legal content **and** standard agreement templates — built for legal teams of any size and the agents helping them.

- **Legal Practice Library** — jurisdiction-by-jurisdiction practice guides (non-compete & restrictive covenants, consumer data privacy, AI employment law), every claim cited to primary law.
- **Templates** — 40+ fillable forms across NDAs, cloud service agreements, employment docs, SAFEs, and NVCA financing documents.
- **Checklists** — clause-by-clause reviewer checklists.
- **Law Surveys** — 50-state and international comparison tables.

This repository mirrors the OpenAgreements public legal content library for GitHub, local AI agents, and contributor pull requests. Everything ships as plain markdown here and as machine-readable twins on [openagreements.org](https://openagreements.org). Accepted content changes are reviewed and synchronized into the publishing workflow for openagreements.org.

[Propose a Form Source](https://github.com/open-agreements/open-agreements/issues/new?template=form-source-proposal.yml) · [Give Feedback](https://github.com/open-agreements/open-agreements/issues/new?template=practice-guide-feedback.yml) · [Request Coverage](https://github.com/open-agreements/open-agreements/issues/new?template=general-enhancement.yml) · [Report an Issue](https://github.com/open-agreements/open-agreements/issues/new/choose)

## Who this is for

The practice guides, surveys, and checklists answer jurisdiction-specific
questions with citations to primary law; the templates start from standard forms
teams already recognize — Common Paper, Bonterms, NVCA model documents, and YC
SAFE templates — keeping source, license, and validation context close to the
document. It does not provide legal advice; consult an attorney.

## Contents

{{CONTENTS}}

## Legal Practice Library

{{LEGAL_PRACTICE_LIBRARY}}

## Available Templates

Fill standard legal agreement templates and get signable DOCX files — party
info, dates, and terms in, formatting-preserving Word document out. The Source
column links to the upstream standard or canonical project page (varies by
publisher); the License column shows redistribution terms; Repo links point to
the GitHub content directory for each template or field-selector. To fill one with an
agent or the CLI, see [Template Filling via MCP](#template-filling-via-mcp).

{{AVAILABLE_TEMPLATES}}

## Checklists

{{CHECKLISTS}}

## Law Surveys

{{LAW_SURVEYS}}

## For AI Agents

Every practice guide, survey, and checklist is plain markdown in
[`legal-practice-library/`](https://github.com/open-agreements/open-agreements/tree/main/legal-practice-library) — clone or fetch it directly. The pages also publish machine-readable twins on openagreements.org, which vary by content type:

| Content | Markdown | JSON | Other |
|---------|----------|------|-------|
| Practice guides | `.md` or `/markdown` | `.json` or `/json` | — |
| Law surveys | — | `.json` or `/json` | `.csv` (spreadsheet import) |
| Checklists | `.md` or `/markdown` | `.json` or `/json` | `contract-api.json` (some contract checklists) |

For example: `https://openagreements.org/practice-guides/non-compete/us/texas.json`, `https://openagreements.org/surveys/non-compete/us.csv`.

The Legal Practice Library is a one-way projection from the OpenAgreements publishing workflow at [openagreements.org](https://openagreements.org); fixes land upstream, not in this repo. Content is licensed CC BY 4.0.

## Available Skills

{{AVAILABLE_SKILLS}}

## Template Filling via MCP

Discover templates, interview for field values, and render a signed-ready DOCX —
from a coding agent (Claude Code, Cursor, Gemini CLI) over MCP, or from the CLI.
The MCP server today focuses on **template filling**; the Legal Practice Library
above is consumed as markdown or via the web twins.

> *Local stdio MCP and the hosted HTTP server at `openagreements.org/api/mcp` expose the same workflow; the hosted server adds a `search_templates` tool.*

### Quick Start

#### With Claude Code

Ask Claude:

```text
Fill the Common Paper mutual NDA for my company
```

Claude can discover templates, interview you for field values, and render a signed-ready DOCX.

#### With the CLI

```bash
# See all available templates
open-agreements list

# Fill a template from a JSON data file
open-agreements fill common-paper-mutual-nda -d values.json -o my-nda.docx

# Fill with inline values
open-agreements fill common-paper-mutual-nda --set party_1_name="Acme Corp" --set governing_law="Delaware"
```

#### Example Prompts

- "Draft an NDA for our construction subcontractor"
- "Create a consulting agreement for our insurance agency"
- "Fill the independent contractor agreement for a freelance designer"
- "Generate a SAFE with a $5M valuation cap"

#### What Happens

1. The agent runs `list --json` to discover templates and their fields.
2. It interviews you for field values grouped by section.
3. It runs `fill <template>` to render a DOCX preserving the source formatting.
4. You review and sign the output document.

## Packages

{{PACKAGES}}

### What Gets Installed

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

<details>
<summary><strong>CLI Reference</strong></summary>

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

</details>

<details>
<summary><strong>Agent Setup Details</strong></summary>

### Claude Code

```bash
npx skills add open-agreements/open-agreements
```

### Gemini CLI

```bash
gemini extensions install https://github.com/open-agreements/open-agreements
```

### Cursor

This repository includes a Cursor plugin manifest at `.cursor-plugin/plugin.json` with MCP wiring in `mcp.json`.

### Local Vs Hosted Execution

- **Local**: `npx`, global install, or stdio MCP. Processing happens on your machine.
- **Hosted**: `https://openagreements.org/api/mcp`. Template filling runs server-side for faster setup.

Choose based on document sensitivity and internal policy. See the trust checklist below for the data-flow summary.

</details>

## Install

### Agent Skill (recommended)

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

### Gemini CLI Extension

```bash
gemini extensions install https://github.com/open-agreements/open-agreements
```

### CLI

```bash
npm install -g open-agreements
```

Or run directly with zero install:

```bash
npx -y open-agreements@latest list
```

---

## Documentation

{{DOCUMENTATION}}

{{LINKS}}

## Privacy

- **Local mode** (`npx`, global install, stdio MCP): all processing happens on your machine. No document content is sent externally.
- **Hosted mode** (`https://openagreements.org/api/mcp`): template filling runs server-side. No filled documents are stored after the response is returned.

See the [Privacy Policy](https://usejunior.com/privacy_policy) for details.

Security policy: see [SECURITY.md](https://github.com/open-agreements/open-agreements/blob/main/SECURITY.md).

## See Also

- [safe-docx](https://github.com/UseJunior/safe-docx) — surgical editing of existing Word documents with coding agents

## Roadmap

Planned work is tracked in [open issues](https://github.com/open-agreements/open-agreements/issues).

## Contributing

See [CONTRIBUTING.md](https://github.com/open-agreements/open-agreements/blob/main/CONTRIBUTING.md) for how to add templates, field-selectors, and other improvements. The Legal Practice Library is generated upstream — see its [`index.md`](https://github.com/open-agreements/open-agreements/blob/main/legal-practice-library/index.md) for where to send content fixes.

## Built With OpenAgreements

- [Safe Clause](https://safeclause.deltaxy.ai) — AI-powered contract platform for startups. [#1 on vibecode.law, March 2026](https://vibecode.law/showcase/safe-clause-317416).

Building on OpenAgreements? Open a PR to add your project.

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=open-agreements/open-agreements&type=Date)](https://star-history.com/#open-agreements/open-agreements&Date)

## License

Project code is licensed under [Apache License 2.0](LICENSE). The Apache license covers the code only — bundled template content retains its upstream licenses, set by its respective authors:

- CC BY 4.0 for Common Paper, Bonterms, OpenAgreements-authored templates, and the Legal Practice Library
- CC BY-ND 4.0 for Y Combinator SAFE templates vendored unchanged
- proprietary or non-redistributable for NVCA source documents handled via field-selector workflows

See each template's `metadata.yaml` for source-specific details.

This tool generates documents from standard templates and provides general legal information. It does not provide legal advice. Consult an attorney for legal guidance.
