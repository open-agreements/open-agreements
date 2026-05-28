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

> **翻译说明：** 英文版 `README.md` 是规范的事实来源。此翻译可能会有短暂滞后。英文 README 的重大更新应在 72 小时内同步到本文件。

填写标准法律协议模板并生成可签署的 DOCX 文件。OpenAgreements 提供 40 多份模板，涵盖 NDA、云服务协议、雇佣文档、承包商协议、SAFE 以及 NVCA 融资文件。

可与 Claude Code、Gemini CLI、Cursor 以及本地 MCP 或 CLI 工作流配合使用。

## 目录

- [模板](#模板)
- [可用技能](#可用技能)
- [软件包](#软件包)
- [快速开始](#快速开始)
- [安装](#安装)
- [文档](#文档)
- [隐私](#隐私)
- [另请参阅](#另请参阅)
- [贡献](#贡献)
- [基于 OpenAgreements 构建](#基于-openagreements-构建)
- [许可](#许可)

<p align="center">
  <img src="https://raw.githubusercontent.com/open-agreements/open-agreements/main/docs/assets/demo-fill-nda.gif" alt="Fill a Mutual NDA in Claude Code — prompt, answer questions, get a signed-ready DOCX" width="720">
</p>

> *演示：Claude 在 2 分钟内完成一份 Common Paper 双向 NDA。为简洁起见已加速。*

## 模板

Source 列指向上游标准、源文档或规范项目页面（因发布方而异）。License 列显示再分发条款。Repo 链接指向每个模板或配方的 GitHub 内容目录。

### 保密协议

| 模板 | 网站 | 来源 | 许可 | 仓库 |
|----------|---------|--------|---------|------|
| Bonterms Mutual NDA | [Website](https://usejunior.com/templates/bonterms-mutual-nda) | [Bonterms](https://bonterms.com/resources/mutual-nda-cover-page-example) | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/bonterms-mutual-nda) |
| Common Paper Mutual NDA | [Website](https://usejunior.com/templates/common-paper-mutual-nda) | [Common Paper](https://commonpaper.com/standards/mutual-nda/1.0) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-mutual-nda) |
| One Way NDA | [Website](https://usejunior.com/templates/common-paper-one-way-nda) | [Common Paper](https://commonpaper.com/standards/one-way-nda) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-one-way-nda) |

### 销售与授权

| 模板 | 网站 | 来源 | 许可 | 仓库 |
|----------|---------|--------|---------|------|
| Cloud Service Agreement | [Website](https://usejunior.com/templates/common-paper-cloud-service-agreement) | [Common Paper](https://commonpaper.com/standards/cloud-service-agreement/2.1) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-cloud-service-agreement) |
| CSA Click Through | [Website](https://usejunior.com/templates/common-paper-csa-click-through) | [Common Paper](https://commonpaper.com/standards/cloud-service-agreement/2.1) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-csa-click-through) |
| CSA With AI | [Website](https://usejunior.com/templates/common-paper-csa-with-ai) | [Common Paper](https://commonpaper.com/standards/cloud-service-agreement/2.1) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-csa-with-ai) |
| CSA With SLA | [Website](https://usejunior.com/templates/common-paper-csa-with-sla) | [Common Paper](https://commonpaper.com/standards/cloud-service-agreement/2.1) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-csa-with-sla) |
| CSA Without SLA | [Website](https://usejunior.com/templates/common-paper-csa-without-sla) | [Common Paper](https://commonpaper.com/standards/cloud-service-agreement/2.1) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-csa-without-sla) |
| Order Form | [Website](https://usejunior.com/templates/common-paper-order-form) | [Common Paper](https://commonpaper.com/standards/cloud-service-agreement/2.1) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-order-form) |
| Order Form With SLA | [Website](https://usejunior.com/templates/common-paper-order-form-with-sla) | [Common Paper](https://commonpaper.com/standards/cloud-service-agreement/2.1) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-order-form-with-sla) |
| Software License Agreement | [Website](https://usejunior.com/templates/common-paper-software-license-agreement) | [Common Paper](https://commonpaper.com/standards/software-license-agreement/1.1) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-software-license-agreement) |

### 数据与合规

| 模板 | 网站 | 来源 | 许可 | 仓库 |
|----------|---------|--------|---------|------|
| AI Addendum | [Website](https://usejunior.com/templates/common-paper-ai-addendum) | [Common Paper](https://commonpaper.com/standards/ai-addendum/1.0) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-ai-addendum) |
| AI Addendum In App | [Website](https://usejunior.com/templates/common-paper-ai-addendum-in-app) | [Common Paper](https://commonpaper.com/standards/ai-addendum/1.0) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-ai-addendum-in-app) |
| Business Associate Agreement | [Website](https://usejunior.com/templates/common-paper-business-associate-agreement) | [Common Paper](https://commonpaper.com/standards/business-associate-agreement/1.0) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-business-associate-agreement) |
| Data Processing Agreement | [Website](https://usejunior.com/templates/common-paper-data-processing-agreement) | [Common Paper](https://commonpaper.com/standards/data-processing-agreement/1.1) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-data-processing-agreement) |

### 专业服务

| 模板 | 网站 | 来源 | 许可 | 仓库 |
|----------|---------|--------|---------|------|
| Bonterms Professional Services Agreement | [Website](https://usejunior.com/templates/bonterms-professional-services-agreement) | [Bonterms](https://bonterms.com/resources/psa-cover-page-example) | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/bonterms-professional-services-agreement) |
| Independent Contractor Agreement | [Website](https://usejunior.com/templates/common-paper-independent-contractor-agreement) | [Common Paper](https://commonpaper.com/standards/independent-contractor-agreement) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-independent-contractor-agreement) |
| Common Paper Professional Services Agreement | [Website](https://usejunior.com/templates/common-paper-professional-services-agreement) | [Common Paper](https://commonpaper.com/standards/professional-services-agreement/1.1) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-professional-services-agreement) |
| Statement Of Work | [Website](https://usejunior.com/templates/common-paper-statement-of-work) | [Common Paper](https://commonpaper.com/standards/statement-of-work) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-statement-of-work) |

### 交易与合作

| 模板 | 网站 | 来源 | 许可 | 仓库 |
|----------|---------|--------|---------|------|
| Amendment | [Website](https://usejunior.com/templates/common-paper-amendment) | [Common Paper](https://commonpaper.com/standards/amendment) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-amendment) |
| Design Partner Agreement | [Website](https://usejunior.com/templates/common-paper-design-partner-agreement) | [Common Paper](https://commonpaper.com/standards/design-partner-agreement/1.3) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-design-partner-agreement) |
| Letter Of Intent | [Website](https://usejunior.com/templates/common-paper-letter-of-intent) | [Common Paper](https://commonpaper.com/standards/letter-of-intent) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-letter-of-intent) |
| Partnership Agreement | [Website](https://usejunior.com/templates/common-paper-partnership-agreement) | [Common Paper](https://commonpaper.com/standards/partnership-agreement/1.1) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-partnership-agreement) |
| Pilot Agreement | [Website](https://usejunior.com/templates/common-paper-pilot-agreement) | [Common Paper](https://commonpaper.com/standards/pilot-agreement/1.1) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-pilot-agreement) |
| Term Sheet | [Website](https://usejunior.com/templates/common-paper-term-sheet) | [Common Paper](https://commonpaper.com/standards/term-sheet) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/common-paper-term-sheet) |

### 雇佣

| 模板 | 网站 | 来源 | 许可 | 仓库 |
|----------|---------|--------|---------|------|
| Employee IP Inventions Assignment | [Website](https://usejunior.com/templates/openagreements-employee-ip-inventions-assignment) | [OpenAgreements](https://github.com/open-agreements/open-agreements/tree/main/content/templates/openagreements-employee-ip-inventions-assignment) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/openagreements-employee-ip-inventions-assignment) |
| Employment Confidentiality Acknowledgement | [Website](https://usejunior.com/templates/openagreements-employment-confidentiality-acknowledgement) | [OpenAgreements](https://github.com/open-agreements/open-agreements/tree/main/content/templates/openagreements-employment-confidentiality-acknowledgement) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/openagreements-employment-confidentiality-acknowledgement) |
| Employment Offer Letter | [Website](https://usejunior.com/templates/openagreements-employment-offer-letter) | [OpenAgreements](https://github.com/open-agreements/open-agreements/tree/main/content/templates/openagreements-employment-offer-letter) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/openagreements-employment-offer-letter) |
| Restrictive Covenant Wyoming | [Website](https://usejunior.com/templates/openagreements-restrictive-covenant-wyoming) | [OpenAgreements](https://github.com/open-agreements/open-agreements/tree/main/content/templates/openagreements-restrictive-covenant-wyoming) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/openagreements-restrictive-covenant-wyoming) |

### SAFEs

| 模板 | 网站 | 来源 | 许可 | 仓库 |
|----------|---------|--------|---------|------|
| Discount | [Website](https://usejunior.com/templates/yc-safe-discount) | [Y Combinator](https://www.ycombinator.com/documents) | [CC-BY-ND-4.0](https://creativecommons.org/licenses/by-nd/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/external/yc-safe-discount) |
| MFN | [Website](https://usejunior.com/templates/yc-safe-mfn) | [Y Combinator](https://www.ycombinator.com/documents) | [CC-BY-ND-4.0](https://creativecommons.org/licenses/by-nd/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/external/yc-safe-mfn) |
| Pro Rata Side Letter | [Website](https://usejunior.com/templates/yc-safe-pro-rata-side-letter) | [Y Combinator](https://www.ycombinator.com/documents) | [CC-BY-ND-4.0](https://creativecommons.org/licenses/by-nd/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/external/yc-safe-pro-rata-side-letter) |
| Valuation Cap | [Website](https://usejunior.com/templates/yc-safe-valuation-cap) | [Y Combinator](https://www.ycombinator.com/documents) | [CC-BY-ND-4.0](https://creativecommons.org/licenses/by-nd/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/external/yc-safe-valuation-cap) |

### 风险融资

| 模板 | 网站 | 来源 | 许可 | 仓库 |
|----------|---------|--------|---------|------|
| Certificate Of Incorporation | [Website](https://usejunior.com/templates/nvca-certificate-of-incorporation) | [NVCA](https://nvca.org/wp-content/uploads/2025/10/NVCA-Model-COI-10-1-2025.docx) | Recipe | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/recipes/nvca-certificate-of-incorporation) |
| Indemnification Agreement | [Website](https://usejunior.com/templates/nvca-indemnification-agreement) | [NVCA](https://nvca.org/wp-content/uploads/2021/12/NVCA-2020-Indemnification-Agreement.docx) | Recipe | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/recipes/nvca-indemnification-agreement) |
| Investors Rights Agreement | [Website](https://usejunior.com/templates/nvca-investors-rights-agreement) | [NVCA](https://nvca.org/wp-content/uploads/2025/10/NVCA-Model-IRA-10-1-2025-2-1.docx) | Recipe | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/recipes/nvca-investors-rights-agreement) |
| Management Rights Letter | [Website](https://usejunior.com/templates/nvca-management-rights-letter) | [NVCA](https://nvca.org/wp-content/uploads/2025/12/NVCA-2020-Management-Rights-Letter-1-1.docx) | Recipe | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/recipes/nvca-management-rights-letter) |
| ROFR Co Sale Agreement | [Website](https://usejunior.com/templates/nvca-rofr-co-sale-agreement) | [NVCA](https://nvca.org/wp-content/uploads/2025/10/NVCA-Model-ROFRA-10-1-2025.docx) | Recipe | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/recipes/nvca-rofr-co-sale-agreement) |
| Stock Purchase Agreement | [Website](https://usejunior.com/templates/nvca-stock-purchase-agreement) | [NVCA](https://nvca.org/wp-content/uploads/2025/10/NVCA-Model-SPA-10-28-2025-1.docx) | Recipe | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/recipes/nvca-stock-purchase-agreement) |
| Voting Agreement | [Website](https://usejunior.com/templates/nvca-voting-agreement) | [NVCA](https://nvca.org/wp-content/uploads/2024/10/NVCA-Model-VA-10-1-2025.docx) | Recipe | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/recipes/nvca-voting-agreement) |

### 其他

| 模板 | 网站 | 来源 | 许可 | 仓库 |
|----------|---------|--------|---------|------|
| Closing Checklist | [Website](https://usejunior.com/templates/closing-checklist) | [OpenAgreements](https://github.com/open-agreements/open-agreements) | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/closing-checklist) |
| Board Consent SAFE | [Website](https://usejunior.com/templates/openagreements-board-consent-safe) | [OpenAgreements](https://github.com/open-agreements/open-agreements/tree/main/content/templates/openagreements-board-consent-safe) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/openagreements-board-consent-safe) |
| Due Diligence Request List | [Website](https://usejunior.com/templates/openagreements-due-diligence-request-list) | [OpenAgreements](https://github.com/open-agreements/open-agreements/tree/main/content/templates/openagreements-due-diligence-request-list) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/openagreements-due-diligence-request-list) |
| Stockholder Consent SAFE | [Website](https://usejunior.com/templates/openagreements-stockholder-consent-safe) | [OpenAgreements](https://github.com/open-agreements/open-agreements/tree/main/content/templates/openagreements-stockholder-consent-safe) | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/openagreements-stockholder-consent-safe) |
| Working Group List | [Website](https://usejunior.com/templates/working-group-list) | [OpenAgreements](https://github.com/open-agreements/open-agreements) | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | [Repo](https://github.com/open-agreements/open-agreements/tree/main/content/templates/working-group-list) |

## 可用技能

### 协议起草与填写

| 技能 | 描述 |
|-------|-------------|
| [open-agreements](https://github.com/open-agreements/open-agreements/tree/main/skills/open-agreements) | 填写标准法律协议模板（NDA、云服务协议、SAFE）并生成可签署的 DOCX 文件。支持 Common Paper、Bonterms 和 Y Combinator 模板。在用户需要起草法律协议、生成 NDA、填写合同模板或生成 SAFE 时使用。也可通过 DocuSign 发送协议进行电子签署。 |
| [nda](https://github.com/open-agreements/open-agreements/tree/main/skills/nda) | 起草并填写 NDA 模板 — 双向 NDA、单向 NDA、保密协议。从 Common Paper 和 Bonterms 标准表单生成可签署的 DOCX 文件。当用户提到 "NDA"、"保密协议"、"双向 NDA" 或 "单向 NDA" 时使用。 |
| [cloud-service-agreement](https://github.com/open-agreements/open-agreements/tree/main/skills/cloud-service-agreement) | 起草并填写 SaaS 协议模板 — 云合同、MSA、订单表、软件许可、试点协议、设计合作伙伴协议。包含带 SLA 和 AI 条款的变体。从 Common Paper 标准表单生成可签署的 DOCX。当用户提到 "SaaS 协议"、"云合同"、"MSA"、"订单表"、"软件许可"、"试点协议" 或 "设计合作伙伴协议" 时使用。 |
| [services-agreement](https://github.com/open-agreements/open-agreements/tree/main/skills/services-agreement) | 起草并填写服务协议模板 — 咨询合同、承包商协议、SOW、工作说明书、专业服务协议。从 Common Paper 和 Bonterms 标准表单生成可签署的 DOCX 文件。当用户提到 "咨询合同"、"承包商协议"、"SOW"、"工作说明书"、"服务协议" 或 "自由职业者合同" 时使用。 |
| [employment-contract](https://github.com/open-agreements/open-agreements/tree/main/skills/employment-contract) | 起草并填写雇佣协议模板 — 录用函、IP 转让、PIIA、保密承诺书。从 OpenAgreements 标准表单生成可签署的 DOCX 文件，用于雇佣员工。当用户提到 "录用函"、"雇佣协议"、"PIIA"、"IP 转让"、"招人" 或 "入职文件" 时使用。 |
| [data-privacy-agreement](https://github.com/open-agreements/open-agreements/tree/main/skills/data-privacy-agreement) | 起草并填写数据隐私协议模板 — DPA、数据处理协议、GDPR、HIPAA BAA、业务伙伴协议、AI 附录。从 Common Paper 标准表单生成可签署的 DOCX 文件。当用户提到 "DPA"、"数据处理协议"、"HIPAA BAA"、"业务伙伴协议" 或 "AI 附录" 时使用。 |
| [safe](https://github.com/open-agreements/open-agreements/tree/main/skills/safe) | 起草并填写 Y Combinator SAFE 模板 — 估值上限、折扣、MFN、pro rata 边信。可转换股权的标准创业融资文件。生成可签署的 DOCX 文件。当用户提到 "SAFE"、"未来股权简单协议"、"YC SAFE"、"估值上限"、"种子轮文件" 或 "融资文件" 时使用。 |
| [venture-financing](https://github.com/open-agreements/open-agreements/tree/main/skills/venture-financing) | 起草并填写 NVCA 模型文件 — 股票认购协议、公司章程、投资者权利协议、投票协议、ROFR、共售、补偿、管理权利信。Series A 和风险融资模板。生成可签署的 DOCX 文件。当用户提到 "Series A 文件"、"NVCA"、"股票认购协议"、"投资者权利协议"、"投票协议" 或 "风险融资文件" 时使用。 |

### 编辑与客户工作流

| 技能 | 描述 |
|-------|-------------|
| [edit-docx-agreement](https://github.com/open-agreements/open-agreements/tree/main/skills/edit-docx-agreement) | 使用 Safe Docx MCP 工具对由 OpenAgreements 生成的（或任何已有的）DOCX 协议进行定制编辑，实现精准、保留格式的编辑和带修订标记的输出。当用户提到 "编辑此合同"、"修改条款"、"修改协议"、"对 docx 做自定义编辑" 或 "对文档做定制更改" 时使用。 |
| [client-email](https://github.com/open-agreements/open-agreements/tree/main/skills/client-email) | 为法律服务起草面向客户的邮件 — 合同交付件附信、redline 摘要、交易进度更新和跟进。在撰写或修改与法律工作产物相关的对外邮件时使用。触发关键词包括 "起草回复"、"给客户邮件"、"附信"、"回复给"，或任何随法律交付件一同发出的邮件。 |
| [delaware-franchise-tax](https://github.com/open-agreements/open-agreements/tree/main/skills/delaware-franchise-tax) | 申报 Delaware 年度特许经营税和年度报告。引导完成税额计算（授权股份法和假定面值资本法）、eCorp 门户申报流程及付款。适用于 Delaware C-Corp（3 月 1 日截止）和 LLC/LP/GP（6 月 1 日截止）。当用户提到 "Delaware 特许经营税"、"Delaware 年度报告"、"申报特许经营税" 或 "eCorp 门户" 时使用。 |

### 合规与审计

| 技能 | 描述 |
|-------|-------------|
| [soc2-readiness](https://github.com/open-agreements/open-agreements/tree/main/skills/soc2-readiness) | 评估 SOC 2 Type II 准备情况。将信任服务标准映射到控制项，识别差距，并制定整改计划。以 NIST SP 800-53（公有领域）作为规范参考，并与 SOC 2 标准交叉映射。当用户提到 "SOC 2 准备"、"SOC 2 准备工作"、"SOC 2 差距分析" 或 "为 SOC 2 审计做准备" 时使用。 |
| [iso-27001-internal-audit](https://github.com/open-agreements/open-agreements/tree/main/skills/iso-27001-internal-audit) | 运行 ISO 27001 内部审计。按领域逐一审阅控制项，识别差距，收集证据，并生成包含纠正措施建议的发现。以 NIST SP 800-53（公有领域）作为规范参考。当用户提到 "运行内部审计"、"ISO 27001 审计"、"控制评估"、"审计发现" 或 "ISMS 评估" 时使用。 |
| [iso-27001-evidence-collection](https://github.com/open-agreements/open-agreements/tree/main/skills/iso-27001-evidence-collection) | 收集、组织并验证用于 ISO 27001 和 SOC 2 审计的证据。采用 API 优先方式，并为主流云平台提供 CLI 命令。生成带时间戳、审计师可直接使用的证据包。当用户提到 "收集审计证据"、"准备证据包"、"给审计师的证据"、"刷新证据" 或 "证据差距分析" 时使用。 |

### 开发者工作流

| 技能 | 描述 |
|-------|-------------|
| [recipe-quality-audit](https://github.com/open-agreements/open-agreements/tree/main/skills/recipe-quality-audit) | 审计 NVCA 配方质量：检查文件清单、元数据 schema、字段-替换覆盖率、模糊键、智能引号、测试 fixtures 以及填写质量。为每个配方生成带成熟度分级的结构化评分卡。当用户提到 "审计配方质量"、"检查配方覆盖率"、"配方评分卡" 或 "NVCA 配方质量" 时使用。 |
| [unit-test-philosophy](https://github.com/open-agreements/open-agreements/tree/main/skills/unit-test-philosophy) | 面向 open-agreements 的基于风险的单元测试以及 Allure 可读的行为规范风格。当用户提到 "添加测试"、"测试质量"、"扩展覆盖率"、"单元测试风格" 或 "Allure 测试规范" 时使用。适用于在 src、integration-tests 和 workspace 包中添加/更新测试、扩展覆盖率或审查测试质量的场景。 |

### 模板撰写

| 技能 | 描述 |
|-------|-------------|
| [canonical-markdown-authoring](https://github.com/open-agreements/open-agreements/tree/main/skills/canonical-markdown-authoring) | 将普通 markdown 合同草稿转换为 OpenAgreements 的规范 template.md 撰写格式 — YAML frontmatter、Kind\|Label\|Value\|Show When 封面术语表、oa:clause 指令、[[Defined Term]] 段落以及 oa:signer 指令，编译为经过验证的 JSON spec 和 DOCX 产物。当用户提到 "把这个转换为 canonical markdown"、"撰写新的 OpenAgreements 模板"、"将模板迁移到 template.md" 或 "撰写规范形式的合同" 时使用。 |

## 软件包

| 软件包 | 描述 |
|---------|-------------|
| [open-agreements](https://www.npmjs.com/package/open-agreements) | 开源法律模板填写 CLI 和库 |
| [@open-agreements/contract-templates-mcp](https://github.com/open-agreements/open-agreements/blob/main/packages/contract-templates-mcp/README.md) | 用于 OpenAgreements 模板发现与填写的本地 stdio MCP 服务器 |
| [@open-agreements/contracts-workspace](https://github.com/open-agreements/open-agreements/blob/main/packages/contracts-workspace/README.md) | 面向工作区的 CLI，用于组织和跟踪合同仓库 |
| [@open-agreements/contracts-workspace-mcp](https://github.com/open-agreements/open-agreements/blob/main/packages/contracts-workspace-mcp/README.md) | 用于合同工作区操作的本地 stdio MCP 服务器 |
| [@open-agreements/checklist-mcp](https://github.com/open-agreements/open-agreements/blob/main/packages/checklist-mcp/README.md) | 用于 OpenAgreements 清单内存操作的本地 stdio MCP 服务器 |

### 安装包含的内容

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

NVCA 配方模板在运行时下载，不随包一起打包。

<details>
<summary><strong>CLI 参考</strong></summary>

### `list`

显示可用模板及许可证信息与字段数量。

```bash
open-agreements list

# Machine-readable JSON for agent skills and automation
open-agreements list --json
```

### `fill <template>`

基于模板渲染已填写的 DOCX。

```bash
# From a JSON data file
open-agreements fill common-paper-mutual-nda -d data.json -o output.docx

# With inline --set flags
open-agreements fill common-paper-mutual-nda --set party_1_name="Acme Corp" --set governing_law="Delaware"
```

### `validate [template]`

对单个或全部模板运行验证流水线。

```bash
open-agreements validate
open-agreements validate common-paper-mutual-nda
```

</details>

<details>
<summary><strong>代理设置详情</strong></summary>

### Claude Code

```bash
npx skills add open-agreements/open-agreements
```

### Gemini CLI

```bash
gemini extensions install https://github.com/open-agreements/open-agreements
```

### Cursor

本仓库包含位于 `.cursor-plugin/plugin.json` 的 Cursor 插件清单，并在 `mcp.json` 中配置了 MCP 接线。

### 本地与托管执行

- **本地**：`npx`、全局安装或 stdio MCP。所有处理都在你的机器上完成。
- **托管**：`https://openagreements.org/api/mcp`。模板填写在服务器端运行，配置更快。

请根据文档敏感度和内部策略进行选择。数据流概览见下文的信任清单。

</details>

## 快速开始

### 与 Claude Code 配合

向 Claude 提问：

```text
Fill the Common Paper mutual NDA for my company
```

Claude 可以发现模板、向你询问字段值，并生成可签署的 DOCX。

### 与 CLI 配合

```bash
# See all available templates
open-agreements list

# Fill a template from a JSON data file
open-agreements fill common-paper-mutual-nda -d values.json -o my-nda.docx

# Fill with inline values
open-agreements fill common-paper-mutual-nda --set party_1_name="Acme Corp" --set governing_law="Delaware"
```

### 示例提示词

- "为我们的建筑分包商起草一份 NDA"
- "为我们的保险代理公司起草一份咨询协议"
- "为一位自由设计师填写独立承包商协议"
- "生成一份估值上限为 500 万美元的 SAFE"

### 执行过程

1. 代理运行 `list --json` 发现模板及其字段。
2. 按章节分组向你询问字段值。
3. 运行 `fill <template>` 渲染 DOCX，并保留原始格式。
4. 你审核并签署输出文档。

## 安装

### Agent Skill（推荐）

```bash
npx skills add open-agreements/open-agreements
```

### 远程 MCP

将任何兼容 MCP 的代理连接到托管服务器 `https://openagreements.org/api/mcp`。

**Claude Code**

```bash
claude mcp add --transport http open-agreements https://openagreements.org/api/mcp
```

**Codex CLI**

```bash
codex mcp add open-agreements --url https://openagreements.org/api/mcp
```

**其他代理** — 将你的客户端指向 `https://openagreements.org/api/mcp`（streamable HTTP）。

### Gemini CLI 扩展

```bash
gemini extensions install https://github.com/open-agreements/open-agreements
```

### CLI

```bash
npm install -g open-agreements
```

或零安装直接运行：

```bash
npx -y open-agreements@latest list
```

---

## 文档

### 从这里开始

- [Getting Started](https://github.com/open-agreements/open-agreements/blob/main/docs/getting-started.md)

### 指南

- [Adding Templates](https://github.com/open-agreements/open-agreements/blob/main/docs/adding-templates.md)
- [Adding Recipes](https://github.com/open-agreements/open-agreements/blob/main/docs/adding-recipes.md)

### 其他软件包

- [Contracts Workspace CLI](https://github.com/open-agreements/open-agreements/blob/main/docs/contracts-workspace.md)

### 参考

- [Licensing](https://github.com/open-agreements/open-agreements/blob/main/docs/licensing.md)
- [Changelog & Release Process](https://github.com/open-agreements/open-agreements/blob/main/docs/changelog-release-process.md)
- [Trust Checklist](https://github.com/open-agreements/open-agreements/blob/main/docs/trust-checklist.md)
- [Supported Tools](https://github.com/open-agreements/open-agreements/blob/main/docs/supported-tools.md)
- [Assumptions](https://github.com/open-agreements/open-agreements/blob/main/docs/assumptions.md)
- [Employment Source Policy](https://github.com/open-agreements/open-agreements/blob/main/docs/employment-source-policy.md)

**链接：** [Website](https://usejunior.com) | [Template Catalog](https://usejunior.com/templates) | [Docs](https://github.com/open-agreements/open-agreements/tree/main/docs) | [Trust](https://usejunior.com/security) | [npm](https://www.npmjs.com/package/open-agreements)

## 隐私

- **本地模式**（`npx`、全局安装、stdio MCP）：所有处理都在你的机器上完成，不会向外部发送任何文档内容。
- **托管模式**（`https://openagreements.org/api/mcp`）：模板填写在服务器端运行，响应返回后不会存储已填写的文档。

详见 [Privacy Policy](https://usejunior.com/privacy_policy)。

安全政策：请参阅 [SECURITY.md](https://github.com/open-agreements/open-agreements/blob/main/SECURITY.md)。

## 另请参阅

- [safe-docx](https://github.com/UseJunior/safe-docx) — 使用编程代理对现有 Word 文档进行精准编辑

## 贡献

参见 [CONTRIBUTING.md](https://github.com/open-agreements/open-agreements/blob/main/CONTRIBUTING.md) 了解如何添加模板、配方及其他改进。

## 基于 OpenAgreements 构建

- [Safe Clause](https://safeclause.deltaxy.ai) — 面向创业公司的 AI 驱动合同平台。[2026 年 3 月 vibecode.law 第 1 名](https://vibecode.law/showcase/safe-clause-317416)。

正在基于 OpenAgreements 进行构建？提交 PR 添加你的项目。

## Star 历史趋势

[![Star History Chart](https://api.star-history.com/svg?repos=open-agreements/open-agreements&type=Date)](https://star-history.com/#open-agreements/open-agreements&Date)

## 许可

MIT。模板内容按各自作者授权：

- Common Paper、Bonterms 以及 OpenAgreements 撰写的模板采用 CC BY 4.0
- Y Combinator SAFE 模板原样 vendor，采用 CC BY-ND 4.0
- NVCA 源文档通过 recipe 工作流处理，采用专有或不可再分发许可

具体来源详情见每个模板的 `metadata.yaml`。

本工具基于标准模板生成文档，不构成法律建议。请咨询律师以获取法律意见。
