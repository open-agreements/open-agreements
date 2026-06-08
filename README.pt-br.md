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

> **Aviso de tradução:** o `README.md` em inglês é a fonte canônica de verdade. Esta tradução pode ter pequeno atraso. Atualizações importantes do README em inglês devem ser propagadas em até 72 horas.

Preencha modelos padrão de acordos legais e gere arquivos DOCX prontos para assinatura. O OpenAgreements inclui mais de 40 modelos cobrindo NDAs, acordos de serviço em nuvem, documentos de trabalho, acordos com contratados, SAFEs e documentos de financiamento NVCA.

Funciona com Claude Code, Gemini CLI, Cursor e fluxos locais de MCP ou CLI.

## Conteúdo

- [Modelos Disponíveis](#modelos-disponíveis)
- [Skills Disponíveis](#skills-disponíveis)
- [Pacotes](#pacotes)
- [Início Rápido](#início-rápido)
- [Instalação](#instalação)
- [Documentação](#documentação)
- [Privacidade](#privacidade)
- [Veja Também](#veja-também)
- [Contribuindo](#contribuindo)
- [Construído com OpenAgreements](#construído-com-openagreements)
- [Licença](#licença)

<p align="center">
  <img src="https://raw.githubusercontent.com/open-agreements/open-agreements/main/docs/assets/demo-fill-nda.gif" alt="Fill a Mutual NDA in Claude Code — prompt, answer questions, get a signed-ready DOCX" width="720">
</p>

> *Demo: Claude preenche um NDA mútuo da Common Paper em menos de 2 minutos. Acelerado para brevidade.*

## Modelos Disponíveis

A coluna Fonte aponta para o padrão upstream, documento de origem ou página canônica do projeto (varia por editor). A coluna Licença mostra os termos de redistribuição. Os links de Repo apontam para o diretório de conteúdo no GitHub de cada modelo ou recipe.

### Confidencialidade

| Modelo | Site | Fonte | Licença | Repo |
|----------|---------|--------|---------|------|
| Bonterms Mutual NDA | [Site](https://usejunior.com/templates/bonterms-mutual-nda) | [Bonterms](https://bonterms.com/resources/mutual-nda-cover-page-example) | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/bonterms-mutual-nda) |
| Common Paper Mutual NDA | [Site](https://usejunior.com/templates/common-paper-mutual-nda) | [Common Paper](https://commonpaper.com/standards/mutual-nda/1.0) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-mutual-nda) |
| One Way NDA | [Site](https://usejunior.com/templates/common-paper-one-way-nda) | [Common Paper](https://commonpaper.com/standards/one-way-nda) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-one-way-nda) |

### Vendas e Licenciamento

| Modelo | Site | Fonte | Licença | Repo |
|----------|---------|--------|---------|------|
| Cloud Service Agreement | [Site](https://usejunior.com/templates/common-paper-cloud-service-agreement) | [Common Paper](https://commonpaper.com/standards/cloud-service-agreement/2.1) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-cloud-service-agreement) |
| CSA Click Through | [Site](https://usejunior.com/templates/common-paper-csa-click-through) | [Common Paper](https://commonpaper.com/standards/cloud-service-agreement/2.1) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-csa-click-through) |
| CSA With AI | [Site](https://usejunior.com/templates/common-paper-csa-with-ai) | [Common Paper](https://commonpaper.com/standards/cloud-service-agreement/2.1) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-csa-with-ai) |
| CSA With SLA | [Site](https://usejunior.com/templates/common-paper-csa-with-sla) | [Common Paper](https://commonpaper.com/standards/cloud-service-agreement/2.1) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-csa-with-sla) |
| CSA Without SLA | [Site](https://usejunior.com/templates/common-paper-csa-without-sla) | [Common Paper](https://commonpaper.com/standards/cloud-service-agreement/2.1) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-csa-without-sla) |
| Order Form | [Site](https://usejunior.com/templates/common-paper-order-form) | [Common Paper](https://commonpaper.com/standards/cloud-service-agreement/2.1) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-order-form) |
| Order Form With SLA | [Site](https://usejunior.com/templates/common-paper-order-form-with-sla) | [Common Paper](https://commonpaper.com/standards/cloud-service-agreement/2.1) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-order-form-with-sla) |
| Software License Agreement | [Site](https://usejunior.com/templates/common-paper-software-license-agreement) | [Common Paper](https://commonpaper.com/standards/software-license-agreement/1.1) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-software-license-agreement) |

### Dados e Conformidade

| Modelo | Site | Fonte | Licença | Repo |
|----------|---------|--------|---------|------|
| AI Addendum | [Site](https://usejunior.com/templates/common-paper-ai-addendum) | [Common Paper](https://commonpaper.com/standards/ai-addendum/1.0) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-ai-addendum) |
| AI Addendum In App | [Site](https://usejunior.com/templates/common-paper-ai-addendum-in-app) | [Common Paper](https://commonpaper.com/standards/ai-addendum/1.0) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-ai-addendum-in-app) |
| Business Associate Agreement | [Site](https://usejunior.com/templates/common-paper-business-associate-agreement) | [Common Paper](https://commonpaper.com/standards/business-associate-agreement/1.0) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-business-associate-agreement) |
| Data Processing Agreement | [Site](https://usejunior.com/templates/common-paper-data-processing-agreement) | [Common Paper](https://commonpaper.com/standards/data-processing-agreement/1.1) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-data-processing-agreement) |

### Serviços Profissionais

| Modelo | Site | Fonte | Licença | Repo |
|----------|---------|--------|---------|------|
| Bonterms Professional Services Agreement | [Site](https://usejunior.com/templates/bonterms-professional-services-agreement) | [Bonterms](https://bonterms.com/resources/psa-cover-page-example) | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/bonterms-professional-services-agreement) |
| Independent Contractor Agreement | [Site](https://usejunior.com/templates/common-paper-independent-contractor-agreement) | [Common Paper](https://commonpaper.com/standards/independent-contractor-agreement) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-independent-contractor-agreement) |
| Common Paper Professional Services Agreement | [Site](https://usejunior.com/templates/common-paper-professional-services-agreement) | [Common Paper](https://commonpaper.com/standards/professional-services-agreement/1.1) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-professional-services-agreement) |
| Statement Of Work | [Site](https://usejunior.com/templates/common-paper-statement-of-work) | [Common Paper](https://commonpaper.com/standards/statement-of-work) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-statement-of-work) |

### Negócios e Parcerias

| Modelo | Site | Fonte | Licença | Repo |
|----------|---------|--------|---------|------|
| Amendment | [Site](https://usejunior.com/templates/common-paper-amendment) | [Common Paper](https://commonpaper.com/standards/amendment) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-amendment) |
| Design Partner Agreement | [Site](https://usejunior.com/templates/common-paper-design-partner-agreement) | [Common Paper](https://commonpaper.com/standards/design-partner-agreement/1.3) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-design-partner-agreement) |
| Letter Of Intent | [Site](https://usejunior.com/templates/common-paper-letter-of-intent) | [Common Paper](https://commonpaper.com/standards/letter-of-intent) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-letter-of-intent) |
| Partnership Agreement | [Site](https://usejunior.com/templates/common-paper-partnership-agreement) | [Common Paper](https://commonpaper.com/standards/partnership-agreement/1.1) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-partnership-agreement) |
| Pilot Agreement | [Site](https://usejunior.com/templates/common-paper-pilot-agreement) | [Common Paper](https://commonpaper.com/standards/pilot-agreement/1.1) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-pilot-agreement) |
| Term Sheet | [Site](https://usejunior.com/templates/common-paper-term-sheet) | [Common Paper](https://commonpaper.com/standards/term-sheet) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-term-sheet) |

### Emprego

| Modelo | Site | Fonte | Licença | Repo |
|----------|---------|--------|---------|------|
| Employee IP Inventions Assignment | [Site](https://usejunior.com/templates/openagreements-employee-ip-inventions-assignment) | [OpenAgreements](https://github.com/open-agreements/open-agreements/tree/main/content/templates/openagreements-employee-ip-inventions-assignment) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/openagreements-employee-ip-inventions-assignment) |
| Employment Confidentiality Acknowledgement | [Site](https://usejunior.com/templates/openagreements-employment-confidentiality-acknowledgement) | [OpenAgreements](https://github.com/open-agreements/open-agreements/tree/main/content/templates/openagreements-employment-confidentiality-acknowledgement) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/openagreements-employment-confidentiality-acknowledgement) |
| Employment Offer Letter | [Site](https://usejunior.com/templates/openagreements-employment-offer-letter) | [OpenAgreements](https://github.com/open-agreements/open-agreements/tree/main/content/templates/openagreements-employment-offer-letter) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/openagreements-employment-offer-letter) |
| Restrictive Covenant Wyoming | [Site](https://usejunior.com/templates/openagreements-restrictive-covenant-wyoming) | [OpenAgreements](https://github.com/open-agreements/open-agreements/tree/main/content/templates/openagreements-restrictive-covenant-wyoming) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/openagreements-restrictive-covenant-wyoming) |

### SAFEs

| Modelo | Site | Fonte | Licença | Repo |
|----------|---------|--------|---------|------|
| Discount | [Site](https://usejunior.com/templates/yc-safe-discount) | [Y Combinator](https://www.ycombinator.com/documents) | [CC-BY-ND-4.0](https://creativecommons.org/licenses/by-nd/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/external/yc-safe-discount) |
| MFN | [Site](https://usejunior.com/templates/yc-safe-mfn) | [Y Combinator](https://www.ycombinator.com/documents) | [CC-BY-ND-4.0](https://creativecommons.org/licenses/by-nd/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/external/yc-safe-mfn) |
| Pro Rata Side Letter | [Site](https://usejunior.com/templates/yc-safe-pro-rata-side-letter) | [Y Combinator](https://www.ycombinator.com/documents) | [CC-BY-ND-4.0](https://creativecommons.org/licenses/by-nd/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/external/yc-safe-pro-rata-side-letter) |
| Valuation Cap | [Site](https://usejunior.com/templates/yc-safe-valuation-cap) | [Y Combinator](https://www.ycombinator.com/documents) | [CC-BY-ND-4.0](https://creativecommons.org/licenses/by-nd/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/external/yc-safe-valuation-cap) |

### Financiamento de Venture Capital

| Modelo | Site | Fonte | Licença | Repo |
|----------|---------|--------|---------|------|
| Certificate Of Incorporation | [Site](https://usejunior.com/templates/nvca-certificate-of-incorporation) | [NVCA](https://nvca.org/wp-content/uploads/2025/10/NVCA-Model-COI-10-1-2025.docx) | Recipe | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/recipes/nvca-certificate-of-incorporation) |
| Indemnification Agreement | [Site](https://usejunior.com/templates/nvca-indemnification-agreement) | [NVCA](https://nvca.org/wp-content/uploads/2021/12/NVCA-2020-Indemnification-Agreement.docx) | Recipe | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/recipes/nvca-indemnification-agreement) |
| Investors Rights Agreement | [Site](https://usejunior.com/templates/nvca-investors-rights-agreement) | [NVCA](https://nvca.org/wp-content/uploads/2025/10/NVCA-Model-IRA-10-1-2025-2-1.docx) | Recipe | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/recipes/nvca-investors-rights-agreement) |
| Management Rights Letter | [Site](https://usejunior.com/templates/nvca-management-rights-letter) | [NVCA](https://nvca.org/wp-content/uploads/2025/12/NVCA-2020-Management-Rights-Letter-1-1.docx) | Recipe | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/recipes/nvca-management-rights-letter) |
| ROFR Co Sale Agreement | [Site](https://usejunior.com/templates/nvca-rofr-co-sale-agreement) | [NVCA](https://nvca.org/wp-content/uploads/2025/10/NVCA-Model-ROFRA-10-1-2025.docx) | Recipe | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/recipes/nvca-rofr-co-sale-agreement) |
| Stock Purchase Agreement | [Site](https://usejunior.com/templates/nvca-stock-purchase-agreement) | [NVCA](https://nvca.org/wp-content/uploads/2025/10/NVCA-Model-SPA-10-28-2025-1.docx) | Recipe | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/recipes/nvca-stock-purchase-agreement) |
| Voting Agreement | [Site](https://usejunior.com/templates/nvca-voting-agreement) | [NVCA](https://nvca.org/wp-content/uploads/2024/10/NVCA-Model-VA-10-1-2025.docx) | Recipe | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/recipes/nvca-voting-agreement) |

### Outros

| Modelo | Site | Fonte | Licença | Repo |
|----------|---------|--------|---------|------|
| Closing Checklist | [Site](https://usejunior.com/templates/closing-checklist) | [OpenAgreements](https://github.com/open-agreements/open-agreements) | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/closing-checklist) |
| Board Consent SAFE | [Site](https://usejunior.com/templates/openagreements-board-consent-safe) | [OpenAgreements](https://github.com/open-agreements/open-agreements/tree/main/content/templates/openagreements-board-consent-safe) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/openagreements-board-consent-safe) |
| Due Diligence Request List | [Site](https://usejunior.com/templates/openagreements-due-diligence-request-list) | [OpenAgreements](https://github.com/open-agreements/open-agreements/tree/main/content/templates/openagreements-due-diligence-request-list) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/openagreements-due-diligence-request-list) |
| Stockholder Consent SAFE | [Site](https://usejunior.com/templates/openagreements-stockholder-consent-safe) | [OpenAgreements](https://github.com/open-agreements/open-agreements/tree/main/content/templates/openagreements-stockholder-consent-safe) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/openagreements-stockholder-consent-safe) |
| Working Group List | [Site](https://usejunior.com/templates/working-group-list) | [OpenAgreements](https://github.com/open-agreements/open-agreements) | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/working-group-list) |

## Skills Disponíveis

### Redação e Preenchimento de Acordos

| Skill | Descrição |
|-------|-------------|
| [open-agreements](https://github.com/open-agreements/open-agreements/tree/main/skills/open-agreements) | Preencha modelos padrão de acordos legais (NDAs, acordos de serviço em nuvem, SAFEs) e gere arquivos DOCX prontos para assinatura. Suporta modelos da Common Paper, Bonterms e Y Combinator. Use quando o usuário precisar redigir um acordo legal, criar um NDA, preencher um modelo de contrato ou gerar um SAFE. Também pode enviar acordos para assinatura eletrônica via DocuSign. |
| [nda](https://github.com/open-agreements/open-agreements/tree/main/skills/nda) | Redija e preencha modelos de NDA — NDA mútuo, NDA unilateral, acordo de confidencialidade. Gera arquivos DOCX prontos para assinatura a partir de formulários padrão da Common Paper e Bonterms. Use quando o usuário disser "NDA", "acordo de não divulgação", "acordo de confidencialidade", "NDA mútuo" ou "NDA unilateral". |
| [cloud-service-agreement](https://github.com/open-agreements/open-agreements/tree/main/skills/cloud-service-agreement) | Redija e preencha modelos de acordo SaaS — contrato de nuvem, MSA, formulário de pedido, licença de software, acordo piloto, acordo de parceiro de design. Inclui variantes com SLAs e termos de IA. Gera DOCX pronto para assinatura a partir de formulários padrão da Common Paper. Use quando o usuário disser "acordo SaaS", "contrato de nuvem", "MSA", "formulário de pedido", "licença de software", "acordo piloto" ou "acordo de parceiro de design". |
| [services-agreement](https://github.com/open-agreements/open-agreements/tree/main/skills/services-agreement) | Redija e preencha modelos de acordo de serviços — contrato de consultoria, acordo de contratado, SOW, statement of work, acordo de serviços profissionais. Gera arquivos DOCX prontos para assinatura a partir de formulários padrão da Common Paper e Bonterms. Use quando o usuário disser "contrato de consultoria", "acordo de contratado", "SOW", "statement of work", "acordo de serviços" ou "contrato de freelancer". |
| [employment-contract](https://github.com/open-agreements/open-agreements/tree/main/skills/employment-contract) | Redija e preencha modelos de acordo de trabalho — carta-proposta, cessão de PI, PIIA, declaração de confidencialidade. Gera arquivos DOCX prontos para assinatura a partir de formulários padrão do OpenAgreements para contratação de funcionários. Use quando o usuário disser "carta-proposta", "acordo de trabalho", "PIIA", "cessão de PI", "contratar alguém" ou "documentação de onboarding". |
| [data-privacy-agreement](https://github.com/open-agreements/open-agreements/tree/main/skills/data-privacy-agreement) | Redija e preencha modelos de acordo de privacidade de dados — DPA, acordo de processamento de dados, GDPR, HIPAA BAA, acordo de associado comercial, adendo de IA. Gera arquivos DOCX prontos para assinatura a partir de formulários padrão da Common Paper. Use quando o usuário disser "DPA", "acordo de processamento de dados", "HIPAA BAA", "acordo de associado comercial" ou "adendo de IA". |
| [safe](https://github.com/open-agreements/open-agreements/tree/main/skills/safe) | Redija e preencha modelos de SAFE do Y Combinator — valuation cap, discount, MFN, pro rata side letter. Documentos padrão de captação para startups, voltados para equity conversível. Gera arquivos DOCX prontos para assinatura. Use quando o usuário disser "SAFE", "simple agreement for future equity", "YC SAFE", "valuation cap", "documentos de seed round" ou "papelada de fundraising". |
| [venture-financing](https://github.com/open-agreements/open-agreements/tree/main/skills/venture-financing) | Redija e preencha documentos modelo da NVCA — stock purchase agreement, certificate of incorporation, investors rights agreement, voting agreement, ROFR, co-sale, indenização, management rights letter. Modelos de Series A e financiamento de venture capital. Gera arquivos DOCX prontos para assinatura. Use quando o usuário disser "documentos de Series A", "NVCA", "stock purchase agreement", "investors rights agreement", "voting agreement" ou "documentos de financiamento de venture". |

### Edição e Fluxos com Clientes

| Skill | Descrição |
|-------|-------------|
| [edit-docx-agreement](https://github.com/open-agreements/open-agreements/tree/main/skills/edit-docx-agreement) | Faça edições sob medida em um acordo DOCX gerado pelo OpenAgreements (ou qualquer DOCX existente), usando ferramentas MCP do Safe Docx para edições cirúrgicas que preservam a formatação e saídas com track changes. Use quando o usuário disser "editar este contrato", "alterar uma cláusula", "modificar o acordo", "edições personalizadas no docx" ou "alterações sob medida no documento". |
| [client-email](https://github.com/open-agreements/open-agreements/tree/main/skills/client-email) | Redija e-mails voltados ao cliente para serviços jurídicos — cover notes para entregas de contratos, resumos de redlines, atualizações de status do deal e follow-ups. Use ao compor ou revisar e-mails de saída para clientes sobre trabalho jurídico. Disparado por "redigir resposta", "e-mail para cliente", "cover note", "responder para" ou qualquer e-mail de saída acompanhando uma entrega jurídica. |
| [delaware-franchise-tax](https://github.com/open-agreements/open-agreements/tree/main/skills/delaware-franchise-tax) | Faça a declaração anual do Delaware franchise tax e do annual report. Orienta no cálculo do imposto (métodos Authorized Shares e Assumed Par Value Capital), no processo de submissão pelo portal eCorp e no pagamento. Para Delaware C-Corps (prazo 1 de março) e LLCs/LPs/GPs (prazo 1 de junho). Use quando o usuário disser "Delaware franchise tax", "annual report Delaware", "declarar franchise tax" ou "portal eCorp". |

### Conformidade e Auditoria

| Skill | Descrição |
|-------|-------------|
| [soc2-readiness](https://github.com/open-agreements/open-agreements/tree/main/skills/soc2-readiness) | Avalie a prontidão para SOC 2 Type II. Mapeie Trust Services Criteria para controles, identifique gaps e construa um plano de remediação. Usa NIST SP 800-53 (domínio público) como referência canônica com mapeamento cruzado para critérios SOC 2. Use quando o usuário disser "prontidão para SOC 2", "preparação para SOC 2", "análise de gaps SOC 2" ou "preparar para auditoria SOC 2". |
| [iso-27001-internal-audit](https://github.com/open-agreements/open-agreements/tree/main/skills/iso-27001-internal-audit) | Conduza uma auditoria interna ISO 27001. Percorra controles por domínio, identifique gaps, colete evidências e gere achados com recomendações de ações corretivas. Usa NIST SP 800-53 (domínio público) como referência canônica. Use quando o usuário disser "rodar auditoria interna", "auditoria ISO 27001", "avaliação de controles", "achados de auditoria" ou "avaliação de ISMS". |
| [iso-27001-evidence-collection](https://github.com/open-agreements/open-agreements/tree/main/skills/iso-27001-evidence-collection) | Colete, organize e valide evidências para auditorias ISO 27001 e SOC 2. Abordagem API-first com comandos CLI para grandes plataformas em nuvem. Gera pacotes de evidência com timestamp prontos para auditor. Use quando o usuário disser "coletar evidências de auditoria", "preparar pacote de evidências", "evidências para o auditor", "atualizar evidências" ou "análise de gaps de evidências". |

### Fluxos para Desenvolvedores

| Skill | Descrição |
|-------|-------------|
| [recipe-quality-audit](https://github.com/open-agreements/open-agreements/tree/main/skills/recipe-quality-audit) | Audite a qualidade de recipes da NVCA: verifique o inventário de arquivos, o schema de metadados, a cobertura de campos para substituições, chaves ambíguas, smart quotes, fixtures de teste e qualidade de preenchimento. Gera um scorecard estruturado por recipe com classificação de nível de maturidade. Use quando o usuário disser "auditar qualidade de recipe", "verificar cobertura de recipe", "scorecard de recipe" ou "qualidade de recipe NVCA". |
| [unit-test-philosophy](https://github.com/open-agreements/open-agreements/tree/main/skills/unit-test-philosophy) | Testes unitários baseados em risco e estilo de spec comportamental legível pelo Allure para o open-agreements. Use quando o usuário disser "adicionar testes", "qualidade dos testes", "expansão de cobertura", "estilo de teste unitário" ou "spec de teste Allure". Aplica-se ao adicionar/atualizar testes, expandir cobertura ou revisar a qualidade de testes em src, integration-tests e pacotes do workspace. |

### Autoria de Modelos

| Skill | Descrição |
|-------|-------------|
| [canonical-markdown-authoring](https://github.com/open-agreements/open-agreements/tree/main/skills/canonical-markdown-authoring) | Converta rascunhos de contratos em markdown comum para o formato canônico template.md do OpenAgreements — frontmatter YAML, tabelas de termos da capa Kind|Label|Value|Show When, diretivas oa:clause, parágrafos com [[Termo Definido]] e diretivas oa:signer que compilam para JSON specs validados e artefatos DOCX. Use quando o usuário disser "converter isto para markdown canônico", "criar um novo modelo OpenAgreements", "migrar modelo para template.md" ou "escrever um contrato em formato canônico". |

## Pacotes

| Pacote | Descrição |
|---------|-------------|
| [open-agreements](https://www.npmjs.com/package/open-agreements) | CLI e biblioteca open-source para preenchimento de modelos legais |
| [@open-agreements/contract-templates-mcp](https://github.com/open-agreements/open-agreements/blob/main/packages/contract-templates-mcp/README.md) | Servidor MCP local por stdio para descoberta e preenchimento de modelos do OpenAgreements |
| [@open-agreements/contracts-workspace](https://github.com/open-agreements/open-agreements/blob/main/packages/contracts-workspace/README.md) | CLI orientado a workspace para organizar e acompanhar repositórios de contratos |
| [@open-agreements/contracts-workspace-mcp](https://github.com/open-agreements/open-agreements/blob/main/packages/contracts-workspace-mcp/README.md) | Servidor MCP local por stdio para operações de contracts workspace |
| [@open-agreements/checklist-mcp](https://github.com/open-agreements/open-agreements/blob/main/packages/checklist-mcp/README.md) | Servidor MCP local por stdio para operações de memória de checklist do OpenAgreements |

### O Que É Instalado

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

Os modelos de recipe da NVCA são baixados em tempo de execução e não são empacotados no pacote.

<details>
<summary><strong>Referência da CLI</strong></summary>

### `list`

Mostra modelos disponíveis com informações de licença e contagem de campos.

```bash
open-agreements list

# Machine-readable JSON for agent skills and automation
open-agreements list --json
```

### `fill <template>`

Renderiza um DOCX preenchido a partir de um modelo.

```bash
# From a JSON data file
open-agreements fill common-paper-mutual-nda -d data.json -o output.docx

# With inline --set flags
open-agreements fill common-paper-mutual-nda --set party_1_name="Acme Corp" --set governing_law="Delaware"
```

### `validate [template]`

Executa o pipeline de validação em um ou todos os modelos.

```bash
open-agreements validate
open-agreements validate common-paper-mutual-nda
```

</details>

<details>
<summary><strong>Detalhes de Configuração do Agente</strong></summary>

### Claude Code

```bash
npx skills add open-agreements/open-agreements
```

### Gemini CLI

```bash
gemini extensions install https://github.com/open-agreements/open-agreements
```

### Cursor

Este repositório inclui um manifesto de plugin do Cursor em `.cursor-plugin/plugin.json` com integração MCP em `mcp.json`.

### Execução Local vs Hospedada

- **Local**: `npx`, instalação global ou MCP por stdio. O processamento acontece na sua máquina.
- **Hospedado**: `https://openagreements.org/api/mcp`. O preenchimento de modelos roda do lado do servidor para um setup mais rápido.

Escolha com base na sensibilidade do documento e na política interna. Veja a trust checklist abaixo para um resumo do fluxo de dados.

</details>

## Início Rápido

### Com Claude Code

Peça ao Claude:

```text
Fill the Common Paper mutual NDA for my company
```

O Claude pode descobrir modelos, entrevistar você para valores de campos e gerar um DOCX pronto para assinatura.

### Com a CLI

```bash
# See all available templates
open-agreements list

# Fill a template from a JSON data file
open-agreements fill common-paper-mutual-nda -d values.json -o my-nda.docx

# Fill with inline values
open-agreements fill common-paper-mutual-nda --set party_1_name="Acme Corp" --set governing_law="Delaware"
```

### Exemplos de Prompts

- "Redija um NDA para nosso subcontratado de construção"
- "Crie um acordo de consultoria para nossa agência de seguros"
- "Preencha o acordo de contratado independente para um designer freelancer"
- "Gere um SAFE com valuation cap de $5M"

### O Que Acontece

1. O agente roda `list --json` para descobrir modelos e seus campos.
2. Ele entrevista você para coletar valores de campos agrupados por seção.
3. Ele roda `fill <template>` para gerar um DOCX preservando a formatação de origem.
4. Você revisa e assina o documento de saída.

## Instalação

### Agent Skill (recomendado)

```bash
npx skills add open-agreements/open-agreements
```

### MCP Remoto

Conecte qualquer agente compatível com MCP ao servidor hospedado em `https://openagreements.org/api/mcp`.

**Claude Code**

```bash
claude mcp add --transport http open-agreements https://openagreements.org/api/mcp
```

**Codex CLI**

```bash
codex mcp add open-agreements --url https://openagreements.org/api/mcp
```

**Outros agentes** — aponte seu cliente para `https://openagreements.org/api/mcp` (streamable HTTP).

### Extensão Gemini CLI

```bash
gemini extensions install https://github.com/open-agreements/open-agreements
```

### CLI

```bash
npm install -g open-agreements
```

Ou rode diretamente sem instalar nada:

```bash
npx -y open-agreements@latest list
```

---

## Documentação

### Comece Aqui

- [Getting Started](https://github.com/open-agreements/open-agreements/blob/main/docs/getting-started.md)

### Guias

- [Adding Templates](https://github.com/open-agreements/open-agreements/blob/main/docs/adding-templates.md)
- [Adding Recipes](https://github.com/open-agreements/open-agreements/blob/main/docs/adding-recipes.md)

### Outros Pacotes

- [Contracts Workspace CLI](https://github.com/open-agreements/open-agreements/blob/main/docs/contracts-workspace.md)

### Referência

- [Licensing](https://github.com/open-agreements/open-agreements/blob/main/docs/licensing.md)
- [Changelog & Release Process](https://github.com/open-agreements/open-agreements/blob/main/docs/changelog-release-process.md)
- [Trust Checklist](https://github.com/open-agreements/open-agreements/blob/main/docs/trust-checklist.md)
- [Supported Tools](https://github.com/open-agreements/open-agreements/blob/main/docs/supported-tools.md)
- [Assumptions](https://github.com/open-agreements/open-agreements/blob/main/docs/assumptions.md)
- [Employment Source Policy](https://github.com/open-agreements/open-agreements/blob/main/docs/employment-source-policy.md)

**Links:** [Site](https://usejunior.com) | [Catálogo de Modelos](https://usejunior.com/templates) | [Docs](https://github.com/open-agreements/open-agreements/tree/main/docs) | [Trust](https://usejunior.com/security) | [npm](https://www.npmjs.com/package/open-agreements)

## Privacidade

- **Modo local** (`npx`, instalação global, MCP por stdio): todo o processamento acontece na sua máquina. Nenhum conteúdo de documento é enviado para fora.
- **Modo hospedado** (`https://openagreements.org/api/mcp`): o preenchimento de modelos roda do lado do servidor. Nenhum documento preenchido é armazenado depois que a resposta é retornada.

Veja a [Política de Privacidade](https://usejunior.com/privacy_policy) para detalhes.

Política de segurança: veja [SECURITY.md](https://github.com/open-agreements/open-agreements/blob/main/SECURITY.md).

## Veja Também

- [safe-docx](https://github.com/UseJunior/safe-docx) — edição cirúrgica de documentos Word existentes com agentes de código

## Contribuindo

Veja [CONTRIBUTING.md](https://github.com/open-agreements/open-agreements/blob/main/CONTRIBUTING.md) para saber como adicionar modelos, recipes e outras melhorias.

## Construído com OpenAgreements

- [Safe Clause](https://safeclause.deltaxy.ai) — plataforma de contratos com IA para startups. [#1 no vibecode.law, março de 2026](https://vibecode.law/showcase/safe-clause-317416).

Está construindo algo sobre o OpenAgreements? Abra um PR para adicionar seu projeto.

## Histórico de estrelas

[![Star History Chart](https://api.star-history.com/svg?repos=open-agreements/open-agreements&type=Date)](https://star-history.com/#open-agreements/open-agreements&Date)

## Licença

MIT. O conteúdo dos modelos é licenciado por seus respectivos autores:

- CC BY 4.0 para modelos da Common Paper, Bonterms e modelos autorais do OpenAgreements
- CC BY-ND 4.0 para modelos de SAFE do Y Combinator vendorizados sem alterações
- proprietário ou não redistribuível para documentos de origem da NVCA tratados via recipes

Veja o `metadata.yaml` de cada modelo para detalhes específicos da fonte.

Esta ferramenta gera documentos a partir de modelos padrão. Ela não fornece assessoria jurídica. Consulte um advogado para orientação jurídica.
