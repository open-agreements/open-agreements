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
- [Available Templates](#available-templates)
- [Available Skills](#available-skills)
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

## Available Templates

The Source column links to the upstream standard, source document, or canonical project page (varies by publisher). The License column shows redistribution terms. Repo links point to the GitHub content directory for each template or recipe.

### Confidentiality

| Template | Website | Source | License | Repo |
|----------|---------|--------|---------|------|
| Bonterms Mutual NDA | [Website](https://usejunior.com/templates/bonterms-mutual-nda) | [Bonterms](https://github.com/Bonterms/Mutual-NDA) | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/bonterms-mutual-nda) |
| Common Paper Mutual NDA | [Website](https://usejunior.com/templates/common-paper-mutual-nda) | [Common Paper](https://commonpaper.com/standards/mutual-nda/1.0) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-mutual-nda) |
| One Way NDA | [Website](https://usejunior.com/templates/common-paper-one-way-nda) | [Common Paper](https://commonpaper.com/standards/one-way-nda) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-one-way-nda) |

### Sales & Licensing

| Template | Website | Source | License | Repo |
|----------|---------|--------|---------|------|
| Cloud Service Agreement | [Website](https://usejunior.com/templates/common-paper-cloud-service-agreement) | [Common Paper](https://commonpaper.com/standards/cloud-service-agreement/2.1) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-cloud-service-agreement) |
| CSA Click Through | [Website](https://usejunior.com/templates/common-paper-csa-click-through) | [Common Paper](https://commonpaper.com/standards/cloud-service-agreement/2.1) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-csa-click-through) |
| CSA With AI | [Website](https://usejunior.com/templates/common-paper-csa-with-ai) | [Common Paper](https://commonpaper.com/standards/cloud-service-agreement/2.1) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-csa-with-ai) |
| CSA With SLA | [Website](https://usejunior.com/templates/common-paper-csa-with-sla) | [Common Paper](https://commonpaper.com/standards/cloud-service-agreement/2.1) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-csa-with-sla) |
| CSA Without SLA | [Website](https://usejunior.com/templates/common-paper-csa-without-sla) | [Common Paper](https://commonpaper.com/standards/cloud-service-agreement/2.1) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-csa-without-sla) |
| Order Form | [Website](https://usejunior.com/templates/common-paper-order-form) | [Common Paper](https://commonpaper.com/standards/cloud-service-agreement/2.1) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-order-form) |
| Order Form With SLA | [Website](https://usejunior.com/templates/common-paper-order-form-with-sla) | [Common Paper](https://commonpaper.com/standards/cloud-service-agreement/2.1) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-order-form-with-sla) |
| Software License Agreement | [Website](https://usejunior.com/templates/common-paper-software-license-agreement) | [Common Paper](https://commonpaper.com/standards/software-license-agreement/1.1) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-software-license-agreement) |

### Data & Compliance

| Template | Website | Source | License | Repo |
|----------|---------|--------|---------|------|
| AI Addendum | [Website](https://usejunior.com/templates/common-paper-ai-addendum) | [Common Paper](https://commonpaper.com/standards/ai-addendum/1.0) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-ai-addendum) |
| AI Addendum In App | [Website](https://usejunior.com/templates/common-paper-ai-addendum-in-app) | [Common Paper](https://commonpaper.com/standards/ai-addendum/1.0) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-ai-addendum-in-app) |
| Business Associate Agreement | [Website](https://usejunior.com/templates/common-paper-business-associate-agreement) | [Common Paper](https://commonpaper.com/standards/business-associate-agreement/1.0) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-business-associate-agreement) |
| Data Processing Agreement | [Website](https://usejunior.com/templates/common-paper-data-processing-agreement) | [Common Paper](https://commonpaper.com/standards/data-processing-agreement/1.1) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-data-processing-agreement) |

### Professional Services

| Template | Website | Source | License | Repo |
|----------|---------|--------|---------|------|
| Bonterms Professional Services Agreement | [Website](https://usejunior.com/templates/bonterms-professional-services-agreement) | [Bonterms](https://github.com/Bonterms/Professional-Services-Agreement) | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/bonterms-professional-services-agreement) |
| Independent Contractor Agreement | [Website](https://usejunior.com/templates/common-paper-independent-contractor-agreement) | [Common Paper](https://commonpaper.com/standards/independent-contractor-agreement) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-independent-contractor-agreement) |
| Common Paper Professional Services Agreement | [Website](https://usejunior.com/templates/common-paper-professional-services-agreement) | [Common Paper](https://commonpaper.com/standards/professional-services-agreement/1.1) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-professional-services-agreement) |
| Statement Of Work | [Website](https://usejunior.com/templates/common-paper-statement-of-work) | [Common Paper](https://commonpaper.com/standards/statement-of-work) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-statement-of-work) |

### Deals & Partnerships

| Template | Website | Source | License | Repo |
|----------|---------|--------|---------|------|
| Amendment | [Website](https://usejunior.com/templates/common-paper-amendment) | [Common Paper](https://commonpaper.com/standards/amendment) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-amendment) |
| Design Partner Agreement | [Website](https://usejunior.com/templates/common-paper-design-partner-agreement) | [Common Paper](https://commonpaper.com/standards/design-partner-agreement/1.3) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-design-partner-agreement) |
| Letter Of Intent | [Website](https://usejunior.com/templates/common-paper-letter-of-intent) | [Common Paper](https://commonpaper.com/standards/letter-of-intent) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-letter-of-intent) |
| Partnership Agreement | [Website](https://usejunior.com/templates/common-paper-partnership-agreement) | [Common Paper](https://commonpaper.com/standards/partnership-agreement/1.1) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-partnership-agreement) |
| Pilot Agreement | [Website](https://usejunior.com/templates/common-paper-pilot-agreement) | [Common Paper](https://commonpaper.com/standards/pilot-agreement/1.1) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-pilot-agreement) |
| Term Sheet | [Website](https://usejunior.com/templates/common-paper-term-sheet) | [Common Paper](https://commonpaper.com/standards/term-sheet) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-term-sheet) |

### Employment

| Template | Website | Source | License | Repo |
|----------|---------|--------|---------|------|
| Employee IP Inventions Assignment | [Website](https://usejunior.com/templates/openagreements-employee-ip-inventions-assignment) | [OpenAgreements](https://github.com/open-agreements/open-agreements/tree/main/content/templates/openagreements-employee-ip-inventions-assignment) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/openagreements-employee-ip-inventions-assignment) |
| Employment Confidentiality Acknowledgement | [Website](https://usejunior.com/templates/openagreements-employment-confidentiality-acknowledgement) | [OpenAgreements](https://github.com/open-agreements/open-agreements/tree/main/content/templates/openagreements-employment-confidentiality-acknowledgement) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/openagreements-employment-confidentiality-acknowledgement) |
| Employment Offer Letter | [Website](https://usejunior.com/templates/openagreements-employment-offer-letter) | [OpenAgreements](https://github.com/open-agreements/open-agreements/tree/main/content/templates/openagreements-employment-offer-letter) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/openagreements-employment-offer-letter) |
| Restrictive Covenant Wyoming | [Website](https://usejunior.com/templates/openagreements-restrictive-covenant-wyoming) | [OpenAgreements](https://github.com/open-agreements/open-agreements/tree/main/content/templates/openagreements-restrictive-covenant-wyoming) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/openagreements-restrictive-covenant-wyoming) |

### SAFEs

| Template | Website | Source | License | Repo |
|----------|---------|--------|---------|------|
| Discount | [Website](https://usejunior.com/templates/yc-safe-discount) | [Y Combinator](https://www.ycombinator.com/documents) | [CC-BY-ND-4.0](https://creativecommons.org/licenses/by-nd/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/external/yc-safe-discount) |
| MFN | [Website](https://usejunior.com/templates/yc-safe-mfn) | [Y Combinator](https://www.ycombinator.com/documents) | [CC-BY-ND-4.0](https://creativecommons.org/licenses/by-nd/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/external/yc-safe-mfn) |
| Pro Rata Side Letter | [Website](https://usejunior.com/templates/yc-safe-pro-rata-side-letter) | [Y Combinator](https://www.ycombinator.com/documents) | [CC-BY-ND-4.0](https://creativecommons.org/licenses/by-nd/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/external/yc-safe-pro-rata-side-letter) |
| Valuation Cap | [Website](https://usejunior.com/templates/yc-safe-valuation-cap) | [Y Combinator](https://www.ycombinator.com/documents) | [CC-BY-ND-4.0](https://creativecommons.org/licenses/by-nd/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/external/yc-safe-valuation-cap) |

### Venture Financing

| Template | Website | Source | License | Repo |
|----------|---------|--------|---------|------|
| Certificate Of Incorporation | [Website](https://usejunior.com/templates/nvca-certificate-of-incorporation) | [NVCA](https://nvca.org/wp-content/uploads/2025/10/NVCA-Model-COI-10-1-2025.docx) | Recipe | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/recipes/nvca-certificate-of-incorporation) |
| Indemnification Agreement | [Website](https://usejunior.com/templates/nvca-indemnification-agreement) | [NVCA](https://nvca.org/wp-content/uploads/2021/12/NVCA-2020-Indemnification-Agreement.docx) | Recipe | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/recipes/nvca-indemnification-agreement) |
| Investors Rights Agreement | [Website](https://usejunior.com/templates/nvca-investors-rights-agreement) | [NVCA](https://nvca.org/wp-content/uploads/2025/10/NVCA-Model-IRA-10-1-2025-2-1.docx) | Recipe | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/recipes/nvca-investors-rights-agreement) |
| Management Rights Letter | [Website](https://usejunior.com/templates/nvca-management-rights-letter) | [NVCA](https://nvca.org/wp-content/uploads/2025/12/NVCA-2020-Management-Rights-Letter-1-1.docx) | Recipe | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/recipes/nvca-management-rights-letter) |
| ROFR Co Sale Agreement | [Website](https://usejunior.com/templates/nvca-rofr-co-sale-agreement) | [NVCA](https://nvca.org/wp-content/uploads/2025/10/NVCA-Model-ROFRA-10-1-2025.docx) | Recipe | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/recipes/nvca-rofr-co-sale-agreement) |
| Stock Purchase Agreement | [Website](https://usejunior.com/templates/nvca-stock-purchase-agreement) | [NVCA](https://nvca.org/wp-content/uploads/2025/10/NVCA-Model-SPA-10-28-2025-1.docx) | Recipe | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/recipes/nvca-stock-purchase-agreement) |
| Voting Agreement | [Website](https://usejunior.com/templates/nvca-voting-agreement) | [NVCA](https://nvca.org/wp-content/uploads/2024/10/NVCA-Model-VA-10-1-2025.docx) | Recipe | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/recipes/nvca-voting-agreement) |

### Other

| Template | Website | Source | License | Repo |
|----------|---------|--------|---------|------|
| Closing Checklist | [Website](https://usejunior.com/templates/closing-checklist) | [OpenAgreements](https://github.com/open-agreements/open-agreements) | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/closing-checklist) |
| Board Consent SAFE | [Website](https://usejunior.com/templates/openagreements-board-consent-safe) | [OpenAgreements](https://github.com/open-agreements/open-agreements/tree/main/content/templates/openagreements-board-consent-safe) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/openagreements-board-consent-safe) |
| Stockholder Consent SAFE | [Website](https://usejunior.com/templates/openagreements-stockholder-consent-safe) | [OpenAgreements](https://github.com/open-agreements/open-agreements/tree/main/content/templates/openagreements-stockholder-consent-safe) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/openagreements-stockholder-consent-safe) |
| Working Group List | [Website](https://usejunior.com/templates/working-group-list) | [OpenAgreements](https://github.com/open-agreements/open-agreements) | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/working-group-list) |

## Available Skills

### Agreement Drafting And Filling

| Skill | Description |
|-------|-------------|
| [open-agreements](https://github.com/open-agreements/open-agreements/tree/main/skills/open-agreements) | Fill standard legal agreement templates (NDAs, cloud service agreements, SAFEs) and produce signable DOCX files. Supports Common Paper, Bonterms, and Y Combinator templates. Use when the user needs to draft a legal agreement, create an NDA, fill a contract template, or generate a SAFE. Can also send agreements for electronic signature via DocuSign. |
| [nda](https://github.com/open-agreements/open-agreements/tree/main/skills/nda) | Draft and fill NDA templates — mutual NDA, one-way NDA, confidentiality agreement. Produces signable DOCX files from Common Paper and Bonterms standard forms. Use when user says "NDA," "non-disclosure agreement," "confidentiality agreement," "mutual NDA," or "one-way NDA." |
| [cloud-service-agreement](https://github.com/open-agreements/open-agreements/tree/main/skills/cloud-service-agreement) | Draft and fill SaaS agreement templates — cloud contract, MSA, order form, software license, pilot agreement, design partner agreement. Includes variants with SLAs and AI terms. Produces signable DOCX from Common Paper standard forms. Use when user says "SaaS agreement," "cloud contract," "MSA," "order form," "software license," "pilot agreement," or "design partner agreement." |
| [services-agreement](https://github.com/open-agreements/open-agreements/tree/main/skills/services-agreement) | Draft and fill services agreement templates — consulting contract, contractor agreement, SOW, statement of work, professional services agreement. Produces signable DOCX files from Common Paper and Bonterms standard forms. Use when user says "consulting contract," "contractor agreement," "SOW," "statement of work," "services agreement," or "freelancer contract." |
| [employment-contract](https://github.com/open-agreements/open-agreements/tree/main/skills/employment-contract) | Draft and fill employment agreement templates — offer letter, IP assignment, PIIA, confidentiality acknowledgement. Produces signable DOCX files from OpenAgreements standard forms for hiring employees. Use when user says "offer letter," "employment agreement," "PIIA," "IP assignment," "hire someone," or "onboarding paperwork." |
| [data-privacy-agreement](https://github.com/open-agreements/open-agreements/tree/main/skills/data-privacy-agreement) | Draft and fill data privacy agreement templates — DPA, data processing agreement, GDPR, HIPAA BAA, business associate agreement, AI addendum. Produces signable DOCX files from Common Paper standard forms. Use when user says "DPA," "data processing agreement," "HIPAA BAA," "business associate agreement," or "AI addendum." |
| [safe](https://github.com/open-agreements/open-agreements/tree/main/skills/safe) | Draft and fill Y Combinator SAFE templates — valuation cap, discount, MFN, pro rata side letter. Standard startup fundraising documents for convertible equity. Produces signable DOCX files. Use when user says "SAFE," "simple agreement for future equity," "YC SAFE," "valuation cap," "seed round documents," or "fundraising paperwork." |
| [venture-financing](https://github.com/open-agreements/open-agreements/tree/main/skills/venture-financing) | Draft and fill NVCA model documents — stock purchase agreement, certificate of incorporation, investors rights agreement, voting agreement, ROFR, co-sale, indemnification, management rights letter. Series A and venture financing templates. Produces signable DOCX files. Use when user says "Series A documents," "NVCA," "stock purchase agreement," "investors rights agreement," "voting agreement," or "venture financing docs." |

### Editing And Client Workflows

| Skill | Description |
|-------|-------------|
| [edit-docx-agreement](https://github.com/open-agreements/open-agreements/tree/main/skills/edit-docx-agreement) | Make bespoke edits to a DOCX agreement generated by OpenAgreements (or any existing DOCX), using Safe Docx MCP tools for surgical, formatting-preserving edits and tracked-changes outputs. Use when user says "edit this contract," "change a clause," "modify the agreement," "custom edits to the docx," or "bespoke changes to the document." |
| [client-email](https://github.com/open-agreements/open-agreements/tree/main/skills/client-email) | Draft client-facing emails for legal services — cover notes for contract deliverables, redline summaries, deal status updates, and follow-ups. Use when composing or revising outbound emails to clients about legal work product. Triggers on "draft reply," "email to client," "cover note," "write back to," or any outbound email accompanying a legal deliverable. |
| [delaware-franchise-tax](https://github.com/open-agreements/open-agreements/tree/main/skills/delaware-franchise-tax) | File your Delaware annual franchise tax and annual report. Guides you through tax calculation (Authorized Shares and Assumed Par Value Capital methods), the eCorp portal filing process, and payment. For Delaware C-Corps (March 1 deadline) and LLCs/LPs/GPs (June 1 deadline). Use when user says "Delaware franchise tax," "annual report Delaware," "file franchise tax," or "eCorp portal." |

### Compliance And Audit

| Skill | Description |
|-------|-------------|
| [soc2-readiness](https://github.com/open-agreements/open-agreements/tree/main/skills/soc2-readiness) | Assess SOC 2 Type II readiness. Map Trust Services Criteria to controls, identify gaps, and build a remediation plan. Uses NIST SP 800-53 (public domain) as canonical reference with SOC 2 criterion cross-mapping. Use when user says "SOC 2 readiness," "SOC 2 preparation," "SOC 2 gap analysis," or "prepare for SOC 2 audit." |
| [iso-27001-internal-audit](https://github.com/open-agreements/open-agreements/tree/main/skills/iso-27001-internal-audit) | Run an ISO 27001 internal audit. Walk through controls by domain, identify gaps, collect evidence, and generate findings with corrective action recommendations. Uses NIST SP 800-53 (public domain) as canonical reference. Use when user says "run internal audit," "ISO 27001 audit," "control assessment," "audit findings," or "ISMS assessment." |
| [iso-27001-evidence-collection](https://github.com/open-agreements/open-agreements/tree/main/skills/iso-27001-evidence-collection) | Collect, organize, and validate evidence for ISO 27001 and SOC 2 audits. API-first approach with CLI commands for major cloud platforms. Produces timestamped, auditor-ready evidence packages. Use when user says "collect audit evidence," "prepare evidence package," "evidence for the auditor," "refresh evidence," or "evidence gap analysis." |

### Developer Workflows

| Skill | Description |
|-------|-------------|
| [recipe-quality-audit](https://github.com/open-agreements/open-agreements/tree/main/skills/recipe-quality-audit) | Audit NVCA recipe quality: check file inventory, metadata schema, field-to-replacement coverage, ambiguous keys, smart quotes, test fixtures, and fill quality. Produces a structured scorecard per recipe with maturity tier classification. Use when user says "audit recipe quality," "check recipe coverage," "recipe scorecard," or "NVCA recipe quality." |
| [unit-test-philosophy](https://github.com/open-agreements/open-agreements/tree/main/skills/unit-test-philosophy) | Risk-based unit testing and Allure-readable behavioral spec style for open-agreements. Use when user says "add tests," "test quality," "coverage expansion," "unit test style," or "Allure test spec." Applies when adding/updating tests, expanding coverage, or reviewing test quality across src, integration-tests, and workspace packages. |

### Template Authoring

| Skill | Description |
|-------|-------------|
| [canonical-markdown-authoring](https://github.com/open-agreements/open-agreements/tree/main/skills/canonical-markdown-authoring) | Convert plain markdown contract drafts into OpenAgreements' canonical template.md authoring format — YAML frontmatter, Kind|Label|Value|Show When cover-term tables, oa:clause directives, [[Defined Term]] paragraphs, and oa:signer directives that compile to validated JSON specs and DOCX artifacts. Use when the user says "convert this to canonical markdown," "author a new OpenAgreements template," "migrate template to template.md," or "write a canonical-form contract." |

## Packages

| Package | Description |
|---------|-------------|
| [open-agreements](https://www.npmjs.com/package/open-agreements) | Open-source legal template filling CLI and library |
| [@open-agreements/contract-templates-mcp](https://github.com/open-agreements/open-agreements/blob/main/packages/contract-templates-mcp/README.md) | Local stdio MCP server for OpenAgreements template discovery and filling |
| [@open-agreements/contracts-workspace](https://github.com/open-agreements/open-agreements/blob/main/packages/contracts-workspace/README.md) | Workspace-oriented CLI for organizing and tracking contract repositories |
| [@open-agreements/contracts-workspace-mcp](https://github.com/open-agreements/open-agreements/blob/main/packages/contracts-workspace-mcp/README.md) | Local stdio MCP server for contracts workspace operations |
| [@open-agreements/checklist-mcp](https://github.com/open-agreements/open-agreements/blob/main/packages/checklist-mcp/README.md) | Local stdio MCP server for OpenAgreements checklist memory operations |

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
- **Hosted**: `https://openagreements.org/api/mcp`. Template filling runs server-side for faster setup.

Choose based on document sensitivity and internal policy. See the trust checklist below for the data-flow summary.

</details>

---

## Documentation

### Start Here

- [Getting Started](https://github.com/open-agreements/open-agreements/blob/main/docs/getting-started.md)

### Guides

- [Adding Templates](https://github.com/open-agreements/open-agreements/blob/main/docs/adding-templates.md)
- [Adding Recipes](https://github.com/open-agreements/open-agreements/blob/main/docs/adding-recipes.md)

### Other Packages

- [Contracts Workspace CLI](https://github.com/open-agreements/open-agreements/blob/main/docs/contracts-workspace.md)

### Reference

- [Licensing](https://github.com/open-agreements/open-agreements/blob/main/docs/licensing.md)
- [Changelog & Release Process](https://github.com/open-agreements/open-agreements/blob/main/docs/changelog-release-process.md)
- [Trust Checklist](https://github.com/open-agreements/open-agreements/blob/main/docs/trust-checklist.md)
- [Supported Tools](https://github.com/open-agreements/open-agreements/blob/main/docs/supported-tools.md)
- [Assumptions](https://github.com/open-agreements/open-agreements/blob/main/docs/assumptions.md)
- [Employment Source Policy](https://github.com/open-agreements/open-agreements/blob/main/docs/employment-source-policy.md)

**Links:** [Website](https://usejunior.com) | [Template Catalog](https://usejunior.com/templates) | [Docs](https://github.com/open-agreements/open-agreements/tree/main/docs) | [Trust](https://usejunior.com/security) | [npm](https://www.npmjs.com/package/open-agreements)

## Privacy

- **Local mode** (`npx`, global install, stdio MCP): all processing happens on your machine. No document content is sent externally.
- **Hosted mode** (`https://openagreements.org/api/mcp`): template filling runs server-side. No filled documents are stored after the response is returned.

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
