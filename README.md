<!-- This file is generated from README.template.md by scripts/generate_readme.mjs. Do not edit README.md directly. -->

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

- [Legal Practice Library](#legal-practice-library)
- [Templates](#available-templates)
- [Checklists](#checklists)
- [Law Surveys](#law-surveys)
- [For AI Agents](#for-ai-agents)
- [Available Skills](#available-skills)
- [Template Filling via MCP](#template-filling-via-mcp)
- [Packages](#packages)
- [Install](#install)
- [Documentation](#documentation)
- [Privacy](#privacy)
- [See Also](#see-also)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [Built With OpenAgreements](#built-with-openagreements)
- [License](#license)

## Legal Practice Library

Primary-source-backed legal practice guides, projected from openagreements.org as plain markdown under [`legal-practice-library/`](https://github.com/open-agreements/open-agreements/tree/main/legal-practice-library). Each guide cites primary law and links to its canonical page (with machine-readable twins — see [For AI Agents](#for-ai-agents)).

| Topic | What it covers | Coverage | Markdown | HTML |
|-------|----------------|----------|----------|------|
| Non-Compete & Restrictive Covenants | Enforceability, blue-pencil reformation, tolling, choice of law, and FTC-rule status. | 56 U.S. states + international | [Markdown](https://github.com/open-agreements/open-agreements/tree/main/legal-practice-library/non-compete) | [HTML](https://openagreements.org/practice-guides/non-compete) |
| Consumer Data Privacy | CCPA/CPRA and every comprehensive state privacy act — who's covered, consumer rights, opt-outs, and who enforces. | 51 U.S. states | [Markdown](https://github.com/open-agreements/open-agreements/tree/main/legal-practice-library/privacy) | [HTML](https://openagreements.org/practice-guides/privacy/us) |
| AI Vendors | Zero-data-retention, data residency, and the terms that matter in AI vendor contracts. | 9 practice guides | [Markdown](https://github.com/open-agreements/open-agreements/tree/main/legal-practice-library/ai-vendors) | [HTML](https://openagreements.org/practice-guides/ai-vendors) |
| AI & the Workforce | AI in hiring and adverse-action, workforce AI policies, and outside-counsel transitions. | 20 practice guides | [Markdown](https://github.com/open-agreements/open-agreements/tree/main/legal-practice-library) | [HTML](https://openagreements.org/practice-guides) |
| Privacy-Policy Requirement Phrasings | Preferred phrasings for what a U.S. consumer privacy policy must disclose. | 8 practice guides | [Markdown](https://github.com/open-agreements/open-agreements/tree/main/legal-practice-library/privacy-policy) | [HTML](https://openagreements.org/practice-guides/privacy/us) |

Backed by 519 verbatim [case excerpts](https://github.com/open-agreements/open-agreements/tree/main/legal-practice-library/case-excerpts) — the passages our practice guides rely on, each linked to the full opinion on CourtListener. Supporting evidence, not a case database.

## Available Templates

Fill standard legal agreement templates and get signable DOCX files — party
info, dates, and terms in, formatting-preserving Word document out. The Source
column links to the upstream standard or canonical project page (varies by
publisher); the License column shows redistribution terms; Repo links point to
the GitHub content directory for each template or field-selector. To fill one with an
agent or the CLI, see [Template Filling via MCP](#template-filling-via-mcp).

### SAFEs

| Template | HTML | Source | License | Repo |
|----------|------|--------|---------|------|
| Valuation Cap | [HTML](https://usejunior.com/templates/yc-safe-valuation-cap?utm_source=github&utm_medium=readme&utm_campaign=open-agreements) | [Y Combinator](https://www.ycombinator.com/documents) | [Creative Commons, no derivatives (CC-BY-ND)](https://creativecommons.org/licenses/by-nd/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/templates/yc-cc-by-nd-4.0/yc-safe-valuation-cap) |
| Pro Rata Side Letter | [HTML](https://usejunior.com/templates/yc-safe-pro-rata-side-letter?utm_source=github&utm_medium=readme&utm_campaign=open-agreements) | [Y Combinator](https://www.ycombinator.com/documents) | [Creative Commons, no derivatives (CC-BY-ND)](https://creativecommons.org/licenses/by-nd/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/templates/yc-cc-by-nd-4.0/yc-safe-pro-rata-side-letter) |
| MFN | [HTML](https://usejunior.com/templates/yc-safe-mfn?utm_source=github&utm_medium=readme&utm_campaign=open-agreements) | [Y Combinator](https://www.ycombinator.com/documents) | [Creative Commons, no derivatives (CC-BY-ND)](https://creativecommons.org/licenses/by-nd/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/templates/yc-cc-by-nd-4.0/yc-safe-mfn) |
| Discount | [HTML](https://usejunior.com/templates/yc-safe-discount?utm_source=github&utm_medium=readme&utm_campaign=open-agreements) | [Y Combinator](https://www.ycombinator.com/documents) | [Creative Commons, no derivatives (CC-BY-ND)](https://creativecommons.org/licenses/by-nd/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/templates/yc-cc-by-nd-4.0/yc-safe-discount) |

### Venture Financing

| Template | HTML | Source | License | Repo |
|----------|------|--------|---------|------|
| ROFR Co Sale Agreement | [HTML](https://usejunior.com/templates/nvca-rofr-co-sale-agreement?utm_source=github&utm_medium=readme&utm_campaign=open-agreements) | [NVCA](https://nvca.org/wp-content/uploads/2025/10/NVCA-Model-ROFRA-10-1-2025.docx) | Field-selector | — |
| Investors Rights Agreement | [HTML](https://usejunior.com/templates/nvca-investors-rights-agreement?utm_source=github&utm_medium=readme&utm_campaign=open-agreements) | [NVCA](https://nvca.org/wp-content/uploads/2025/10/NVCA-Model-IRA-10-1-2025-2-1.docx) | Field-selector | — |
| Voting Agreement | [HTML](https://usejunior.com/templates/nvca-voting-agreement?utm_source=github&utm_medium=readme&utm_campaign=open-agreements) | [NVCA](https://nvca.org/wp-content/uploads/2024/10/NVCA-Model-VA-10-1-2025.docx) | Field-selector | — |
| Stock Purchase Agreement | [HTML](https://usejunior.com/templates/nvca-stock-purchase-agreement?utm_source=github&utm_medium=readme&utm_campaign=open-agreements) | [NVCA](https://nvca.org/wp-content/uploads/2025/10/NVCA-Model-SPA-10-28-2025-1.docx) | Field-selector | — |
| Certificate Of Incorporation | [HTML](https://usejunior.com/templates/nvca-certificate-of-incorporation?utm_source=github&utm_medium=readme&utm_campaign=open-agreements) | [NVCA](https://nvca.org/wp-content/uploads/2025/10/NVCA-Model-COI-10-1-2025.docx) | Field-selector | — |
| Indemnification Agreement | [HTML](https://usejunior.com/templates/nvca-indemnification-agreement?utm_source=github&utm_medium=readme&utm_campaign=open-agreements) | [NVCA](https://nvca.org/wp-content/uploads/2021/12/NVCA-2020-Indemnification-Agreement.docx) | Field-selector | — |
| Management Rights Letter | [HTML](https://usejunior.com/templates/nvca-management-rights-letter?utm_source=github&utm_medium=readme&utm_campaign=open-agreements) | [NVCA](https://nvca.org/wp-content/uploads/2025/12/NVCA-2020-Management-Rights-Letter-1-1.docx) | Field-selector | — |

### Deals & Partnerships

| Template | HTML | Source | License | Repo |
|----------|------|--------|---------|------|
| Design Partner Agreement | [HTML](https://usejunior.com/templates/common-paper-design-partner-agreement?utm_source=github&utm_medium=readme&utm_campaign=open-agreements) | [Common Paper](https://commonpaper.com/standards/design-partner-agreement/1.3) | [Creative Commons (CC-BY)](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/templates/common-paper-cc-by-4.0/common-paper-design-partner-agreement) |
| Term Sheet | [HTML](https://usejunior.com/templates/common-paper-term-sheet?utm_source=github&utm_medium=readme&utm_campaign=open-agreements) | [Common Paper](https://commonpaper.com/standards/term-sheet) | [Creative Commons (CC-BY)](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/templates/common-paper-cc-by-4.0/common-paper-term-sheet) |
| Partnership Agreement | [HTML](https://usejunior.com/templates/common-paper-partnership-agreement?utm_source=github&utm_medium=readme&utm_campaign=open-agreements) | [Common Paper](https://commonpaper.com/standards/partnership-agreement/1.1) | [Creative Commons (CC-BY)](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/templates/common-paper-cc-by-4.0/common-paper-partnership-agreement) |
| Pilot Agreement | [HTML](https://usejunior.com/templates/common-paper-pilot-agreement?utm_source=github&utm_medium=readme&utm_campaign=open-agreements) | [Common Paper](https://commonpaper.com/standards/pilot-agreement/1.1) | [Creative Commons (CC-BY)](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/templates/common-paper-cc-by-4.0/common-paper-pilot-agreement) |
| Amendment | [HTML](https://usejunior.com/templates/common-paper-amendment?utm_source=github&utm_medium=readme&utm_campaign=open-agreements) | [Common Paper](https://commonpaper.com/standards/amendment) | [Creative Commons (CC-BY)](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/templates/common-paper-cc-by-4.0/common-paper-amendment) |
| Letter Of Intent | [HTML](https://usejunior.com/templates/common-paper-letter-of-intent?utm_source=github&utm_medium=readme&utm_campaign=open-agreements) | [Common Paper](https://commonpaper.com/standards/letter-of-intent) | [Creative Commons (CC-BY)](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/templates/common-paper-cc-by-4.0/common-paper-letter-of-intent) |

### Sales & Licensing

| Template | HTML | Source | License | Repo |
|----------|------|--------|---------|------|
| CSA Click Through | [HTML](https://usejunior.com/templates/common-paper-csa-click-through?utm_source=github&utm_medium=readme&utm_campaign=open-agreements) | [Common Paper](https://commonpaper.com/standards/cloud-service-agreement/2.1) | [Creative Commons (CC-BY)](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/templates/common-paper-cc-by-4.0/common-paper-csa-click-through) |
| CSA Without SLA | [HTML](https://usejunior.com/templates/common-paper-csa-without-sla?utm_source=github&utm_medium=readme&utm_campaign=open-agreements) | [Common Paper](https://commonpaper.com/standards/cloud-service-agreement/2.1) | [Creative Commons (CC-BY)](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/templates/common-paper-cc-by-4.0/common-paper-csa-without-sla) |
| CSA With SLA | [HTML](https://usejunior.com/templates/common-paper-csa-with-sla?utm_source=github&utm_medium=readme&utm_campaign=open-agreements) | [Common Paper](https://commonpaper.com/standards/cloud-service-agreement/2.1) | [Creative Commons (CC-BY)](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/templates/common-paper-cc-by-4.0/common-paper-csa-with-sla) |
| Order Form | [HTML](https://usejunior.com/templates/common-paper-order-form?utm_source=github&utm_medium=readme&utm_campaign=open-agreements) | [Common Paper](https://commonpaper.com/standards/cloud-service-agreement/2.1) | [Creative Commons (CC-BY)](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/templates/common-paper-cc-by-4.0/common-paper-order-form) |
| Cloud Service Agreement | [HTML](https://usejunior.com/templates/common-paper-cloud-service-agreement?utm_source=github&utm_medium=readme&utm_campaign=open-agreements) | [Common Paper](https://commonpaper.com/standards/cloud-service-agreement/2.1) | [Creative Commons (CC-BY)](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/templates/common-paper-cc-by-4.0/common-paper-cloud-service-agreement) |
| Software License Agreement | [HTML](https://usejunior.com/templates/common-paper-software-license-agreement?utm_source=github&utm_medium=readme&utm_campaign=open-agreements) | [Common Paper](https://commonpaper.com/standards/software-license-agreement/1.1) | [Creative Commons (CC-BY)](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/templates/common-paper-cc-by-4.0/common-paper-software-license-agreement) |
| Order Form With SLA | [HTML](https://usejunior.com/templates/common-paper-order-form-with-sla?utm_source=github&utm_medium=readme&utm_campaign=open-agreements) | [Common Paper](https://commonpaper.com/standards/cloud-service-agreement/2.1) | [Creative Commons (CC-BY)](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/templates/common-paper-cc-by-4.0/common-paper-order-form-with-sla) |
| CSA With AI | [HTML](https://usejunior.com/templates/common-paper-csa-with-ai?utm_source=github&utm_medium=readme&utm_campaign=open-agreements) | [Common Paper](https://commonpaper.com/standards/cloud-service-agreement/2.1) | [Creative Commons (CC-BY)](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/templates/common-paper-cc-by-4.0/common-paper-csa-with-ai) |

### Confidentiality

| Template | HTML | Source | License | Repo |
|----------|------|--------|---------|------|
| Common Paper Mutual NDA | [HTML](https://usejunior.com/templates/common-paper-mutual-nda?utm_source=github&utm_medium=readme&utm_campaign=open-agreements) | [Common Paper](https://commonpaper.com/standards/mutual-nda/1.0) | [Creative Commons (CC-BY)](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/templates/common-paper-cc-by-4.0/common-paper-mutual-nda) |
| Bonterms Mutual NDA | [HTML](https://usejunior.com/templates/bonterms-mutual-nda?utm_source=github&utm_medium=readme&utm_campaign=open-agreements) | [Bonterms](https://bonterms.com/resources/mutual-nda-cover-page-example) | [Public domain (CC0)](https://creativecommons.org/publicdomain/zero/1.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/templates/bonterms-cc0-1.0/bonterms-mutual-nda) |
| One Way NDA | [HTML](https://usejunior.com/templates/common-paper-one-way-nda?utm_source=github&utm_medium=readme&utm_campaign=open-agreements) | [Common Paper](https://commonpaper.com/standards/one-way-nda) | [Creative Commons (CC-BY)](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/templates/common-paper-cc-by-4.0/common-paper-one-way-nda) |

### Board & Stockholder Consents

| Template | HTML | Source | License | Repo |
|----------|------|--------|---------|------|
| Stockholder Consent SAFE | [HTML](https://usejunior.com/templates/openagreements-stockholder-consent-safe?utm_source=github&utm_medium=readme&utm_campaign=open-agreements) | [OpenAgreements](https://github.com/open-agreements/open-agreements/tree/main/templates/openagreements-stockholder-consent-safe) | [Creative Commons (CC-BY)](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/templates/openagreements-cc-by-4.0/openagreements-stockholder-consent-safe) |
| Board Consent SAFE | [HTML](https://usejunior.com/templates/openagreements-board-consent-safe?utm_source=github&utm_medium=readme&utm_campaign=open-agreements) | [OpenAgreements](https://github.com/open-agreements/open-agreements/tree/main/templates/openagreements-board-consent-safe) | [Creative Commons (CC-BY)](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/templates/openagreements-cc-by-4.0/openagreements-board-consent-safe) |

### Employment

| Template | HTML | Source | License | Repo |
|----------|------|--------|---------|------|
| Employment Offer Letter | [HTML](https://usejunior.com/templates/openagreements-employment-offer-letter?utm_source=github&utm_medium=readme&utm_campaign=open-agreements) | [OpenAgreements](https://github.com/open-agreements/open-agreements/tree/main/templates/openagreements-employment-offer-letter) | [Creative Commons (CC-BY)](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/templates/openagreements-cc-by-4.0/openagreements-employment-offer-letter) |
| Restrictive Covenant Wyoming | [HTML](https://usejunior.com/templates/openagreements-restrictive-covenant-wyoming?utm_source=github&utm_medium=readme&utm_campaign=open-agreements) | [OpenAgreements](https://github.com/open-agreements/open-agreements/tree/main/templates/openagreements-restrictive-covenant-wyoming) | [Creative Commons (CC-BY)](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/templates/openagreements-cc-by-4.0/openagreements-restrictive-covenant-wyoming) |
| Restrictive Covenant Florida | [HTML](https://usejunior.com/templates/openagreements-restrictive-covenant-florida?utm_source=github&utm_medium=readme&utm_campaign=open-agreements) | [OpenAgreements](https://github.com/open-agreements/open-agreements/tree/main/templates/openagreements-restrictive-covenant-florida) | [Creative Commons (CC-BY)](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/templates/openagreements-cc-by-4.0/openagreements-restrictive-covenant-florida) |
| Restrictive Covenant Massachusetts | [HTML](https://usejunior.com/templates/openagreements-restrictive-covenant-massachusetts?utm_source=github&utm_medium=readme&utm_campaign=open-agreements) | [OpenAgreements](https://github.com/open-agreements/open-agreements/tree/main/templates/openagreements-restrictive-covenant-massachusetts) | [Creative Commons (CC-BY)](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/templates/openagreements-cc-by-4.0/openagreements-restrictive-covenant-massachusetts) |
| Restrictive Covenant California | [HTML](https://usejunior.com/templates/openagreements-restrictive-covenant-california?utm_source=github&utm_medium=readme&utm_campaign=open-agreements) | [OpenAgreements](https://github.com/open-agreements/open-agreements/tree/main/templates/openagreements-restrictive-covenant-california) | [Creative Commons (CC-BY)](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/templates/openagreements-cc-by-4.0/openagreements-restrictive-covenant-california) |
| Restrictive Covenant Illinois | [HTML](https://usejunior.com/templates/openagreements-restrictive-covenant-illinois?utm_source=github&utm_medium=readme&utm_campaign=open-agreements) | [OpenAgreements](https://github.com/open-agreements/open-agreements/tree/main/templates/openagreements-restrictive-covenant-illinois) | [Creative Commons (CC-BY)](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/templates/openagreements-cc-by-4.0/openagreements-restrictive-covenant-illinois) |
| Restrictive Covenant Texas | [HTML](https://usejunior.com/templates/openagreements-restrictive-covenant-texas?utm_source=github&utm_medium=readme&utm_campaign=open-agreements) | [OpenAgreements](https://github.com/open-agreements/open-agreements/tree/main/templates/openagreements-restrictive-covenant-texas) | [Creative Commons (CC-BY)](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/templates/openagreements-cc-by-4.0/openagreements-restrictive-covenant-texas) |

### Professional Services

| Template | HTML | Source | License | Repo |
|----------|------|--------|---------|------|
| Independent Contractor Agreement | [HTML](https://usejunior.com/templates/common-paper-independent-contractor-agreement?utm_source=github&utm_medium=readme&utm_campaign=open-agreements) | [Common Paper](https://commonpaper.com/standards/independent-contractor-agreement) | [Creative Commons (CC-BY)](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/templates/common-paper-cc-by-4.0/common-paper-independent-contractor-agreement) |
| Common Paper Professional Services Agreement | [HTML](https://usejunior.com/templates/common-paper-professional-services-agreement?utm_source=github&utm_medium=readme&utm_campaign=open-agreements) | [Common Paper](https://commonpaper.com/standards/professional-services-agreement/1.1) | [Creative Commons (CC-BY)](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/templates/common-paper-cc-by-4.0/common-paper-professional-services-agreement) |
| Bonterms Professional Services Agreement | [HTML](https://usejunior.com/templates/bonterms-professional-services-agreement?utm_source=github&utm_medium=readme&utm_campaign=open-agreements) | [Bonterms](https://bonterms.com/resources/psa-cover-page-example) | [Public domain (CC0)](https://creativecommons.org/publicdomain/zero/1.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/templates/bonterms-cc0-1.0/bonterms-professional-services-agreement) |
| Statement Of Work | [HTML](https://usejunior.com/templates/common-paper-statement-of-work?utm_source=github&utm_medium=readme&utm_campaign=open-agreements) | [Common Paper](https://commonpaper.com/standards/statement-of-work) | [Creative Commons (CC-BY)](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/templates/common-paper-cc-by-4.0/common-paper-statement-of-work) |

### Data & Compliance

| Template | HTML | Source | License | Repo |
|----------|------|--------|---------|------|
| Data Processing Agreement | [HTML](https://usejunior.com/templates/common-paper-data-processing-agreement?utm_source=github&utm_medium=readme&utm_campaign=open-agreements) | [Common Paper](https://commonpaper.com/standards/data-processing-agreement/1.1) | [Creative Commons (CC-BY)](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/templates/common-paper-cc-by-4.0/common-paper-data-processing-agreement) |
| AI Addendum | [HTML](https://usejunior.com/templates/common-paper-ai-addendum?utm_source=github&utm_medium=readme&utm_campaign=open-agreements) | [Common Paper](https://commonpaper.com/standards/ai-addendum/1.0) | [Creative Commons (CC-BY)](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/templates/common-paper-cc-by-4.0/common-paper-ai-addendum) |
| AI Addendum In App | [HTML](https://usejunior.com/templates/common-paper-ai-addendum-in-app?utm_source=github&utm_medium=readme&utm_campaign=open-agreements) | [Common Paper](https://commonpaper.com/standards/ai-addendum/1.0) | [Creative Commons (CC-BY)](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/templates/common-paper-cc-by-4.0/common-paper-ai-addendum-in-app) |
| Business Associate Agreement | [HTML](https://usejunior.com/templates/common-paper-business-associate-agreement?utm_source=github&utm_medium=readme&utm_campaign=open-agreements) | [Common Paper](https://commonpaper.com/standards/business-associate-agreement/1.0) | [Creative Commons (CC-BY)](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/templates/common-paper-cc-by-4.0/common-paper-business-associate-agreement) |

### Deal Process

| Template | HTML | Source | License | Repo |
|----------|------|--------|---------|------|
| Working Group List | [HTML](https://usejunior.com/templates/openagreements-working-group-list?utm_source=github&utm_medium=readme&utm_campaign=open-agreements) | [OpenAgreements](https://github.com/open-agreements/open-agreements/tree/main/templates/openagreements-working-group-list) | [Public domain (CC0)](https://creativecommons.org/publicdomain/zero/1.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/templates/openagreements-cc0-1.0/openagreements-working-group-list) |
| Due Diligence Request List | [HTML](https://usejunior.com/templates/openagreements-due-diligence-request-list?utm_source=github&utm_medium=readme&utm_campaign=open-agreements) | [OpenAgreements](https://github.com/open-agreements/open-agreements/tree/main/templates/openagreements-due-diligence-request-list) | [Creative Commons (CC-BY)](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/templates/openagreements-cc-by-4.0/openagreements-due-diligence-request-list) |
| Closing Checklist | [HTML](https://usejunior.com/templates/openagreements-closing-checklist?utm_source=github&utm_medium=readme&utm_campaign=open-agreements) | [OpenAgreements](https://github.com/open-agreements/open-agreements/tree/main/templates/openagreements-closing-checklist) | [Public domain (CC0)](https://creativecommons.org/publicdomain/zero/1.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/templates/openagreements-cc0-1.0/openagreements-closing-checklist) |

### Other

| Template | HTML | Source | License | Repo |
|----------|------|--------|---------|------|
| Confidentiality Invention Assignment Agreement | [HTML](https://usejunior.com/templates/openagreements-confidentiality-invention-assignment-agreement?utm_source=github&utm_medium=readme&utm_campaign=open-agreements) | [OpenAgreements](https://github.com/open-agreements/open-agreements/tree/main/templates/openagreements-confidentiality-invention-assignment-agreement) | [Creative Commons (CC-BY)](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/templates/openagreements-cc-by-4.0/openagreements-confidentiality-invention-assignment-agreement) |

## Checklists

Clause-by-clause reviewer checklists. Each has `.json` and `.docx` twins on the web, and contract checklists also emit a `contract-api.json` for template integrations.

| Topic | What it covers | Markdown | HTML |
|-------|----------------|----------|------|
| Non-Compete review | Clause-by-clause reviewer checklists — a baseline plus 50-state overlays. | [Markdown](https://github.com/open-agreements/open-agreements/tree/main/legal-practice-library/checklists/non-compete) | [HTML](https://openagreements.org/checklists/non-compete/us) |
| Privacy-Policy review | What a compliant U.S. consumer privacy policy must contain. | [Markdown](https://github.com/open-agreements/open-agreements/tree/main/legal-practice-library/checklists/privacy-policy) | [HTML](https://openagreements.org/checklists/privacy-policy/us) |
| Venture Financing review | NVCA model-document review (e.g. the Stock Purchase Agreement). | [Markdown](https://github.com/open-agreements/open-agreements/tree/main/legal-practice-library/checklists/venture-financing) | [HTML](https://openagreements.org/checklists/venture-financing/nvca-stock-purchase-agreement) |

## Law Surveys

Side-by-side comparison tables across jurisdictions. The web pages also publish machine-readable `.json` and `.csv` twins (append `.json` / `.csv`, e.g. `/surveys/non-compete/us.csv`).

| Survey | Markdown | HTML |
|--------|----------|------|
| U.S. 50-State Non-Compete Survey | [Markdown](https://github.com/open-agreements/open-agreements/blob/main/legal-practice-library/surveys/non-compete/us.md) | [HTML](https://openagreements.org/surveys/non-compete/us) |
| U.S. invention-assignment survey | [Markdown](https://github.com/open-agreements/open-agreements/blob/main/legal-practice-library/surveys/invention-assignment/us.md) | [HTML](https://openagreements.org/surveys/invention-assignment/us) |
| U.S. State Consumer Privacy Survey | [Markdown](https://github.com/open-agreements/open-agreements/blob/main/legal-practice-library/surveys/privacy/us.md) | [HTML](https://openagreements.org/surveys/privacy/us) |
| Worldwide Non-Compete Survey | [Markdown](https://github.com/open-agreements/open-agreements/blob/main/legal-practice-library/surveys/non-compete/worldwide.md) | [HTML](https://openagreements.org/surveys/non-compete/worldwide) |

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

Install any skill by name (paths below are for browsing only — installs are name-based and survive reorganization):

```bash
npx skills add open-agreements/open-agreements --skill <skill-name>
```

### Legal Explainers

| Skill | Description |
|-------|-------------|
| [non-compete-contract-explainer](https://github.com/open-agreements/open-agreements/tree/main/skills/legal-explainers/non-compete-contract-explainer) | Explain U.S. state-by-state (and select international) non-compete and restrictive-covenant law — whether a non-compete is enforceable, blue-pencil reformation, tolling, choice of law, independent-contractor reach, and recent bans. Reads a bundled, source-cited snapshot per jurisdiction. Use when the user says "non-compete," "noncompete contract," "restrictive covenant," "non-solicit," "garden leave," "covenant not to compete," "employment agreement," asks "is my non-compete enforceable," or names a U.S. state. |
| [data-privacy-law-explainer](https://github.com/open-agreements/open-agreements/tree/main/skills/legal-explainers/data-privacy-law-explainer) | Explain U.S. state-by-state consumer data-privacy law (CCPA/CPRA, TDPSA, VCDPA, CPA, and the other comprehensive state acts) — who a law covers, applicability thresholds, privacy-policy requirements, consumer rights and opt-outs, private rights of action, and who enforces. Reads a bundled, source-cited snapshot per state. Use when the user says "CCPA," "CPRA," "state privacy law," "privacy policy," "data subject request," "consumer rights request," "opt-out of sale," "data broker," "sensitive data," asks "do I need to comply with <state>'s privacy law," or names a U.S. state together with privacy. |

### Agreement Drafting And Filling

| Skill | Description |
|-------|-------------|
| [open-agreements](https://github.com/open-agreements/open-agreements/tree/main/skills/agreements/open-agreements) | Navigate and use the OpenAgreements legal content library — source-cited practice guides, review checklists, 50-state law surveys, and fill-ready agreement templates. Look up state-by-state legal guides, checklists, and law surveys, or fill standard templates (NDAs, cloud service agreements, SAFEs) into signable DOCX files. Supports Common Paper, Bonterms, and Y Combinator templates. Use when the user needs a practice guide, a review checklist, a law survey, to draft a legal agreement, create an NDA, fill a contract template, or generate a SAFE. |
| [nda](https://github.com/open-agreements/open-agreements/tree/main/skills/agreements/nda) | Draft and fill NDA templates — mutual NDA, one-way NDA, confidentiality agreement. Produces signable DOCX files from Common Paper and Bonterms standard forms. Use when user says "NDA," "non-disclosure agreement," "confidentiality agreement," "mutual NDA," or "one-way NDA." |
| [cloud-service-agreement](https://github.com/open-agreements/open-agreements/tree/main/skills/agreements/cloud-service-agreement) | Draft and fill SaaS agreement templates — cloud contract, MSA, order form, software license, pilot agreement, design partner agreement. Includes variants with SLAs and AI terms. Produces signable DOCX from Common Paper standard forms. Use when user says "SaaS agreement," "cloud contract," "MSA," "order form," "software license," "pilot agreement," or "design partner agreement." |
| [services-agreement](https://github.com/open-agreements/open-agreements/tree/main/skills/agreements/services-agreement) | Draft and fill services agreement templates — consulting contract, contractor agreement, SOW, statement of work, professional services agreement. Produces signable DOCX files from Common Paper and Bonterms standard forms. Use when user says "consulting contract," "contractor agreement," "SOW," "statement of work," "services agreement," or "freelancer contract." |
| [employment-contract](https://github.com/open-agreements/open-agreements/tree/main/skills/agreements/employment-contract) | Draft and fill employment contract templates — offer letter, employment agreement, IP/inventions assignment (PIIA), and confidentiality acknowledgement — producing signable DOCX files from OpenAgreements standard forms for hiring employees. Use when the user says "employment contract," "employment agreement," "offer letter," "PIIA," "IP assignment," "hire someone," "new hire paperwork," or "onboarding paperwork." To explain non-compete or restrictive-covenant law rather than draft a document, see the non-compete-contract-explainer skill. |
| [data-privacy-agreement](https://github.com/open-agreements/open-agreements/tree/main/skills/agreements/data-privacy-agreement) | Draft and fill data privacy agreement templates — DPA, data processing agreement, GDPR, HIPAA BAA, business associate agreement, AI addendum. Produces signable DOCX files from Common Paper standard forms. Use when user says "DPA," "data processing agreement," "HIPAA BAA," "business associate agreement," or "AI addendum." To understand a U.S. state's consumer privacy law (CCPA etc.) rather than draft, see data-privacy-law-explainer. |
| [safe](https://github.com/open-agreements/open-agreements/tree/main/skills/agreements/safe) | Draft and fill Y Combinator SAFE templates — valuation cap, discount, MFN, pro rata side letter. Standard startup fundraising documents for convertible equity. Produces signable DOCX files. Use when user says "SAFE," "simple agreement for future equity," "YC SAFE," "valuation cap," "seed round documents," or "fundraising paperwork." |
| [venture-financing](https://github.com/open-agreements/open-agreements/tree/main/skills/agreements/venture-financing) | Draft and fill NVCA model documents — stock purchase agreement, certificate of incorporation, investors rights agreement, voting agreement, ROFR, co-sale, indemnification, management rights letter. Series A and venture financing templates. Produces signable DOCX files. Use when user says "Series A documents," "NVCA," "stock purchase agreement," "investors rights agreement," "voting agreement," or "venture financing docs." |

### Editing And Client Workflows

| Skill | Description |
|-------|-------------|
| [edit-docx-agreement](https://github.com/open-agreements/open-agreements/tree/main/skills/client-workflows/edit-docx-agreement) | Make bespoke edits to a DOCX agreement generated by OpenAgreements (or any existing DOCX), using Safe Docx MCP tools for surgical, formatting-preserving edits and tracked-changes outputs. Use when user says "edit this contract," "change a clause," "modify the agreement," "custom edits to the docx," or "bespoke changes to the document." |
| [client-email](https://github.com/open-agreements/open-agreements/tree/main/skills/client-workflows/client-email) | Draft client-facing emails for legal services — cover notes for contract deliverables, redline summaries, deal status updates, and follow-ups. Use when composing or revising outbound emails to clients about legal work product. Triggers on "draft reply," "email to client," "cover note," "write back to," or any outbound email accompanying a legal deliverable. |
| [delaware-franchise-tax](https://github.com/open-agreements/open-agreements/tree/main/skills/client-workflows/delaware-franchise-tax) | File your Delaware annual franchise tax and annual report. Guides you through tax calculation (Authorized Shares and Assumed Par Value Capital methods), the eCorp portal filing process, and payment. For Delaware C-Corps (March 1 deadline) and LLCs/LPs/GPs (June 1 deadline). Use when user says "Delaware franchise tax," "annual report Delaware," "file franchise tax," or "eCorp portal." |

### Compliance And Audit

| Skill | Description |
|-------|-------------|
| [soc2-readiness](https://github.com/open-agreements/open-agreements/tree/main/skills/compliance/soc2-readiness) | Assess SOC 2 Type II readiness. Map Trust Services Criteria to controls, identify gaps, and build a remediation plan. Uses NIST SP 800-53 (public domain) as canonical reference with SOC 2 criterion cross-mapping. Use when user says "SOC 2 readiness," "SOC 2 preparation," "SOC 2 gap analysis," or "prepare for SOC 2 audit." |
| [iso-27001-internal-audit](https://github.com/open-agreements/open-agreements/tree/main/skills/compliance/iso-27001-internal-audit) | Run an ISO 27001 internal audit. Walk through controls by domain, identify gaps, collect evidence, and generate findings with corrective action recommendations. Uses NIST SP 800-53 (public domain) as canonical reference. Use when user says "run internal audit," "ISO 27001 audit," "control assessment," "audit findings," or "ISMS assessment." |
| [iso-27001-evidence-collection](https://github.com/open-agreements/open-agreements/tree/main/skills/compliance/iso-27001-evidence-collection) | Collect, organize, and validate evidence for ISO 27001 and SOC 2 audits. API-first approach with CLI commands for major cloud platforms. Produces timestamped, auditor-ready evidence packages. Use when user says "collect audit evidence," "prepare evidence package," "evidence for the auditor," "refresh evidence," or "evidence gap analysis." |

Internal repo-maintenance skills (marked `internal: true` in their SKILL.md metadata) are excluded from this catalog and from default `npx skills add` installs.

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

### Start Here

- [Getting Started](https://github.com/open-agreements/open-agreements/blob/main/docs/getting-started.md)

### Guides

- [Adding Templates](https://github.com/open-agreements/open-agreements/blob/main/docs/adding-templates.md)
- [Adding Field-selectors](https://github.com/open-agreements/open-agreements/blob/main/docs/adding-field-selectors.md)

### Other Packages

- [Contracts Workspace CLI](https://github.com/open-agreements/open-agreements/blob/main/docs/contracts-workspace.md)

### Reference

- [Licensing](https://github.com/open-agreements/open-agreements/blob/main/docs/licensing.md)
- [Changelog & Release Process](https://github.com/open-agreements/open-agreements/blob/main/docs/changelog-release-process.md)
- [Trust Checklist](https://github.com/open-agreements/open-agreements/blob/main/docs/trust-checklist.md)
- [Supported Tools](https://github.com/open-agreements/open-agreements/blob/main/docs/supported-tools.md)
- [Assumptions](https://github.com/open-agreements/open-agreements/blob/main/docs/assumptions.md)
- [Employment Source Policy](https://github.com/open-agreements/open-agreements/blob/main/docs/employment-source-policy.md)

**Links:** [Website](https://usejunior.com?utm_source=github&utm_medium=readme&utm_campaign=open-agreements) | [Template Catalog](https://usejunior.com/templates?utm_source=github&utm_medium=readme&utm_campaign=open-agreements) | [Docs](https://github.com/open-agreements/open-agreements/tree/main/docs) | [Trust](https://usejunior.com/security?utm_source=github&utm_medium=readme&utm_campaign=open-agreements) | [npm](https://www.npmjs.com/package/open-agreements)

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
