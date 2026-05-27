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

> **Nota de traducción:** `README.md` en inglés es la fuente canónica de verdad. Esta traducción puede tener un pequeño retraso. Los cambios importantes del README en inglés deben propagarse en un plazo de 72 horas.

Completa plantillas estándar de acuerdos legales y obtén archivos DOCX listos para firma. OpenAgreements incluye más de 40 plantillas que cubren NDAs, acuerdos de servicios cloud, documentos laborales, acuerdos con contratistas, SAFEs y documentos de financiamiento NVCA.

Funciona con Claude Code, Gemini CLI, Cursor y flujos de trabajo locales por MCP o CLI.

## Contenidos

- [Plantillas disponibles](#plantillas-disponibles)
- [Skills disponibles](#skills-disponibles)
- [Paquetes](#paquetes)
- [Inicio rápido](#inicio-rápido)
- [Instalación](#instalación)
- [Documentación](#documentación)
- [Privacidad](#privacidad)
- [Ver también](#ver-también)
- [Contribuir](#contribuir)
- [Construido con OpenAgreements](#construido-con-openagreements)
- [Licencia](#licencia)

<p align="center">
  <img src="https://raw.githubusercontent.com/open-agreements/open-agreements/main/docs/assets/demo-fill-nda.gif" alt="Fill a Mutual NDA in Claude Code — prompt, answer questions, get a signed-ready DOCX" width="720">
</p>

> *Demo: Claude completa un Mutual NDA de Common Paper en menos de 2 minutos. Acelerado para brevedad.*

## Plantillas disponibles

La columna Fuente enlaza al estándar original, documento fuente o página canónica del proyecto (varía según el editor). La columna Licencia muestra los términos de redistribución. Los enlaces de Repo apuntan al directorio de contenido en GitHub de cada plantilla o recipe.

### Confidencialidad

| Plantilla | Sitio web | Fuente | Licencia | Repo |
|-----------|-----------|--------|----------|------|
| Bonterms Mutual NDA | [Sitio web](https://usejunior.com/templates/bonterms-mutual-nda) | [Bonterms](https://bonterms.com/resources/mutual-nda-cover-page-example) | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/bonterms-mutual-nda) |
| Common Paper Mutual NDA | [Sitio web](https://usejunior.com/templates/common-paper-mutual-nda) | [Common Paper](https://commonpaper.com/standards/mutual-nda/1.0) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-mutual-nda) |
| One Way NDA | [Sitio web](https://usejunior.com/templates/common-paper-one-way-nda) | [Common Paper](https://commonpaper.com/standards/one-way-nda) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-one-way-nda) |

### Ventas y Licencias

| Plantilla | Sitio web | Fuente | Licencia | Repo |
|-----------|-----------|--------|----------|------|
| Cloud Service Agreement | [Sitio web](https://usejunior.com/templates/common-paper-cloud-service-agreement) | [Common Paper](https://commonpaper.com/standards/cloud-service-agreement/2.1) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-cloud-service-agreement) |
| CSA Click Through | [Sitio web](https://usejunior.com/templates/common-paper-csa-click-through) | [Common Paper](https://commonpaper.com/standards/cloud-service-agreement/2.1) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-csa-click-through) |
| CSA With AI | [Sitio web](https://usejunior.com/templates/common-paper-csa-with-ai) | [Common Paper](https://commonpaper.com/standards/cloud-service-agreement/2.1) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-csa-with-ai) |
| CSA With SLA | [Sitio web](https://usejunior.com/templates/common-paper-csa-with-sla) | [Common Paper](https://commonpaper.com/standards/cloud-service-agreement/2.1) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-csa-with-sla) |
| CSA Without SLA | [Sitio web](https://usejunior.com/templates/common-paper-csa-without-sla) | [Common Paper](https://commonpaper.com/standards/cloud-service-agreement/2.1) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-csa-without-sla) |
| Order Form | [Sitio web](https://usejunior.com/templates/common-paper-order-form) | [Common Paper](https://commonpaper.com/standards/cloud-service-agreement/2.1) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-order-form) |
| Order Form With SLA | [Sitio web](https://usejunior.com/templates/common-paper-order-form-with-sla) | [Common Paper](https://commonpaper.com/standards/cloud-service-agreement/2.1) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-order-form-with-sla) |
| Software License Agreement | [Sitio web](https://usejunior.com/templates/common-paper-software-license-agreement) | [Common Paper](https://commonpaper.com/standards/software-license-agreement/1.1) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-software-license-agreement) |

### Datos y Cumplimiento

| Plantilla | Sitio web | Fuente | Licencia | Repo |
|-----------|-----------|--------|----------|------|
| AI Addendum | [Sitio web](https://usejunior.com/templates/common-paper-ai-addendum) | [Common Paper](https://commonpaper.com/standards/ai-addendum/1.0) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-ai-addendum) |
| AI Addendum In App | [Sitio web](https://usejunior.com/templates/common-paper-ai-addendum-in-app) | [Common Paper](https://commonpaper.com/standards/ai-addendum/1.0) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-ai-addendum-in-app) |
| Business Associate Agreement | [Sitio web](https://usejunior.com/templates/common-paper-business-associate-agreement) | [Common Paper](https://commonpaper.com/standards/business-associate-agreement/1.0) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-business-associate-agreement) |
| Data Processing Agreement | [Sitio web](https://usejunior.com/templates/common-paper-data-processing-agreement) | [Common Paper](https://commonpaper.com/standards/data-processing-agreement/1.1) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-data-processing-agreement) |

### Servicios Profesionales

| Plantilla | Sitio web | Fuente | Licencia | Repo |
|-----------|-----------|--------|----------|------|
| Bonterms Professional Services Agreement | [Sitio web](https://usejunior.com/templates/bonterms-professional-services-agreement) | [Bonterms](https://bonterms.com/resources/psa-cover-page-example) | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/bonterms-professional-services-agreement) |
| Independent Contractor Agreement | [Sitio web](https://usejunior.com/templates/common-paper-independent-contractor-agreement) | [Common Paper](https://commonpaper.com/standards/independent-contractor-agreement) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-independent-contractor-agreement) |
| Common Paper Professional Services Agreement | [Sitio web](https://usejunior.com/templates/common-paper-professional-services-agreement) | [Common Paper](https://commonpaper.com/standards/professional-services-agreement/1.1) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-professional-services-agreement) |
| Statement Of Work | [Sitio web](https://usejunior.com/templates/common-paper-statement-of-work) | [Common Paper](https://commonpaper.com/standards/statement-of-work) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-statement-of-work) |

### Acuerdos y Alianzas

| Plantilla | Sitio web | Fuente | Licencia | Repo |
|-----------|-----------|--------|----------|------|
| Amendment | [Sitio web](https://usejunior.com/templates/common-paper-amendment) | [Common Paper](https://commonpaper.com/standards/amendment) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-amendment) |
| Design Partner Agreement | [Sitio web](https://usejunior.com/templates/common-paper-design-partner-agreement) | [Common Paper](https://commonpaper.com/standards/design-partner-agreement/1.3) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-design-partner-agreement) |
| Letter Of Intent | [Sitio web](https://usejunior.com/templates/common-paper-letter-of-intent) | [Common Paper](https://commonpaper.com/standards/letter-of-intent) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-letter-of-intent) |
| Partnership Agreement | [Sitio web](https://usejunior.com/templates/common-paper-partnership-agreement) | [Common Paper](https://commonpaper.com/standards/partnership-agreement/1.1) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-partnership-agreement) |
| Pilot Agreement | [Sitio web](https://usejunior.com/templates/common-paper-pilot-agreement) | [Common Paper](https://commonpaper.com/standards/pilot-agreement/1.1) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-pilot-agreement) |
| Term Sheet | [Sitio web](https://usejunior.com/templates/common-paper-term-sheet) | [Common Paper](https://commonpaper.com/standards/term-sheet) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-term-sheet) |

### Empleo

| Plantilla | Sitio web | Fuente | Licencia | Repo |
|-----------|-----------|--------|----------|------|
| Employee IP Inventions Assignment | [Sitio web](https://usejunior.com/templates/openagreements-employee-ip-inventions-assignment) | [OpenAgreements](https://github.com/open-agreements/open-agreements/tree/main/content/templates/openagreements-employee-ip-inventions-assignment) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/openagreements-employee-ip-inventions-assignment) |
| Employment Confidentiality Acknowledgement | [Sitio web](https://usejunior.com/templates/openagreements-employment-confidentiality-acknowledgement) | [OpenAgreements](https://github.com/open-agreements/open-agreements/tree/main/content/templates/openagreements-employment-confidentiality-acknowledgement) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/openagreements-employment-confidentiality-acknowledgement) |
| Employment Offer Letter | [Sitio web](https://usejunior.com/templates/openagreements-employment-offer-letter) | [OpenAgreements](https://github.com/open-agreements/open-agreements/tree/main/content/templates/openagreements-employment-offer-letter) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/openagreements-employment-offer-letter) |
| Restrictive Covenant Wyoming | [Sitio web](https://usejunior.com/templates/openagreements-restrictive-covenant-wyoming) | [OpenAgreements](https://github.com/open-agreements/open-agreements/tree/main/content/templates/openagreements-restrictive-covenant-wyoming) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/openagreements-restrictive-covenant-wyoming) |

### SAFEs

| Plantilla | Sitio web | Fuente | Licencia | Repo |
|-----------|-----------|--------|----------|------|
| Discount | [Sitio web](https://usejunior.com/templates/yc-safe-discount) | [Y Combinator](https://www.ycombinator.com/documents) | [CC-BY-ND-4.0](https://creativecommons.org/licenses/by-nd/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/external/yc-safe-discount) |
| MFN | [Sitio web](https://usejunior.com/templates/yc-safe-mfn) | [Y Combinator](https://www.ycombinator.com/documents) | [CC-BY-ND-4.0](https://creativecommons.org/licenses/by-nd/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/external/yc-safe-mfn) |
| Pro Rata Side Letter | [Sitio web](https://usejunior.com/templates/yc-safe-pro-rata-side-letter) | [Y Combinator](https://www.ycombinator.com/documents) | [CC-BY-ND-4.0](https://creativecommons.org/licenses/by-nd/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/external/yc-safe-pro-rata-side-letter) |
| Valuation Cap | [Sitio web](https://usejunior.com/templates/yc-safe-valuation-cap) | [Y Combinator](https://www.ycombinator.com/documents) | [CC-BY-ND-4.0](https://creativecommons.org/licenses/by-nd/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/external/yc-safe-valuation-cap) |

### Financiación de Capital de Riesgo

| Plantilla | Sitio web | Fuente | Licencia | Repo |
|-----------|-----------|--------|----------|------|
| Certificate Of Incorporation | [Sitio web](https://usejunior.com/templates/nvca-certificate-of-incorporation) | [NVCA](https://nvca.org/wp-content/uploads/2025/10/NVCA-Model-COI-10-1-2025.docx) | Recipe | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/recipes/nvca-certificate-of-incorporation) |
| Indemnification Agreement | [Sitio web](https://usejunior.com/templates/nvca-indemnification-agreement) | [NVCA](https://nvca.org/wp-content/uploads/2021/12/NVCA-2020-Indemnification-Agreement.docx) | Recipe | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/recipes/nvca-indemnification-agreement) |
| Investors Rights Agreement | [Sitio web](https://usejunior.com/templates/nvca-investors-rights-agreement) | [NVCA](https://nvca.org/wp-content/uploads/2025/10/NVCA-Model-IRA-10-1-2025-2-1.docx) | Recipe | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/recipes/nvca-investors-rights-agreement) |
| Management Rights Letter | [Sitio web](https://usejunior.com/templates/nvca-management-rights-letter) | [NVCA](https://nvca.org/wp-content/uploads/2025/12/NVCA-2020-Management-Rights-Letter-1-1.docx) | Recipe | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/recipes/nvca-management-rights-letter) |
| ROFR Co Sale Agreement | [Sitio web](https://usejunior.com/templates/nvca-rofr-co-sale-agreement) | [NVCA](https://nvca.org/wp-content/uploads/2025/10/NVCA-Model-ROFRA-10-1-2025.docx) | Recipe | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/recipes/nvca-rofr-co-sale-agreement) |
| Stock Purchase Agreement | [Sitio web](https://usejunior.com/templates/nvca-stock-purchase-agreement) | [NVCA](https://nvca.org/wp-content/uploads/2025/10/NVCA-Model-SPA-10-28-2025-1.docx) | Recipe | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/recipes/nvca-stock-purchase-agreement) |
| Voting Agreement | [Sitio web](https://usejunior.com/templates/nvca-voting-agreement) | [NVCA](https://nvca.org/wp-content/uploads/2024/10/NVCA-Model-VA-10-1-2025.docx) | Recipe | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/recipes/nvca-voting-agreement) |

### Otros

| Plantilla | Sitio web | Fuente | Licencia | Repo |
|-----------|-----------|--------|----------|------|
| Closing Checklist | [Sitio web](https://usejunior.com/templates/closing-checklist) | [OpenAgreements](https://github.com/open-agreements/open-agreements) | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/closing-checklist) |
| Board Consent SAFE | [Sitio web](https://usejunior.com/templates/openagreements-board-consent-safe) | [OpenAgreements](https://github.com/open-agreements/open-agreements/tree/main/content/templates/openagreements-board-consent-safe) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/openagreements-board-consent-safe) |
| Due Diligence Request List | [Sitio web](https://usejunior.com/templates/openagreements-due-diligence-request-list) | [OpenAgreements](https://github.com/open-agreements/open-agreements/tree/main/content/templates/openagreements-due-diligence-request-list) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/openagreements-due-diligence-request-list) |
| Stockholder Consent SAFE | [Sitio web](https://usejunior.com/templates/openagreements-stockholder-consent-safe) | [OpenAgreements](https://github.com/open-agreements/open-agreements/tree/main/content/templates/openagreements-stockholder-consent-safe) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/openagreements-stockholder-consent-safe) |
| Working Group List | [Sitio web](https://usejunior.com/templates/working-group-list) | [OpenAgreements](https://github.com/open-agreements/open-agreements) | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/working-group-list) |

## Skills disponibles

### Redacción y llenado de acuerdos

| Skill | Descripción |
|-------|-------------|
| [open-agreements](https://github.com/open-agreements/open-agreements/tree/main/skills/open-agreements) | Completa plantillas estándar de acuerdos legales (NDAs, acuerdos de servicios cloud, SAFEs) y produce archivos DOCX listos para firma. Soporta plantillas de Common Paper, Bonterms y Y Combinator. Úsalo cuando el usuario necesite redactar un acuerdo legal, crear un NDA, completar una plantilla de contrato o generar un SAFE. También puede enviar acuerdos para firma electrónica vía DocuSign. |
| [nda](https://github.com/open-agreements/open-agreements/tree/main/skills/nda) | Redacta y completa plantillas de NDA — NDA mutuo, NDA unilateral, acuerdo de confidencialidad. Produce archivos DOCX listos para firma a partir de formularios estándar de Common Paper y Bonterms. Úsalo cuando el usuario diga "NDA", "acuerdo de confidencialidad", "NDA mutuo" o "NDA unilateral". |
| [cloud-service-agreement](https://github.com/open-agreements/open-agreements/tree/main/skills/cloud-service-agreement) | Redacta y completa plantillas de acuerdos SaaS — contrato cloud, MSA, order form, licencia de software, acuerdo piloto, acuerdo de design partner. Incluye variantes con SLAs y términos de IA. Produce DOCX listos para firma a partir de formularios estándar de Common Paper. Úsalo cuando el usuario diga "acuerdo SaaS", "contrato cloud", "MSA", "order form", "licencia de software", "acuerdo piloto" o "acuerdo de design partner". |
| [services-agreement](https://github.com/open-agreements/open-agreements/tree/main/skills/services-agreement) | Redacta y completa plantillas de acuerdos de servicios — contrato de consultoría, acuerdo con contratista, SOW, statement of work, acuerdo de servicios profesionales. Produce archivos DOCX listos para firma a partir de formularios estándar de Common Paper y Bonterms. Úsalo cuando el usuario diga "contrato de consultoría", "acuerdo con contratista", "SOW", "statement of work", "acuerdo de servicios" o "contrato freelance". |
| [employment-contract](https://github.com/open-agreements/open-agreements/tree/main/skills/employment-contract) | Redacta y completa plantillas de acuerdos laborales — carta de oferta, cesión de PI, PIIA, acuse de confidencialidad. Produce archivos DOCX listos para firma a partir de formularios estándar de OpenAgreements para contratar empleados. Úsalo cuando el usuario diga "carta de oferta", "acuerdo laboral", "PIIA", "cesión de PI", "contratar a alguien" o "papeleo de onboarding". |
| [data-privacy-agreement](https://github.com/open-agreements/open-agreements/tree/main/skills/data-privacy-agreement) | Redacta y completa plantillas de acuerdos de privacidad de datos — DPA, acuerdo de procesamiento de datos, GDPR, HIPAA BAA, business associate agreement, AI addendum. Produce archivos DOCX listos para firma a partir de formularios estándar de Common Paper. Úsalo cuando el usuario diga "DPA", "acuerdo de procesamiento de datos", "HIPAA BAA", "business associate agreement" o "AI addendum". |
| [safe](https://github.com/open-agreements/open-agreements/tree/main/skills/safe) | Redacta y completa plantillas SAFE de Y Combinator — valuation cap, discount, MFN, pro rata side letter. Documentos estándar de financiación startup para equity convertible. Produce archivos DOCX listos para firma. Úsalo cuando el usuario diga "SAFE", "simple agreement for future equity", "YC SAFE", "valuation cap", "documentos de ronda seed" o "papeleo de fundraising". |
| [venture-financing](https://github.com/open-agreements/open-agreements/tree/main/skills/venture-financing) | Redacta y completa documentos modelo NVCA — stock purchase agreement, certificate of incorporation, investors rights agreement, voting agreement, ROFR, co-sale, indemnification, management rights letter. Plantillas de Serie A y financiación de capital de riesgo. Produce archivos DOCX listos para firma. Úsalo cuando el usuario diga "documentos Serie A", "NVCA", "stock purchase agreement", "investors rights agreement", "voting agreement" o "docs de venture financing". |

### Edición y flujos con clientes

| Skill | Descripción |
|-------|-------------|
| [edit-docx-agreement](https://github.com/open-agreements/open-agreements/tree/main/skills/edit-docx-agreement) | Realiza ediciones a medida sobre un acuerdo DOCX generado por OpenAgreements (o cualquier DOCX existente), usando las herramientas Safe Docx MCP para ediciones quirúrgicas que preservan el formato y producen salidas con cambios rastreados. Úsalo cuando el usuario diga "edita este contrato", "cambia una cláusula", "modifica el acuerdo", "ediciones personalizadas al docx" o "cambios a medida en el documento". |
| [client-email](https://github.com/open-agreements/open-agreements/tree/main/skills/client-email) | Redacta correos dirigidos a clientes para servicios legales — notas de remisión para entregables contractuales, resúmenes de redlines, actualizaciones de estado del deal y seguimientos. Úsalo al componer o revisar correos salientes a clientes sobre el trabajo legal. Se activa con "redacta una respuesta", "correo al cliente", "nota de remisión", "responde a" o cualquier correo saliente que acompañe un entregable legal. |
| [delaware-franchise-tax](https://github.com/open-agreements/open-agreements/tree/main/skills/delaware-franchise-tax) | Presenta tu Delaware franchise tax anual y el annual report. Te guía por el cálculo del impuesto (métodos Authorized Shares y Assumed Par Value Capital), el proceso de presentación en el portal eCorp y el pago. Para Delaware C-Corps (fecha límite 1 de marzo) y LLCs/LPs/GPs (fecha límite 1 de junio). Úsalo cuando el usuario diga "Delaware franchise tax", "annual report Delaware", "presentar franchise tax" o "portal eCorp". |

### Cumplimiento y auditoría

| Skill | Descripción |
|-------|-------------|
| [soc2-readiness](https://github.com/open-agreements/open-agreements/tree/main/skills/soc2-readiness) | Evalúa la preparación para SOC 2 Type II. Mapea los Trust Services Criteria a controles, identifica brechas y construye un plan de remediación. Usa NIST SP 800-53 (dominio público) como referencia canónica con mapeo cruzado de criterios SOC 2. Úsalo cuando el usuario diga "preparación SOC 2", "preparación para SOC 2", "análisis de brechas SOC 2" o "preparar para auditoría SOC 2". |
| [iso-27001-internal-audit](https://github.com/open-agreements/open-agreements/tree/main/skills/iso-27001-internal-audit) | Ejecuta una auditoría interna ISO 27001. Recorre los controles por dominio, identifica brechas, recopila evidencia y genera hallazgos con recomendaciones de acción correctiva. Usa NIST SP 800-53 (dominio público) como referencia canónica. Úsalo cuando el usuario diga "ejecutar auditoría interna", "auditoría ISO 27001", "evaluación de controles", "hallazgos de auditoría" o "evaluación del ISMS". |
| [iso-27001-evidence-collection](https://github.com/open-agreements/open-agreements/tree/main/skills/iso-27001-evidence-collection) | Recopila, organiza y valida evidencia para auditorías ISO 27001 y SOC 2. Enfoque API-first con comandos CLI para las principales plataformas cloud. Produce paquetes de evidencia con marcas de tiempo y listos para auditor. Úsalo cuando el usuario diga "recopilar evidencia de auditoría", "preparar paquete de evidencia", "evidencia para el auditor", "refrescar evidencia" o "análisis de brechas de evidencia". |

### Flujos para desarrolladores

| Skill | Descripción |
|-------|-------------|
| [recipe-quality-audit](https://github.com/open-agreements/open-agreements/tree/main/skills/recipe-quality-audit) | Audita la calidad de los recipes NVCA: comprueba inventario de archivos, esquema de metadatos, cobertura de campo a reemplazo, claves ambiguas, comillas tipográficas, fixtures de pruebas y calidad del llenado. Produce un scorecard estructurado por recipe con clasificación de nivel de madurez. Úsalo cuando el usuario diga "auditar calidad de recipe", "comprobar cobertura del recipe", "scorecard de recipe" o "calidad de recipe NVCA". |
| [unit-test-philosophy](https://github.com/open-agreements/open-agreements/tree/main/skills/unit-test-philosophy) | Pruebas unitarias basadas en riesgo y estilo de especificación de comportamiento legible por Allure para open-agreements. Úsalo cuando el usuario diga "añadir pruebas", "calidad de pruebas", "expansión de cobertura", "estilo de pruebas unitarias" o "spec de prueba Allure". Aplica al añadir/actualizar pruebas, expandir cobertura o revisar calidad de pruebas en src, integration-tests y paquetes del workspace. |

### Autoría de plantillas

| Skill | Descripción |
|-------|-------------|
| [canonical-markdown-authoring](https://github.com/open-agreements/open-agreements/tree/main/skills/canonical-markdown-authoring) | Convierte borradores de contrato en markdown plano al formato canónico de autoría template.md de OpenAgreements — YAML frontmatter, tablas Kind|Label|Value|Show When de cover-terms, directivas oa:clause, párrafos [[Defined Term]] y directivas oa:signer que compilan a specs JSON validados y artefactos DOCX. Úsalo cuando el usuario diga "convierte esto a markdown canónico", "crea una nueva plantilla de OpenAgreements", "migra plantilla a template.md" o "escribe un contrato en forma canónica". |

## Paquetes

| Paquete | Descripción |
|---------|-------------|
| [open-agreements](https://www.npmjs.com/package/open-agreements) | CLI y librería open-source para completar plantillas legales |
| [@open-agreements/contract-templates-mcp](https://github.com/open-agreements/open-agreements/blob/main/packages/contract-templates-mcp/README.md) | Servidor MCP local por stdio para descubrimiento y llenado de plantillas OpenAgreements |
| [@open-agreements/contracts-workspace](https://github.com/open-agreements/open-agreements/blob/main/packages/contracts-workspace/README.md) | CLI orientado al workspace para organizar y rastrear repositorios de contratos |
| [@open-agreements/contracts-workspace-mcp](https://github.com/open-agreements/open-agreements/blob/main/packages/contracts-workspace-mcp/README.md) | Servidor MCP local por stdio para operaciones del workspace de contratos |
| [@open-agreements/checklist-mcp](https://github.com/open-agreements/open-agreements/blob/main/packages/checklist-mcp/README.md) | Servidor MCP local por stdio para operaciones de memoria de checklist de OpenAgreements |

### Qué se instala

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

Las plantillas de recipes NVCA se descargan en tiempo de ejecución y no se incluyen en el paquete.

<details>
<summary><strong>Referencia del CLI</strong></summary>

### `list`

Muestra las plantillas disponibles con información de licencia y conteo de campos.

```bash
open-agreements list

# Machine-readable JSON for agent skills and automation
open-agreements list --json
```

### `fill <template>`

Genera un DOCX completado desde una plantilla.

```bash
# From a JSON data file
open-agreements fill common-paper-mutual-nda -d data.json -o output.docx

# With inline --set flags
open-agreements fill common-paper-mutual-nda --set party_1_name="Acme Corp" --set governing_law="Delaware"
```

### `validate [template]`

Ejecuta el pipeline de validación sobre una o todas las plantillas.

```bash
open-agreements validate
open-agreements validate common-paper-mutual-nda
```

</details>

<details>
<summary><strong>Detalles de configuración del agente</strong></summary>

### Claude Code

```bash
npx skills add open-agreements/open-agreements
```

### Gemini CLI

```bash
gemini extensions install https://github.com/open-agreements/open-agreements
```

### Cursor

Este repositorio incluye un manifiesto de plugin de Cursor en `.cursor-plugin/plugin.json` con integración MCP en `mcp.json`.

### Ejecución local vs alojada

- **Local**: `npx`, instalación global o MCP por stdio. El procesamiento ocurre en tu máquina.
- **Alojada**: `https://openagreements.org/api/mcp`. El llenado de plantillas se ejecuta del lado del servidor para una configuración más rápida.

Elige según la sensibilidad del documento y la política interna. Consulta la trust checklist más abajo para el resumen del flujo de datos.

</details>

## Inicio rápido

### Con Claude Code

Pídele a Claude:

```text
Fill the Common Paper mutual NDA for my company
```

Claude puede descubrir plantillas, entrevistarte para obtener los valores de los campos y generar un DOCX listo para firma.

### Con el CLI

```bash
# See all available templates
open-agreements list

# Fill a template from a JSON data file
open-agreements fill common-paper-mutual-nda -d values.json -o my-nda.docx

# Fill with inline values
open-agreements fill common-paper-mutual-nda --set party_1_name="Acme Corp" --set governing_law="Delaware"
```

### Prompts de ejemplo

- "Draft an NDA for our construction subcontractor"
- "Create a consulting agreement for our insurance agency"
- "Fill the independent contractor agreement for a freelance designer"
- "Generate a SAFE with a $5M valuation cap"

### Qué sucede

1. El agente ejecuta `list --json` para descubrir plantillas y sus campos.
2. Te entrevista para obtener los valores de los campos agrupados por sección.
3. Ejecuta `fill <template>` para generar un DOCX preservando el formato original.
4. Revisas y firmas el documento de salida.

## Instalación

### Agent Skill (recomendado)

```bash
npx skills add open-agreements/open-agreements
```

### MCP remoto

Conecta cualquier agente compatible con MCP al servidor alojado en `https://openagreements.org/api/mcp`.

**Claude Code**

```bash
claude mcp add --transport http open-agreements https://openagreements.org/api/mcp
```

**Codex CLI**

```bash
codex mcp add open-agreements --url https://openagreements.org/api/mcp
```

**Otros agentes** — apunta tu cliente a `https://openagreements.org/api/mcp` (HTTP streameable).

### Extensión Gemini CLI

```bash
gemini extensions install https://github.com/open-agreements/open-agreements
```

### CLI

```bash
npm install -g open-agreements
```

O ejecútalo directamente sin instalación:

```bash
npx -y open-agreements@latest list
```

---

## Documentación

### Empieza aquí

- [Getting Started](https://github.com/open-agreements/open-agreements/blob/main/docs/getting-started.md)

### Guías

- [Adding Templates](https://github.com/open-agreements/open-agreements/blob/main/docs/adding-templates.md)
- [Adding Recipes](https://github.com/open-agreements/open-agreements/blob/main/docs/adding-recipes.md)

### Otros paquetes

- [Contracts Workspace CLI](https://github.com/open-agreements/open-agreements/blob/main/docs/contracts-workspace.md)

### Referencia

- [Licensing](https://github.com/open-agreements/open-agreements/blob/main/docs/licensing.md)
- [Changelog & Release Process](https://github.com/open-agreements/open-agreements/blob/main/docs/changelog-release-process.md)
- [Trust Checklist](https://github.com/open-agreements/open-agreements/blob/main/docs/trust-checklist.md)
- [Supported Tools](https://github.com/open-agreements/open-agreements/blob/main/docs/supported-tools.md)
- [Assumptions](https://github.com/open-agreements/open-agreements/blob/main/docs/assumptions.md)
- [Employment Source Policy](https://github.com/open-agreements/open-agreements/blob/main/docs/employment-source-policy.md)

**Enlaces:** [Sitio web](https://usejunior.com) | [Catálogo de plantillas](https://usejunior.com/templates) | [Docs](https://github.com/open-agreements/open-agreements/tree/main/docs) | [Trust](https://usejunior.com/security) | [npm](https://www.npmjs.com/package/open-agreements)

## Privacidad

- **Modo local** (`npx`, instalación global, MCP por stdio): todo el procesamiento ocurre en tu máquina. No se envía contenido de documentos al exterior.
- **Modo alojado** (`https://openagreements.org/api/mcp`): el llenado de plantillas se ejecuta del lado del servidor. No se almacenan documentos completados después de devolver la respuesta.

Consulta la [Política de privacidad](https://usejunior.com/privacy_policy) para más detalles.

Política de seguridad: consulta [SECURITY.md](https://github.com/open-agreements/open-agreements/blob/main/SECURITY.md).

## Ver también

- [safe-docx](https://github.com/UseJunior/safe-docx) — edición quirúrgica de documentos Word existentes con agentes de programación

## Contribuir

Consulta [CONTRIBUTING.md](https://github.com/open-agreements/open-agreements/blob/main/CONTRIBUTING.md) para saber cómo agregar plantillas, recipes y otras mejoras.

## Construido con OpenAgreements

- [Safe Clause](https://safeclause.deltaxy.ai) — plataforma de contratos impulsada por IA para startups. [#1 en vibecode.law, marzo de 2026](https://vibecode.law/showcase/safe-clause-317416).

¿Construyes algo con OpenAgreements? Abre un PR para añadir tu proyecto.

## Licencia

MIT. El contenido de las plantillas está licenciado por sus respectivos autores:

- CC BY 4.0 para plantillas de Common Paper, Bonterms y de autoría OpenAgreements
- CC BY-ND 4.0 para plantillas SAFE de Y Combinator vendorizadas sin cambios
- propietario o no redistribuible para los documentos fuente de NVCA gestionados mediante flujos de recipes

Consulta el `metadata.yaml` de cada plantilla para detalles específicos de la fuente.

Esta herramienta genera documentos a partir de plantillas estándar. No proporciona asesoría legal. Consulta a un abogado para recibir orientación legal.
