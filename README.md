<!-- This file is generated from README.template.md by scripts/generate_readme.mjs. Do not edit README.md directly. -->

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

[English](https://github.com/open-agreements/open-agreements/blob/main/README.md) | [Español](https://github.com/open-agreements/open-agreements/blob/main/README.es.md) | [简体中文](https://github.com/open-agreements/open-agreements/blob/main/README.zh.md) | [Português (Brasil)](https://github.com/open-agreements/open-agreements/blob/main/README.pt-br.md) | [Deutsch](https://github.com/open-agreements/open-agreements/blob/main/README.de.md)

Fill standard legal agreement templates and get signable DOCX files. OpenAgreements includes 40+ templates across NDAs, cloud service agreements, employment docs, contractor agreements, SAFEs, and NVCA financing documents.

Works with Claude Code, Gemini CLI, Cursor, and local MCP or CLI workflows.

## Contents

- [Install](#install)
- [Quick Start](#quick-start)
- [Available Skills](#available-skills)
- [Available Templates](#available-templates)
- [Packages](#packages)
- [Documentation](#documentation)
- [Privacy](#privacy)
- [See Also](#see-also)
- [Contributing](#contributing)
- [Built With OpenAgreements](#built-with-openagreements)
- [License](#license)

<p align="center">
  <img src="https://raw.githubusercontent.com/open-agreements/open-agreements/main/docs/assets/demo-fill-nda.gif" alt="Fill a Mutual NDA in Claude Code — prompt, answer questions, get a signed-ready DOCX" width="720">
</p>

> *Demo: Claude fills a Common Paper Mutual NDA in under 2 minutes. Sped up for brevity.*

## Install

### Agent Skill (recommended)

```bash
npx skills add open-agreements/open-agreements
```

### Claude Hosted MCP

```bash
claude mcp add --transport http open-agreements https://openagreements.ai/api/mcp
```

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

## Quick Start

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

### Example Prompts

- "Draft an NDA for our construction subcontractor"
- "Create a consulting agreement for our insurance agency"
- "Fill the independent contractor agreement for a freelance designer"
- "Generate a SAFE with a $5M valuation cap"

### What Happens

1. The agent runs `list --json` to discover templates and their fields.
2. It interviews you for field values grouped by section.
3. It runs `fill <template>` to render a DOCX preserving the source formatting.
4. You review and sign the output document.

## Available Skills

### Agreement Drafting And Filling

| Skill | Description |
|-------|-------------|
| [open-agreements](https://github.com/open-agreements/open-agreements/tree/main/skills/open-agreements) | Umbrella skill for filling standard legal agreement templates and optionally sending for signature. |
| [nda](https://github.com/open-agreements/open-agreements/tree/main/skills/nda) | Mutual and one-way NDAs from Common Paper and Bonterms. |
| [cloud-service-agreement](https://github.com/open-agreements/open-agreements/tree/main/skills/cloud-service-agreement) | SaaS agreements, MSAs, order forms, software licenses, pilot agreements, and design partner agreements. |
| [services-agreement](https://github.com/open-agreements/open-agreements/tree/main/skills/services-agreement) | Consulting contracts, contractor agreements, SOWs, and professional services agreements. |
| [employment-contract](https://github.com/open-agreements/open-agreements/tree/main/skills/employment-contract) | Offer letters, PIIAs, IP assignments, and confidentiality acknowledgements. |
| [data-privacy-agreement](https://github.com/open-agreements/open-agreements/tree/main/skills/data-privacy-agreement) | DPA, BAA, GDPR, HIPAA, and AI addendum workflows. |
| [safe](https://github.com/open-agreements/open-agreements/tree/main/skills/safe) | Y Combinator SAFE variants for startup fundraising. |
| [venture-financing](https://github.com/open-agreements/open-agreements/tree/main/skills/venture-financing) | NVCA venture financing documents for Series A and related rounds. |

### Editing And Client Workflows

| Skill | Description |
|-------|-------------|
| [edit-docx-agreement](https://github.com/open-agreements/open-agreements/tree/main/skills/edit-docx-agreement) | Surgical DOCX agreement edits with formatting-preserving changes and tracked-output workflows. |
| [client-email](https://github.com/open-agreements/open-agreements/tree/main/skills/client-email) | Client-facing cover notes, redline summaries, deliverable emails, and follow-ups. |
| [delaware-franchise-tax](https://github.com/open-agreements/open-agreements/tree/main/skills/delaware-franchise-tax) | Delaware annual franchise tax and annual report filing guidance. |

### Compliance And Audit

| Skill | Description |
|-------|-------------|
| [soc2-readiness](https://github.com/open-agreements/open-agreements/tree/main/skills/soc2-readiness) | SOC 2 readiness assessment, gap analysis, and remediation planning. |
| [iso-27001-internal-audit](https://github.com/open-agreements/open-agreements/tree/main/skills/iso-27001-internal-audit) | ISO 27001 internal audit walkthroughs with findings and control review. |
| [iso-27001-evidence-collection](https://github.com/open-agreements/open-agreements/tree/main/skills/iso-27001-evidence-collection) | Auditor-ready ISO 27001 and SOC 2 evidence collection workflows. |

### Developer Workflows

| Skill | Description |
|-------|-------------|
| [recipe-quality-audit](https://github.com/open-agreements/open-agreements/tree/main/skills/recipe-quality-audit) | NVCA recipe quality audits, maturity scoring, and coverage checks. |
| [unit-test-philosophy](https://github.com/open-agreements/open-agreements/tree/main/skills/unit-test-philosophy) | Risk-based test strategy and Allure or OpenSpec traceability conventions. |

## Available Templates

Website links open a dedicated template page when one exists, or a preselected install flow when it does not. Repo links point to the GitHub content directory for that template or recipe.

### Confidentiality

| Template | Website | Repo |
|----------|---------|------|
| Bonterms Mutual NDA | [Website](https://usejunior.com/?template=bonterms-mutual-nda#start) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/bonterms-mutual-nda) |
| Common Paper Mutual NDA | [Website](https://usejunior.com/?template=common-paper-mutual-nda#start) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-mutual-nda) |
| One Way NDA | [Website](https://usejunior.com/?template=common-paper-one-way-nda#start) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-one-way-nda) |

### Sales & Licensing

| Template | Website | Repo |
|----------|---------|------|
| Cloud Service Agreement | [Website](https://usejunior.com/?template=common-paper-cloud-service-agreement#start) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-cloud-service-agreement) |
| CSA Click Through | [Website](https://usejunior.com/?template=common-paper-csa-click-through#start) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-csa-click-through) |
| CSA With AI | [Website](https://usejunior.com/?template=common-paper-csa-with-ai#start) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-csa-with-ai) |
| CSA With SLA | [Website](https://usejunior.com/?template=common-paper-csa-with-sla#start) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-csa-with-sla) |
| CSA Without SLA | [Website](https://usejunior.com/?template=common-paper-csa-without-sla#start) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-csa-without-sla) |
| Order Form | [Website](https://usejunior.com/?template=common-paper-order-form#start) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-order-form) |
| Order Form With SLA | [Website](https://usejunior.com/?template=common-paper-order-form-with-sla#start) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-order-form-with-sla) |
| Software License Agreement | [Website](https://usejunior.com/?template=common-paper-software-license-agreement#start) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-software-license-agreement) |

### Data & Compliance

| Template | Website | Repo |
|----------|---------|------|
| AI Addendum | [Website](https://usejunior.com/?template=common-paper-ai-addendum#start) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-ai-addendum) |
| AI Addendum In App | [Website](https://usejunior.com/?template=common-paper-ai-addendum-in-app#start) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-ai-addendum-in-app) |
| Business Associate Agreement | [Website](https://usejunior.com/?template=common-paper-business-associate-agreement#start) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-business-associate-agreement) |
| Data Processing Agreement | [Website](https://usejunior.com/?template=common-paper-data-processing-agreement#start) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-data-processing-agreement) |

### Professional Services

| Template | Website | Repo |
|----------|---------|------|
| Bonterms Professional Services Agreement | [Website](https://usejunior.com/?template=bonterms-professional-services-agreement#start) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/bonterms-professional-services-agreement) |
| Independent Contractor Agreement | [Website](https://usejunior.com/?template=common-paper-independent-contractor-agreement#start) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-independent-contractor-agreement) |
| Common Paper Professional Services Agreement | [Website](https://usejunior.com/?template=common-paper-professional-services-agreement#start) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-professional-services-agreement) |
| Statement Of Work | [Website](https://usejunior.com/?template=common-paper-statement-of-work#start) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-statement-of-work) |

### Deals & Partnerships

| Template | Website | Repo |
|----------|---------|------|
| Amendment | [Website](https://usejunior.com/?template=common-paper-amendment#start) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-amendment) |
| Design Partner Agreement | [Website](https://usejunior.com/?template=common-paper-design-partner-agreement#start) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-design-partner-agreement) |
| Letter Of Intent | [Website](https://usejunior.com/?template=common-paper-letter-of-intent#start) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-letter-of-intent) |
| Partnership Agreement | [Website](https://usejunior.com/?template=common-paper-partnership-agreement#start) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-partnership-agreement) |
| Pilot Agreement | [Website](https://usejunior.com/?template=common-paper-pilot-agreement#start) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-pilot-agreement) |
| Term Sheet | [Website](https://usejunior.com/?template=common-paper-term-sheet#start) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-term-sheet) |

### Employment

| Template | Website | Repo |
|----------|---------|------|
| Employee IP Inventions Assignment | [Website](https://usejunior.com/templates/openagreements-employee-ip-inventions-assignment/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/openagreements-employee-ip-inventions-assignment) |
| Employment Confidentiality Acknowledgement | [Website](https://usejunior.com/templates/openagreements-employment-confidentiality-acknowledgement/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/openagreements-employment-confidentiality-acknowledgement) |
| Employment Offer Letter | [Website](https://usejunior.com/templates/openagreements-employment-offer-letter/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/openagreements-employment-offer-letter) |
| Restrictive Covenant Wyoming | [Website](https://usejunior.com/templates/openagreements-restrictive-covenant-wyoming/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/openagreements-restrictive-covenant-wyoming) |

### SAFEs

| Template | Website | Repo |
|----------|---------|------|
| Discount | [Website](https://usejunior.com/?template=yc-safe-discount#start) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/external/yc-safe-discount) |
| MFN | [Website](https://usejunior.com/?template=yc-safe-mfn#start) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/external/yc-safe-mfn) |
| Pro Rata Side Letter | [Website](https://usejunior.com/?template=yc-safe-pro-rata-side-letter#start) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/external/yc-safe-pro-rata-side-letter) |
| Valuation Cap | [Website](https://usejunior.com/?template=yc-safe-valuation-cap#start) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/external/yc-safe-valuation-cap) |

### Venture Financing

| Template | Website | Repo |
|----------|---------|------|
| Certificate Of Incorporation | [Website](https://usejunior.com/?template=nvca-certificate-of-incorporation#start) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/recipes/nvca-certificate-of-incorporation) |
| Indemnification Agreement | [Website](https://usejunior.com/?template=nvca-indemnification-agreement#start) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/recipes/nvca-indemnification-agreement) |
| Investors Rights Agreement | [Website](https://usejunior.com/?template=nvca-investors-rights-agreement#start) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/recipes/nvca-investors-rights-agreement) |
| Management Rights Letter | [Website](https://usejunior.com/?template=nvca-management-rights-letter#start) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/recipes/nvca-management-rights-letter) |
| ROFR Co Sale Agreement | [Website](https://usejunior.com/?template=nvca-rofr-co-sale-agreement#start) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/recipes/nvca-rofr-co-sale-agreement) |
| Stock Purchase Agreement | [Website](https://usejunior.com/?template=nvca-stock-purchase-agreement#start) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/recipes/nvca-stock-purchase-agreement) |
| Voting Agreement | [Website](https://usejunior.com/?template=nvca-voting-agreement#start) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/recipes/nvca-voting-agreement) |

### Other

| Template | Website | Repo |
|----------|---------|------|
| Closing Checklist | [Website](https://usejunior.com/templates/closing-checklist/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/closing-checklist) |
| Working Group List | [Website](https://usejunior.com/templates/working-group-list/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/working-group-list) |

## Packages

| Package | Description |
|---------|-------------|
| [open-agreements](https://www.npmjs.com/package/open-agreements) | Main CLI and library for template discovery, filling, and DOCX output generation. |
| [@open-agreements/contracts-workspace](https://github.com/open-agreements/open-agreements/blob/main/packages/contracts-workspace/README.md) | Topic-first contracts workspace CLI for folder conventions, catalog fetches, and status generation. |
| [@open-agreements/contract-templates-mcp](https://github.com/open-agreements/open-agreements/blob/main/packages/contract-templates-mcp/README.md) | Local stdio MCP server for `list_templates`, `get_template`, and `fill_template`. |
| [@open-agreements/contracts-workspace-mcp](https://github.com/open-agreements/open-agreements/blob/main/packages/contracts-workspace-mcp/README.md) | Local stdio MCP server for workspace init, catalog, and status operations. |
| [@open-agreements/checklist-mcp](https://github.com/open-agreements/open-agreements/blob/main/packages/checklist-mcp/README.md) | Local stdio MCP server for closing checklist creation, updates, DOCX rendering, and diffs. |

### What Gets Installed

```text
open-agreements/
  bin/                    # CLI entry point
  dist/                   # Compiled TypeScript
  content/
    templates/            # Fillable DOCX templates with {tag} placeholders
    external/             # YC SAFE templates vendored unchanged
    recipes/              # Recipe instructions for non-redistributable sources
  skills/                 # Agent skill definitions
  server.json             # MCP server manifest
  gemini-extension.json   # Gemini CLI extension config
  README.md, LICENSE
```

NVCA recipe templates are downloaded at runtime and are not bundled in the package.

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
- **Hosted**: `https://openagreements.ai/api/mcp`. Template filling runs server-side for faster setup.

Choose based on document sensitivity and internal policy. See the trust checklist below for the data-flow summary.

</details>

---

## Documentation

### Start Here

- [Getting Started](https://usejunior.com/docs/getting-started/)

### Guides

- [Adding Templates](https://usejunior.com/docs/adding-templates/)
- [Adding Recipes](https://usejunior.com/docs/adding-recipes/)
- [Branding Pipeline](https://usejunior.com/docs/template-branding-pipeline/)

### Other Packages

- [Contracts Workspace CLI](https://usejunior.com/docs/contracts-workspace/)

### Reference

- [Licensing](https://usejunior.com/docs/licensing/)
- [Changelog & Release Process](https://usejunior.com/docs/changelog-release-process/)
- [Trust Checklist](https://usejunior.com/docs/trust-checklist/)
- [Supported Tools](https://usejunior.com/docs/supported-tools/)
- [Assumptions](https://usejunior.com/docs/assumptions/)
- [Employment Source Policy](https://usejunior.com/docs/employment-source-policy/)

**Links:** [Website](https://usejunior.com/developer-tools/open-agreements) | [Template Catalog](https://usejunior.com/templates) | [Docs](https://usejunior.com/docs/) | [Trust](https://usejunior.com/trust/) | [npm](https://www.npmjs.com/package/open-agreements)

## Privacy

- **Local mode** (`npx`, global install, stdio MCP): all processing happens on your machine. No document content is sent externally.
- **Hosted mode** (`https://openagreements.ai/api/mcp`): template filling runs server-side. No filled documents are stored after the response is returned.

See the [Privacy Policy](https://usejunior.com/privacy_policy) for details.

## See Also

- [safe-docx](https://github.com/UseJunior/safe-docx) — surgical editing of existing Word documents with coding agents

## Contributing

See [CONTRIBUTING.md](https://github.com/open-agreements/open-agreements/blob/main/CONTRIBUTING.md) for how to add templates, recipes, and other improvements.

## Built With OpenAgreements

- [Safe Clause](https://safeclause.deltaxy.ai) — AI-powered contract platform for startups. [#1 on vibecode.law, March 2026](https://vibecode.law/showcase/safe-clause-317416).

Building on OpenAgreements? Open a PR to add your project.

## License

MIT. Template content is licensed by its respective authors:

- CC BY 4.0 for Common Paper, Bonterms, and OpenAgreements-authored templates
- CC BY-ND 4.0 for Y Combinator SAFE templates vendored unchanged
- proprietary or non-redistributable for NVCA source documents handled via recipe workflows

See each template's `metadata.yaml` for source-specific details.

This tool generates documents from standard templates. It does not provide legal advice. Consult an attorney for legal guidance.
