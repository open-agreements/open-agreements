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

Fülle standardisierte juristische Vertragsvorlagen aus und erhalte signierbare DOCX-Dateien. OpenAgreements umfasst über 40 Vorlagen für NDAs, Cloud-Service-Verträge, Beschäftigungsdokumente, Contractor-Verträge, SAFEs und NVCA-Finanzierungsdokumente.

Funktioniert mit Claude Code, Gemini CLI, Cursor sowie lokalen MCP- oder CLI-Workflows.

## Inhalt

- [Verfügbare Vorlagen](#verfügbare-vorlagen)
- [Verfügbare Skills](#verfügbare-skills)
- [Pakete](#pakete)
- [Schnellstart](#schnellstart)
- [Installation](#installation)
- [Dokumentation](#dokumentation)
- [Datenschutz](#datenschutz)
- [Siehe auch](#siehe-auch)
- [Mitwirken](#mitwirken)
- [Mit OpenAgreements gebaut](#mit-openagreements-gebaut)
- [Lizenz](#lizenz)

<p align="center">
  <img src="https://raw.githubusercontent.com/open-agreements/open-agreements/main/docs/assets/demo-fill-nda.gif" alt="Fill a Mutual NDA in Claude Code — prompt, answer questions, get a signed-ready DOCX" width="720">
</p>

> *Demo: Claude füllt ein Common Paper Mutual NDA in unter 2 Minuten aus. Für Kürze beschleunigt.*

## Verfügbare Vorlagen

Die Spalte „Quelle“ verweist auf den Upstream-Standard, das Quelldokument oder die kanonische Projektseite (je nach Publisher unterschiedlich). Die Spalte „Lizenz“ zeigt die Bedingungen für die Weiterverbreitung. Die Repo-Links verweisen auf das GitHub-Inhaltsverzeichnis der jeweiligen Vorlage oder des Recipes.

### Vertraulichkeit

| Vorlage | Website | Quelle | Lizenz | Repo |
|----------|---------|--------|---------|------|
| Bonterms Mutual NDA | [Website](https://usejunior.com/templates/bonterms-mutual-nda) | [Bonterms](https://bonterms.com/resources/mutual-nda-cover-page-example) | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/bonterms-mutual-nda) |
| Common Paper Mutual NDA | [Website](https://usejunior.com/templates/common-paper-mutual-nda) | [Common Paper](https://commonpaper.com/standards/mutual-nda/1.0) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-mutual-nda) |
| One Way NDA | [Website](https://usejunior.com/templates/common-paper-one-way-nda) | [Common Paper](https://commonpaper.com/standards/one-way-nda) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-one-way-nda) |

### Vertrieb & Lizenzierung

| Vorlage | Website | Quelle | Lizenz | Repo |
|----------|---------|--------|---------|------|
| Cloud Service Agreement | [Website](https://usejunior.com/templates/common-paper-cloud-service-agreement) | [Common Paper](https://commonpaper.com/standards/cloud-service-agreement/2.1) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-cloud-service-agreement) |
| CSA Click Through | [Website](https://usejunior.com/templates/common-paper-csa-click-through) | [Common Paper](https://commonpaper.com/standards/cloud-service-agreement/2.1) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-csa-click-through) |
| CSA With AI | [Website](https://usejunior.com/templates/common-paper-csa-with-ai) | [Common Paper](https://commonpaper.com/standards/cloud-service-agreement/2.1) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-csa-with-ai) |
| CSA With SLA | [Website](https://usejunior.com/templates/common-paper-csa-with-sla) | [Common Paper](https://commonpaper.com/standards/cloud-service-agreement/2.1) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-csa-with-sla) |
| CSA Without SLA | [Website](https://usejunior.com/templates/common-paper-csa-without-sla) | [Common Paper](https://commonpaper.com/standards/cloud-service-agreement/2.1) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-csa-without-sla) |
| Order Form | [Website](https://usejunior.com/templates/common-paper-order-form) | [Common Paper](https://commonpaper.com/standards/cloud-service-agreement/2.1) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-order-form) |
| Order Form With SLA | [Website](https://usejunior.com/templates/common-paper-order-form-with-sla) | [Common Paper](https://commonpaper.com/standards/cloud-service-agreement/2.1) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-order-form-with-sla) |
| Software License Agreement | [Website](https://usejunior.com/templates/common-paper-software-license-agreement) | [Common Paper](https://commonpaper.com/standards/software-license-agreement/1.1) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-software-license-agreement) |

### Daten & Compliance

| Vorlage | Website | Quelle | Lizenz | Repo |
|----------|---------|--------|---------|------|
| AI Addendum | [Website](https://usejunior.com/templates/common-paper-ai-addendum) | [Common Paper](https://commonpaper.com/standards/ai-addendum/1.0) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-ai-addendum) |
| AI Addendum In App | [Website](https://usejunior.com/templates/common-paper-ai-addendum-in-app) | [Common Paper](https://commonpaper.com/standards/ai-addendum/1.0) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-ai-addendum-in-app) |
| Business Associate Agreement | [Website](https://usejunior.com/templates/common-paper-business-associate-agreement) | [Common Paper](https://commonpaper.com/standards/business-associate-agreement/1.0) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-business-associate-agreement) |
| Data Processing Agreement | [Website](https://usejunior.com/templates/common-paper-data-processing-agreement) | [Common Paper](https://commonpaper.com/standards/data-processing-agreement/1.1) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-data-processing-agreement) |

### Professionelle Dienstleistungen

| Vorlage | Website | Quelle | Lizenz | Repo |
|----------|---------|--------|---------|------|
| Bonterms Professional Services Agreement | [Website](https://usejunior.com/templates/bonterms-professional-services-agreement) | [Bonterms](https://bonterms.com/resources/psa-cover-page-example) | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/bonterms-professional-services-agreement) |
| Independent Contractor Agreement | [Website](https://usejunior.com/templates/common-paper-independent-contractor-agreement) | [Common Paper](https://commonpaper.com/standards/independent-contractor-agreement) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-independent-contractor-agreement) |
| Common Paper Professional Services Agreement | [Website](https://usejunior.com/templates/common-paper-professional-services-agreement) | [Common Paper](https://commonpaper.com/standards/professional-services-agreement/1.1) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-professional-services-agreement) |
| Statement Of Work | [Website](https://usejunior.com/templates/common-paper-statement-of-work) | [Common Paper](https://commonpaper.com/standards/statement-of-work) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-statement-of-work) |

### Deals & Partnerschaften

| Vorlage | Website | Quelle | Lizenz | Repo |
|----------|---------|--------|---------|------|
| Amendment | [Website](https://usejunior.com/templates/common-paper-amendment) | [Common Paper](https://commonpaper.com/standards/amendment) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-amendment) |
| Design Partner Agreement | [Website](https://usejunior.com/templates/common-paper-design-partner-agreement) | [Common Paper](https://commonpaper.com/standards/design-partner-agreement/1.3) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-design-partner-agreement) |
| Letter Of Intent | [Website](https://usejunior.com/templates/common-paper-letter-of-intent) | [Common Paper](https://commonpaper.com/standards/letter-of-intent) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-letter-of-intent) |
| Partnership Agreement | [Website](https://usejunior.com/templates/common-paper-partnership-agreement) | [Common Paper](https://commonpaper.com/standards/partnership-agreement/1.1) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-partnership-agreement) |
| Pilot Agreement | [Website](https://usejunior.com/templates/common-paper-pilot-agreement) | [Common Paper](https://commonpaper.com/standards/pilot-agreement/1.1) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-pilot-agreement) |
| Term Sheet | [Website](https://usejunior.com/templates/common-paper-term-sheet) | [Common Paper](https://commonpaper.com/standards/term-sheet) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-term-sheet) |

### Arbeitsverhältnis

| Vorlage | Website | Quelle | Lizenz | Repo |
|----------|---------|--------|---------|------|
| Employee IP Inventions Assignment | [Website](https://usejunior.com/templates/openagreements-employee-ip-inventions-assignment) | [OpenAgreements](https://github.com/open-agreements/open-agreements/tree/main/content/templates/openagreements-employee-ip-inventions-assignment) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/openagreements-employee-ip-inventions-assignment) |
| Employment Confidentiality Acknowledgement | [Website](https://usejunior.com/templates/openagreements-employment-confidentiality-acknowledgement) | [OpenAgreements](https://github.com/open-agreements/open-agreements/tree/main/content/templates/openagreements-employment-confidentiality-acknowledgement) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/openagreements-employment-confidentiality-acknowledgement) |
| Employment Offer Letter | [Website](https://usejunior.com/templates/openagreements-employment-offer-letter) | [OpenAgreements](https://github.com/open-agreements/open-agreements/tree/main/content/templates/openagreements-employment-offer-letter) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/openagreements-employment-offer-letter) |
| Restrictive Covenant Wyoming | [Website](https://usejunior.com/templates/openagreements-restrictive-covenant-wyoming) | [OpenAgreements](https://github.com/open-agreements/open-agreements/tree/main/content/templates/openagreements-restrictive-covenant-wyoming) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/openagreements-restrictive-covenant-wyoming) |

### SAFEs

| Vorlage | Website | Quelle | Lizenz | Repo |
|----------|---------|--------|---------|------|
| Discount | [Website](https://usejunior.com/templates/yc-safe-discount) | [Y Combinator](https://www.ycombinator.com/documents) | [CC-BY-ND-4.0](https://creativecommons.org/licenses/by-nd/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/external/yc-safe-discount) |
| MFN | [Website](https://usejunior.com/templates/yc-safe-mfn) | [Y Combinator](https://www.ycombinator.com/documents) | [CC-BY-ND-4.0](https://creativecommons.org/licenses/by-nd/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/external/yc-safe-mfn) |
| Pro Rata Side Letter | [Website](https://usejunior.com/templates/yc-safe-pro-rata-side-letter) | [Y Combinator](https://www.ycombinator.com/documents) | [CC-BY-ND-4.0](https://creativecommons.org/licenses/by-nd/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/external/yc-safe-pro-rata-side-letter) |
| Valuation Cap | [Website](https://usejunior.com/templates/yc-safe-valuation-cap) | [Y Combinator](https://www.ycombinator.com/documents) | [CC-BY-ND-4.0](https://creativecommons.org/licenses/by-nd/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/external/yc-safe-valuation-cap) |

### Venture-Finanzierung

| Vorlage | Website | Quelle | Lizenz | Repo |
|----------|---------|--------|---------|------|
| Certificate Of Incorporation | [Website](https://usejunior.com/templates/nvca-certificate-of-incorporation) | [NVCA](https://nvca.org/wp-content/uploads/2025/10/NVCA-Model-COI-10-1-2025.docx) | Recipe | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/recipes/nvca-certificate-of-incorporation) |
| Indemnification Agreement | [Website](https://usejunior.com/templates/nvca-indemnification-agreement) | [NVCA](https://nvca.org/wp-content/uploads/2021/12/NVCA-2020-Indemnification-Agreement.docx) | Recipe | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/recipes/nvca-indemnification-agreement) |
| Investors Rights Agreement | [Website](https://usejunior.com/templates/nvca-investors-rights-agreement) | [NVCA](https://nvca.org/wp-content/uploads/2025/10/NVCA-Model-IRA-10-1-2025-2-1.docx) | Recipe | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/recipes/nvca-investors-rights-agreement) |
| Management Rights Letter | [Website](https://usejunior.com/templates/nvca-management-rights-letter) | [NVCA](https://nvca.org/wp-content/uploads/2025/12/NVCA-2020-Management-Rights-Letter-1-1.docx) | Recipe | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/recipes/nvca-management-rights-letter) |
| ROFR Co Sale Agreement | [Website](https://usejunior.com/templates/nvca-rofr-co-sale-agreement) | [NVCA](https://nvca.org/wp-content/uploads/2025/10/NVCA-Model-ROFRA-10-1-2025.docx) | Recipe | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/recipes/nvca-rofr-co-sale-agreement) |
| Stock Purchase Agreement | [Website](https://usejunior.com/templates/nvca-stock-purchase-agreement) | [NVCA](https://nvca.org/wp-content/uploads/2025/10/NVCA-Model-SPA-10-28-2025-1.docx) | Recipe | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/recipes/nvca-stock-purchase-agreement) |
| Voting Agreement | [Website](https://usejunior.com/templates/nvca-voting-agreement) | [NVCA](https://nvca.org/wp-content/uploads/2024/10/NVCA-Model-VA-10-1-2025.docx) | Recipe | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/recipes/nvca-voting-agreement) |

### Sonstiges

| Vorlage | Website | Quelle | Lizenz | Repo |
|----------|---------|--------|---------|------|
| Closing Checklist | [Website](https://usejunior.com/templates/closing-checklist) | [OpenAgreements](https://github.com/open-agreements/open-agreements) | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/closing-checklist) |
| Board Consent SAFE | [Website](https://usejunior.com/templates/openagreements-board-consent-safe) | [OpenAgreements](https://github.com/open-agreements/open-agreements/tree/main/content/templates/openagreements-board-consent-safe) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/openagreements-board-consent-safe) |
| Due Diligence Request List | [Website](https://usejunior.com/templates/openagreements-due-diligence-request-list) | [OpenAgreements](https://github.com/open-agreements/open-agreements/tree/main/content/templates/openagreements-due-diligence-request-list) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/openagreements-due-diligence-request-list) |
| Stockholder Consent SAFE | [Website](https://usejunior.com/templates/openagreements-stockholder-consent-safe) | [OpenAgreements](https://github.com/open-agreements/open-agreements/tree/main/content/templates/openagreements-stockholder-consent-safe) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/openagreements-stockholder-consent-safe) |
| Working Group List | [Website](https://usejunior.com/templates/working-group-list) | [OpenAgreements](https://github.com/open-agreements/open-agreements) | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/working-group-list) |

## Verfügbare Skills

### Vertragserstellung und -befüllung

| Skill | Beschreibung |
|-------|-------------|
| [open-agreements](https://github.com/open-agreements/open-agreements/tree/main/skills/open-agreements) | Standardisierte juristische Vertragsvorlagen ausfüllen (NDAs, Cloud-Service-Verträge, SAFEs) und signierbare DOCX-Dateien erzeugen. Unterstützt Common Paper-, Bonterms- und Y-Combinator-Vorlagen. Verwende, wenn der Nutzer einen Vertrag entwerfen, eine NDA erstellen, eine Vertragsvorlage ausfüllen oder ein SAFE generieren möchte. Kann Verträge auch per DocuSign zur elektronischen Unterschrift versenden. |
| [nda](https://github.com/open-agreements/open-agreements/tree/main/skills/nda) | NDA-Vorlagen entwerfen und ausfüllen — Mutual NDA, One-Way NDA, Vertraulichkeitsvereinbarung. Erzeugt signierbare DOCX-Dateien aus Common Paper- und Bonterms-Standardformularen. Verwende, wenn der Nutzer „NDA“, „Geheimhaltungsvereinbarung“, „Vertraulichkeitsvereinbarung“, „Mutual NDA“ oder „One-Way NDA“ sagt. |
| [cloud-service-agreement](https://github.com/open-agreements/open-agreements/tree/main/skills/cloud-service-agreement) | SaaS-Vertragsvorlagen entwerfen und ausfüllen — Cloud-Vertrag, MSA, Order Form, Software-Lizenz, Pilot Agreement, Design Partner Agreement. Inklusive Varianten mit SLAs und KI-Bedingungen. Erzeugt signierbare DOCX aus Common Paper-Standardformularen. Verwende, wenn der Nutzer „SaaS-Vertrag“, „Cloud-Vertrag“, „MSA“, „Order Form“, „Softwarelizenz“, „Pilot Agreement“ oder „Design Partner Agreement“ sagt. |
| [services-agreement](https://github.com/open-agreements/open-agreements/tree/main/skills/services-agreement) | Dienstleistungsvertragsvorlagen entwerfen und ausfüllen — Beratungsvertrag, Contractor-Vertrag, SOW, Statement of Work, Professional Services Agreement. Erzeugt signierbare DOCX-Dateien aus Common Paper- und Bonterms-Standardformularen. Verwende, wenn der Nutzer „Beratungsvertrag“, „Contractor-Vertrag“, „SOW“, „Statement of Work“, „Dienstleistungsvertrag“ oder „Freelancer-Vertrag“ sagt. |
| [employment-contract](https://github.com/open-agreements/open-agreements/tree/main/skills/employment-contract) | Arbeitsvertragsvorlagen entwerfen und ausfüllen — Offer Letter, IP-Assignment, PIIA, Vertraulichkeitsbestätigung. Erzeugt signierbare DOCX-Dateien aus OpenAgreements-Standardformularen für die Einstellung von Mitarbeiter:innen. Verwende, wenn der Nutzer „Offer Letter“, „Arbeitsvertrag“, „PIIA“, „IP-Assignment“, „jemanden einstellen“ oder „Onboarding-Unterlagen“ sagt. |
| [data-privacy-agreement](https://github.com/open-agreements/open-agreements/tree/main/skills/data-privacy-agreement) | Datenschutzvertragsvorlagen entwerfen und ausfüllen — DPA, Datenverarbeitungsvertrag, DSGVO, HIPAA BAA, Business Associate Agreement, KI-Addendum. Erzeugt signierbare DOCX-Dateien aus Common Paper-Standardformularen. Verwende, wenn der Nutzer „DPA“, „Datenverarbeitungsvertrag“, „HIPAA BAA“, „Business Associate Agreement“ oder „KI-Addendum“ sagt. |
| [safe](https://github.com/open-agreements/open-agreements/tree/main/skills/safe) | Y-Combinator-SAFE-Vorlagen entwerfen und ausfüllen — Valuation Cap, Discount, MFN, Pro Rata Side Letter. Standardisierte Startup-Finanzierungsdokumente für wandelbare Beteiligungen. Erzeugt signierbare DOCX-Dateien. Verwende, wenn der Nutzer „SAFE“, „simple agreement for future equity“, „YC SAFE“, „Valuation Cap“, „Seed-Runden-Dokumente“ oder „Fundraising-Unterlagen“ sagt. |
| [venture-financing](https://github.com/open-agreements/open-agreements/tree/main/skills/venture-financing) | NVCA-Modell-Dokumente entwerfen und ausfüllen — Stock Purchase Agreement, Certificate of Incorporation, Investors Rights Agreement, Voting Agreement, ROFR, Co-Sale, Indemnification, Management Rights Letter. Series-A- und Venture-Financing-Vorlagen. Erzeugt signierbare DOCX-Dateien. Verwende, wenn der Nutzer „Series-A-Dokumente“, „NVCA“, „Stock Purchase Agreement“, „Investors Rights Agreement“, „Voting Agreement“ oder „Venture-Financing-Docs“ sagt. |

### Bearbeitung und Kundenworkflows

| Skill | Beschreibung |
|-------|-------------|
| [edit-docx-agreement](https://github.com/open-agreements/open-agreements/tree/main/skills/edit-docx-agreement) | Maßgeschneiderte Änderungen an einer von OpenAgreements erzeugten (oder beliebigen bestehenden) DOCX-Vertragsdatei vornehmen — mit Safe-Docx-MCP-Tools für chirurgische, formatierungserhaltende Edits und Tracked-Changes-Ausgaben. Verwende, wenn der Nutzer „diesen Vertrag bearbeiten“, „eine Klausel ändern“, „den Vertrag anpassen“, „individuelle Änderungen an der DOCX“ oder „maßgeschneiderte Änderungen am Dokument“ sagt. |
| [client-email](https://github.com/open-agreements/open-agreements/tree/main/skills/client-email) | Mandantengerichtete E-Mails für juristische Dienstleistungen entwerfen — Anschreiben für Vertrags-Lieferungen, Redline-Zusammenfassungen, Deal-Status-Updates und Follow-ups. Verwende beim Verfassen oder Überarbeiten von ausgehenden E-Mails an Mandant:innen zu juristischen Arbeitsergebnissen. Wird durch „Antwort entwerfen“, „E-Mail an Mandant“, „Anschreiben“, „zurückschreiben an“ oder beliebige Begleit-E-Mails zu juristischen Lieferungen ausgelöst. |
| [delaware-franchise-tax](https://github.com/open-agreements/open-agreements/tree/main/skills/delaware-franchise-tax) | Reiche deine jährliche Delaware Franchise Tax und den Annual Report ein. Führt dich durch die Steuerberechnung (Authorized Shares- und Assumed-Par-Value-Capital-Methoden), den Einreichungsprozess über das eCorp-Portal sowie die Zahlung. Für Delaware C-Corps (Frist 1. März) und LLCs/LPs/GPs (Frist 1. Juni). Verwende, wenn der Nutzer „Delaware Franchise Tax“, „Annual Report Delaware“, „Franchise Tax einreichen“ oder „eCorp-Portal“ sagt. |

### Compliance und Audit

| Skill | Beschreibung |
|-------|-------------|
| [soc2-readiness](https://github.com/open-agreements/open-agreements/tree/main/skills/soc2-readiness) | SOC-2-Type-II-Readiness bewerten. Trust Services Criteria auf Controls abbilden, Lücken identifizieren und einen Remediation-Plan erstellen. Nutzt NIST SP 800-53 (Public Domain) als kanonische Referenz mit SOC-2-Cross-Mapping. Verwende, wenn der Nutzer „SOC-2-Readiness“, „SOC-2-Vorbereitung“, „SOC-2-Gap-Analyse“ oder „auf SOC-2-Audit vorbereiten“ sagt. |
| [iso-27001-internal-audit](https://github.com/open-agreements/open-agreements/tree/main/skills/iso-27001-internal-audit) | Ein ISO-27001-internes Audit durchführen. Controls nach Domäne durchgehen, Lücken identifizieren, Evidenz sammeln und Findings mit Korrekturmaßnahmen-Empfehlungen erzeugen. Nutzt NIST SP 800-53 (Public Domain) als kanonische Referenz. Verwende, wenn der Nutzer „internes Audit durchführen“, „ISO-27001-Audit“, „Control-Assessment“, „Audit-Findings“ oder „ISMS-Assessment“ sagt. |
| [iso-27001-evidence-collection](https://github.com/open-agreements/open-agreements/tree/main/skills/iso-27001-evidence-collection) | Evidenz für ISO-27001- und SOC-2-Audits sammeln, organisieren und validieren. API-First-Ansatz mit CLI-Befehlen für große Cloud-Plattformen. Erzeugt zeitgestempelte, auditbereite Evidenzpakete. Verwende, wenn der Nutzer „Audit-Evidenz sammeln“, „Evidenzpaket vorbereiten“, „Evidenz für den Auditor“, „Evidenz aktualisieren“ oder „Evidenz-Gap-Analyse“ sagt. |

### Developer-Workflows

| Skill | Beschreibung |
|-------|-------------|
| [recipe-quality-audit](https://github.com/open-agreements/open-agreements/tree/main/skills/recipe-quality-audit) | NVCA-Recipe-Qualität auditieren: Dateiinventar, Metadatenschema, Field-zu-Replacement-Coverage, mehrdeutige Keys, Smart Quotes, Testfixtures und Befüllungsqualität prüfen. Erzeugt eine strukturierte Scorecard pro Recipe mit Reifegrad-Klassifikation. Verwende, wenn der Nutzer „Recipe-Qualität auditieren“, „Recipe-Coverage prüfen“, „Recipe-Scorecard“ oder „NVCA-Recipe-Qualität“ sagt. |
| [unit-test-philosophy](https://github.com/open-agreements/open-agreements/tree/main/skills/unit-test-philosophy) | Risikobasiertes Unit-Testing und Allure-lesbarer Behavioral-Spec-Stil für open-agreements. Verwende, wenn der Nutzer „Tests hinzufügen“, „Testqualität“, „Coverage erweitern“, „Unit-Test-Stil“ oder „Allure-Test-Spec“ sagt. Gilt beim Hinzufügen/Aktualisieren von Tests, beim Ausbau der Coverage oder beim Review der Testqualität in src, integration-tests und Workspace-Paketen. |

### Template-Erstellung

| Skill | Beschreibung |
|-------|-------------|
| [canonical-markdown-authoring](https://github.com/open-agreements/open-agreements/tree/main/skills/canonical-markdown-authoring) | Konvertiere einfache Markdown-Vertragsentwürfe in OpenAgreements’ kanonisches template.md-Authoring-Format — YAML-Frontmatter, Kind|Label|Value|Show-When-Cover-Term-Tabellen, oa:clause-Direktiven, [[Defined Term]]-Absätze und oa:signer-Direktiven, die zu validierten JSON-Specs und DOCX-Artefakten kompiliert werden. Verwende, wenn der Nutzer „in kanonisches Markdown konvertieren“, „eine neue OpenAgreements-Vorlage erstellen“, „Vorlage auf template.md migrieren“ oder „einen Vertrag in kanonischer Form schreiben“ sagt. |

## Pakete

| Paket | Beschreibung |
|---------|-------------|
| [open-agreements](https://www.npmjs.com/package/open-agreements) | Open-Source-CLI und -Bibliothek zum Befüllen juristischer Vorlagen |
| [@open-agreements/contract-templates-mcp](https://github.com/open-agreements/open-agreements/blob/main/packages/contract-templates-mcp/README.md) | Lokaler stdio-MCP-Server für die Entdeckung und Befüllung von OpenAgreements-Vorlagen |
| [@open-agreements/contracts-workspace](https://github.com/open-agreements/open-agreements/blob/main/packages/contracts-workspace/README.md) | Workspace-orientierte CLI zur Organisation und Nachverfolgung von Vertrags-Repositorys |
| [@open-agreements/contracts-workspace-mcp](https://github.com/open-agreements/open-agreements/blob/main/packages/contracts-workspace-mcp/README.md) | Lokaler stdio-MCP-Server für Contracts-Workspace-Operationen |
| [@open-agreements/checklist-mcp](https://github.com/open-agreements/open-agreements/blob/main/packages/checklist-mcp/README.md) | Lokaler stdio-MCP-Server für OpenAgreements-Checklist-Memory-Operationen |

### Was installiert wird

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

NVCA-Recipe-Vorlagen werden zur Laufzeit heruntergeladen und sind nicht im Paket enthalten.

<details>
<summary><strong>CLI-Referenz</strong></summary>

### `list`

Zeigt verfügbare Vorlagen mit Lizenzinformationen und Feldanzahl.

```bash
open-agreements list

# Machine-readable JSON for agent skills and automation
open-agreements list --json
```

### `fill <template>`

Rendert eine ausgefüllte DOCX aus einer Vorlage.

```bash
# From a JSON data file
open-agreements fill common-paper-mutual-nda -d data.json -o output.docx

# With inline --set flags
open-agreements fill common-paper-mutual-nda --set party_1_name="Acme Corp" --set governing_law="Delaware"
```

### `validate [template]`

Führt die Validierungspipeline für eine oder alle Vorlagen aus.

```bash
open-agreements validate
open-agreements validate common-paper-mutual-nda
```

</details>

<details>
<summary><strong>Agent-Setup-Details</strong></summary>

### Claude Code

```bash
npx skills add open-agreements/open-agreements
```

### Gemini CLI

```bash
gemini extensions install https://github.com/open-agreements/open-agreements
```

### Cursor

Dieses Repository enthält ein Cursor-Plugin-Manifest unter `.cursor-plugin/plugin.json` mit MCP-Verdrahtung in `mcp.json`.

### Lokale vs. gehostete Ausführung

- **Lokal**: `npx`, globale Installation oder stdio-MCP. Die Verarbeitung erfolgt auf deinem Rechner.
- **Gehostet**: `https://openagreements.org/api/mcp`. Die Vorlagenbefüllung läuft serverseitig für schnelleres Setup.

Wähle je nach Dokumentsensibilität und interner Richtlinie. Siehe die Trust-Checklist unten für die Datenflussübersicht.

</details>

## Schnellstart

### Mit Claude Code

Frage Claude:

```text
Fill the Common Paper mutual NDA for my company
```

Claude kann Vorlagen entdecken, dich nach Feldwerten befragen und eine signierbereite DOCX rendern.

### Mit der CLI

```bash
# See all available templates
open-agreements list

# Fill a template from a JSON data file
open-agreements fill common-paper-mutual-nda -d values.json -o my-nda.docx

# Fill with inline values
open-agreements fill common-paper-mutual-nda --set party_1_name="Acme Corp" --set governing_law="Delaware"
```

### Beispiel-Prompts

- „Entwirf eine NDA für unseren Bau-Subunternehmer“
- „Erstelle einen Beratungsvertrag für unsere Versicherungsagentur“
- „Fülle den Independent-Contractor-Agreement für eine freiberufliche Designerin aus“
- „Erzeuge ein SAFE mit einem Valuation Cap von 5 Mio. $“

### Was passiert

1. Der Agent führt `list --json` aus, um Vorlagen und ihre Felder zu entdecken.
2. Er fragt dich nach Feldwerten, gruppiert nach Abschnitt.
3. Er führt `fill <template>` aus, um eine DOCX unter Beibehaltung der ursprünglichen Formatierung zu rendern.
4. Du prüfst und unterschreibst das Ausgabedokument.

## Installation

### Agent Skill (empfohlen)

```bash
npx skills add open-agreements/open-agreements
```

### Remote-MCP

Verbinde jeden MCP-kompatiblen Agenten mit dem gehosteten Server unter `https://openagreements.org/api/mcp`.

**Claude Code**

```bash
claude mcp add --transport http open-agreements https://openagreements.org/api/mcp
```

**Codex CLI**

```bash
codex mcp add open-agreements --url https://openagreements.org/api/mcp
```

**Andere Agenten** — richte deinen Client auf `https://openagreements.org/api/mcp` (streamable HTTP).

### Gemini-CLI-Extension

```bash
gemini extensions install https://github.com/open-agreements/open-agreements
```

### CLI

```bash
npm install -g open-agreements
```

Oder direkt ohne Installation ausführen:

```bash
npx -y open-agreements@latest list
```

---

## Dokumentation

### Starte hier

- [Getting Started](https://github.com/open-agreements/open-agreements/blob/main/docs/getting-started.md)

### Anleitungen

- [Adding Templates](https://github.com/open-agreements/open-agreements/blob/main/docs/adding-templates.md)
- [Adding Recipes](https://github.com/open-agreements/open-agreements/blob/main/docs/adding-recipes.md)

### Weitere Pakete

- [Contracts Workspace CLI](https://github.com/open-agreements/open-agreements/blob/main/docs/contracts-workspace.md)

### Referenz

- [Licensing](https://github.com/open-agreements/open-agreements/blob/main/docs/licensing.md)
- [Changelog & Release Process](https://github.com/open-agreements/open-agreements/blob/main/docs/changelog-release-process.md)
- [Trust Checklist](https://github.com/open-agreements/open-agreements/blob/main/docs/trust-checklist.md)
- [Supported Tools](https://github.com/open-agreements/open-agreements/blob/main/docs/supported-tools.md)
- [Assumptions](https://github.com/open-agreements/open-agreements/blob/main/docs/assumptions.md)
- [Employment Source Policy](https://github.com/open-agreements/open-agreements/blob/main/docs/employment-source-policy.md)

**Links:** [Website](https://usejunior.com) | [Vorlagenkatalog](https://usejunior.com/templates) | [Docs](https://github.com/open-agreements/open-agreements/tree/main/docs) | [Trust](https://usejunior.com/security) | [npm](https://www.npmjs.com/package/open-agreements)

## Datenschutz

- **Lokaler Modus** (`npx`, globale Installation, stdio-MCP): Die gesamte Verarbeitung erfolgt auf deinem Rechner. Es werden keine Dokumentinhalte nach außen gesendet.
- **Gehosteter Modus** (`https://openagreements.org/api/mcp`): Die Vorlagenbefüllung läuft serverseitig. Es werden keine ausgefüllten Dokumente nach der Rückgabe der Antwort gespeichert.

Details in der [Datenschutzerklärung](https://usejunior.com/privacy_policy).

Sicherheitsrichtlinie: siehe [SECURITY.md](https://github.com/open-agreements/open-agreements/blob/main/SECURITY.md).

## Siehe auch

- [safe-docx](https://github.com/UseJunior/safe-docx) — chirurgische Bearbeitung bestehender Word-Dokumente mit Coding-Agents

## Mitwirken

Siehe [CONTRIBUTING.md](https://github.com/open-agreements/open-agreements/blob/main/CONTRIBUTING.md), um Vorlagen, Recipes und andere Verbesserungen hinzuzufügen.

## Mit OpenAgreements gebaut

- [Safe Clause](https://safeclause.deltaxy.ai) — KI-gestützte Vertragsplattform für Startups. [#1 auf vibecode.law, März 2026](https://vibecode.law/showcase/safe-clause-317416).

Baust du auf OpenAgreements auf? Eröffne einen PR, um dein Projekt aufzunehmen.

## Star-Verlauf

[![Star History Chart](https://api.star-history.com/svg?repos=open-agreements/open-agreements&type=Date)](https://star-history.com/#open-agreements/open-agreements&Date)

## Lizenz

MIT. Vorlageninhalte werden von ihren jeweiligen Autor:innen lizenziert:

- CC BY 4.0 für Common Paper-, Bonterms- und OpenAgreements-erstellte Vorlagen
- CC BY-ND 4.0 für unverändert vendored Y-Combinator-SAFE-Vorlagen
- proprietär oder nicht redistributable für NVCA-Quelldokumente, die über Recipe-Workflows abgewickelt werden

Siehe `metadata.yaml` jeder Vorlage für quellen-spezifische Details.

Dieses Tool erzeugt Dokumente aus Standardvorlagen. Es bietet keine Rechtsberatung. Konsultiere für Rechtsberatung eine Anwältin oder einen Anwalt.
