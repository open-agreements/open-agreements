# OpenAgreements

[![npm version](https://img.shields.io/npm/v/open-agreements)](https://www.npmjs.com/package/open-agreements)
[![npm downloads](https://img.shields.io/npm/dm/open-agreements.svg)](https://npmjs.org/package/open-agreements)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Agent Skill](https://img.shields.io/badge/agent--skill-open--agreements-purple)](https://skills.sh)
[![CI](https://github.com/open-agreements/open-agreements/actions/workflows/ci.yml/badge.svg)](https://github.com/open-agreements/open-agreements/actions/workflows/ci.yml)
[![MCP Server Status](https://img.shields.io/endpoint?url=https%3A%2F%2Fopenagreements.ai%2Fapi%2Fstatus%3Fformat%3Dshields)](https://openagreements.openstatus.dev/)
[![codecov](https://img.shields.io/codecov/c/github/open-agreements/open-agreements/main)](https://app.codecov.io/gh/open-agreements/open-agreements)
[![GitHub stargazers](https://img.shields.io/github/stars/open-agreements/open-agreements?style=social)](https://github.com/open-agreements/open-agreements/stargazers)
[![Tests: Vitest](https://img.shields.io/badge/tests-vitest-6E9F18)](https://vitest.dev/)
[![OpenSpec Traceability](https://img.shields.io/badge/openspec-traceability%20gate-brightgreen)](./scripts/validate_openspec_coverage.mjs)
[![Socket Badge](https://socket.dev/api/badge/npm/package/open-agreements)](https://socket.dev/npm/package/open-agreements)
[![install size](https://packagephobia.com/badge?p=open-agreements)](https://packagephobia.com/result?p=open-agreements)

[English](./README.md) | [Español](./README.es.md) | [简体中文](./README.zh.md) | [Português (Brasil)](./README.pt-br.md) | [Deutsch](./README.de.md)

> **翻译说明：** 英文版 `README.md` 是规范的事实来源。此翻译可能会有短暂滞后。英文 README 的重大更新应在 72 小时内同步到本文件。

<!-- TODO: Add OpenSSF Scorecard badge once repo is indexed at securityscorecards.dev -->
<!-- TODO: Add OpenSSF Best Practices badge after registration at bestpractices.dev -->
<!-- TODO: Re-evaluate Snyk badge — Advisor migrated to security.snyk.io (July 2024) -->

<p align="center">
  <img src="docs/assets/demo-fill-nda.gif" alt="Fill a Mutual NDA in Claude Code — prompt, answer questions, get a signed-ready DOCX" width="720">
</p>

> *演示：Claude 在 2 分钟内完成一份 Common Paper 双向 NDA。为简洁起见已加速。*

填写标准法律协议模板并生成可签署的 DOCX 文件。模板涵盖 NDA、云服务条款、雇佣文档、承包商协议、SAFE 以及 NVCA 融资文件。

由 [UseJunior.com](https://usejunior.com) 背后团队构建，已在 Am Law 100 律所中投入生产使用。

## 质量与可信信号

- CI 会在 pull request 以及推送到 `main` 时运行。
- 实时服务健康状态通过 OpenStatus 在 `openagreements.openstatus.dev` 发布。
- 覆盖率发布到 Codecov，并在 `codecov.yml` 中使用仓库定义的 patch/project 门禁。
- 当前 JS 测试框架是 Vitest，JUnit 测试结果会上传到 Codecov 进行测试分析。
- OpenSpec 场景可追溯性通过 `npm run check:spec-coverage` 强制执行。若要导出本地矩阵，请运行 `npm run check:spec-coverage -- --write-matrix integration-tests/OPENSPEC_TRACEABILITY.md`。
- 配方源漂移 canary（`npm run check:source-drift`）会校验预期源哈希，以及结构化替换/规范化锚点。
- 假设级回归在 `docs/assumptions.md` 中跟踪，并通过定向回归测试与 CI 门禁进行验证。
- 基于 LibreOffice 的 DOCX 视觉渲染在 macOS 使用固定构建配置（`config/libreoffice-headless.json`）；运行视觉 Allure 证据测试前请先执行 `npm run check:libreoffice`。
- Maintainer: [Steven Obiajulu](https://www.linkedin.com/in/steven-obiajulu/)（MIT 机械工程背景；哈佛法学院法律训练）。

## 工作方式

1. 第 1 步：选择模板（36 份标准协议）
2. 第 2 步：填写你的信息（交互式提示或 MCP）
3. 第 3 步：获得专业排版的 DOCX

OpenAgreements 支持两种执行模式，信任边界不同：

- 托管远程 MCP 连接器（`https://openagreements.ai/api/mcp`），便于在 Claude 中快速配置。
- 完全本地包执行（`npx`、全局安装或本地 stdio MCP 包），用于本机本地工作流。

没有全局默认模式推荐。请根据文档敏感度、内部策略和工作流速度需求进行选择。参见 `docs/trust-checklist.md` 获取 60 秒数据流概览。

### 快速决策

- 如果文档敏感，请使用完全本地包执行。
- 如果更优先便捷性，请使用托管远程 MCP 连接器。

## 与 Claude Code 一起使用

OpenAgreements 可作为 [Claude Code 插件](https://docs.anthropic.com/en/docs/claude-code/plugins) 和 [Agent Skill](https://agentskills.io) 使用。无需预安装，Claude 会通过 `npx` 按需下载并运行 CLI。

### 选项 1：Agent Skill（推荐）

```bash
npx skills add open-agreements/open-agreements
```

然后让 Claude 起草协议：

```
> Draft an NDA between Acme Corp and Beta Inc
```

Claude 会发现可用模板、向你提问获取字段值，并生成可签署的 DOCX。

### 选项 2：Gemini CLI 扩展

```bash
gemini extensions install https://github.com/open-agreements/open-agreements
```

然后让 Gemini 起草协议。该扩展提供 MCP 工具、上下文文件和用于模板发现与填写的技能。

### 选项 3：直接配合 Claude Code

如果你有 Node.js >= 20，直接向 Claude 提示：

```
> Fill the Common Paper mutual NDA for my company
```

Claude 会运行 `npx -y open-agreements@latest list --json` 来发现模板，然后运行 `npx -y open-agreements@latest fill <template>` 生成输出。零安装。

### 选项 4：CLI

```bash
# Install globally
npm install -g open-agreements

# List available templates
open-agreements list

# Fill a template
open-agreements fill common-paper-mutual-nda -d values.json -o my-nda.docx
```

### 执行过程

1. Claude 运行 `list --json` 来发现可用模板及其字段
2. Claude 询问字段值（按章节分组，每轮最多 4 个问题）
3. Claude 运行 `fill <template>` 生成 DOCX，并保留原始格式
4. 你审核并签署输出文档

## 与 Cursor 一起使用

本仓库包含带 MCP 接线的 Cursor 插件清单：

- Plugin manifest: `.cursor-plugin/plugin.json`
- MCP config: `mcp.json`
- Skill: `skills/open-agreements/SKILL.md`

`mcp.json` 中的默认 MCP 配置包含：

- 托管 OpenAgreements MCP 连接器（`https://openagreements.ai/api/mcp`）
- 本地 workspace MCP 服务器（`npx -y @open-agreements/contracts-workspace-mcp`）
- 本地模板起草 MCP 服务器（`npx -y @open-agreements/contract-templates-mcp`）

要将该插件发布到 Cursor Marketplace，请在以下地址提交此仓库：

- https://cursor.com/marketplace/publish

## 模板

共 28 个模板，分为三个层级。运行 `open-agreements list` 查看完整清单。

| 层级 | 数量 | 来源 | 工作方式 |
|------|-------|--------|--------------|
| 内部模板 | 17 | [Common Paper](https://commonpaper.com), [Bonterms](https://bonterms.com), OpenAgreements | 随包发布，CC BY 4.0 |
| 外部模板 | 4 | [Y Combinator](https://www.ycombinator.com/documents) | 原样 vendor，CC BY-ND 4.0 |
| Recipes | 7 | [NVCA](https://nvca.org/model-legal-documents/) | 按需下载（不可再分发） |

**内部模板**（NDA、云条款、雇佣表单、承包商协议等）采用 CC BY 4.0，我们随包提供带 `{tag}` 占位符的 DOCX。

**外部模板**（YC SAFE）采用 CC BY-ND 4.0，我们原样 vendor。填写后的输出是在你机器上的临时衍生结果。

**Recipes**（NVCA 融资文件）可自由下载但不可再分发，我们仅提供转换指令，并在运行时从 nvca.org 下载源 DOCX。

### Guidance 提取

源文档包含专家评论，例如脚注、起草说明、`[Comment: ...]` 块，这些内容由领域专家（如证券律师）撰写。配方清理器会移除这些内容以生成可填写文档，也可以将其提取为结构化 JSON：

```bash
open-agreements recipe clean source.docx -o cleaned.docx \
  --recipe nvca-indemnification-agreement \
  --extract-guidance guidance.json
```

这会生成 `guidance.json`，其中包含每条被移除的脚注、评论和起草说明，并按来源类型和文档位置打标。该 guidance 仅为本地产物（不会提交或发布），可供 AI 代理或人工作者在填写表单时参考。格式细节见 [Adding Recipes — Guidance Extraction](docs/adding-recipes.md#guidance-extraction)。

**为什么要程序化提取？** 源文档是唯一事实来源。发布方更新后重新提取即可零人工获取最新 guidance，保留领域专家原文，并且覆盖全部内容。AI 可以即时总结，但无法恢复已经丢弃的内容。

每个模板都是自包含目录：

```
content/templates/<name>/
├── template.docx     # DOCX with {tag} placeholders
├── metadata.yaml     # Fields, license, source, attribution
└── README.md         # Template-specific documentation
```

## CLI 命令

### `fill <template>`

基于模板渲染已填写 DOCX。

```bash
# Using a JSON data file
open-agreements fill common-paper-mutual-nda -d data.json -o output.docx

# Using inline --set flags
open-agreements fill common-paper-mutual-nda --set party_1_name="Acme Corp" --set governing_law="Delaware"
```

### `validate [template]`

对单个或全部模板运行验证流水线。

```bash
open-agreements validate                          # All templates
open-agreements validate common-paper-mutual-nda  # One template
```

### `list`

显示可用模板及许可证信息与字段数量。

```bash
open-agreements list

# Machine-readable JSON output (for agent skills and automation)
open-agreements list --json
```

## Contracts Workspace CLI（独立包）

OpenAgreements 现在包含一个用于仓库/workspace 操作的同级包：

- Package: `@open-agreements/contracts-workspace`
- Binary: `open-agreements-workspace`
- Docs: `docs/contracts-workspace.md`

该包刻意与 `open-agreements` 分离，团队可以选择：

- 仅采用模板填写
- 仅采用 workspace 管理
- 或两者一起采用

workspace 核心能力：

- 面向主题的 `init` 规划（建议最小结构，含顶层域）
- 带 URL + SHA-256 校验的表单目录
- 通过文件名驱动 `_executed` 状态的 YAML 状态索引与 lint

v1 模型仅依赖文件系统，可在本地同步的云盘目录中工作（例如 Google Drive 同步）。无需 Drive API/OAuth 集成。

## 本地 MCP（Workspace 演示）

用于本地连接器演示时，可使用本地 stdio MCP 包：

- Package: `@open-agreements/contracts-workspace-mcp`
- Binary: `open-agreements-workspace-mcp`
- Docs: `docs/contracts-workspace.md`

快速开始：

```bash
npm run build:workspace-mcp
node packages/contracts-workspace-mcp/bin/open-agreements-workspace-mcp.js
```

## 本地 MCP（模板起草）

用于本地 Gemini/Cursor 模板起草流程，请使用：

- Package: `@open-agreements/contract-templates-mcp`
- Binary: `open-agreements-contract-templates-mcp`

快速开始：

```bash
npm run build:contract-templates-mcp
node packages/contract-templates-mcp/bin/open-agreements-contract-templates-mcp.js
```

## 网站（Vercel）

静态营销站点通过 Eleventy 从 `site/` 生成。

- Entry points: `site/index.njk`, `site/templates.njk`, `site/template-detail.njk`
- Styles: `site/styles.css`
- Demo media: `site/assets/demo-fill-nda.gif`
- Deployment config: `vercel.json`
- Discovery outputs (generated during `npm run build:site`): `_site/llms.txt`, `_site/llms-full.txt`, `_site/sitemap.xml`, `_site/robots.txt`

本地预览：

```bash
npm run build:site
python3 -m http.server 8080 --directory _site
```

然后打开 `http://localhost:8080`。

Vercel 部署说明：

- 在 Vercel 中导入此仓库
- 保持项目根目录为仓库根目录
- 随仓提供的 `vercel.json` 会将 `_site/` 作为静态输出部署

## 可选内容根目录（面向未来）

为了在表单库增长时支持逻辑解耦，`open-agreements` 可以通过以下方式从额外根目录加载内容：

- env var: `OPEN_AGREEMENTS_CONTENT_ROOTS`
- format: 由路径分隔符连接的绝对/相对目录列表（例如 macOS/Linux 上的 `dirA:dirB`）
- 每个根目录下预期结构：`templates/`、`external/` 和/或 `recipes/`（或嵌套在 `content/` 下）

查找优先级：

1. `OPEN_AGREEMENTS_CONTENT_ROOTS` 中的根目录（按列出顺序）
2. 包内自带内容（默认回退）

这既保持默认安装简单，也允许高级用户将大型内容库移出核心包。

## 贡献

参见 [CONTRIBUTING.md](CONTRIBUTING.md) 了解如何添加模板、recipes 及其他改进。

- [Adding templates](docs/adding-templates.md)（CC BY 4.0 / CC0 来源）
- [Adding recipes](docs/adding-recipes.md)（不可再分发来源）
- [Employment source policy](docs/employment-source-policy.md)（信任与条款分类）
- [Code of Conduct](CODE_OF_CONDUCT.md)（社区规范与执行）

## 发布

发布通过 GitHub Actions 自动完成，使用 npm 可信发布（OIDC）并启用 provenance。

1. 在根包和可发布 MCP 包中更新版本。
2. 提交并打标签后执行 `git push origin main --tags`
3. 运行本地 Gemini 扩展门禁（复制/软链接到 `~/.gemini/extensions/open-agreements`，并验证两个本地 MCP 服务器可启动/响应）。
4. `Release` workflow 会在标签上运行 build、验证、测试、隔离运行时 smoke 和包检查后发布。

workflow 防护规则：

- 标签必须与根包和可发布包版本一致
- 发布提交必须包含在 `origin/main` 中
- 若任一目标 npm 版本已存在，发布将失败

## 架构

- **Language**: TypeScript
- **DOCX Engine**: [docx-templates](https://www.npmjs.com/package/docx-templates) (MIT)
- **CLI**: [Commander.js](https://www.npmjs.com/package/commander)
- **Validation**: [Zod](https://www.npmjs.com/package/zod) schemas
- **Skill Pattern**: Agent-agnostic `ToolCommandAdapter` interface

```
content/                    # All content directories
├── templates/              # Internal templates (CC BY 4.0)
├── external/               # External templates (CC BY-ND 4.0)
└── recipes/                # Recipes (downloaded at runtime)

src/                        # TypeScript source + collocated unit tests
├── cli/                    # Commander.js CLI
├── commands/               # fill, validate, list, recipe, scan
├── core/
│   ├── engine.ts           # docx-templates wrapper
│   ├── metadata.ts         # Zod schemas + loader
│   ├── recipe/             # Recipe pipeline (clean → patch → fill → verify)
│   ├── external/           # External template support
│   ├── validation/         # template, license, output, recipe
│   └── command-generation/
│       ├── types.ts        # ToolCommandAdapter interface
│       └── adapters/       # Claude Code adapter
└── index.ts                # Public API

integration-tests/          # Integration and end-to-end tests
```

## 资源

- [Claude Code Documentation](https://docs.anthropic.com/en/docs/claude-code)
- [Claude Code Plugins Guide](https://docs.anthropic.com/en/docs/claude-code/plugins)
- [Agent Skills Specification](https://agentskills.io)

## 许可

MIT

模板内容按各自作者授权：CC BY 4.0（Common Paper、Bonterms）、CC BY-ND 4.0（Y Combinator）或专有（NVCA，运行时下载）。详见每个模板的 `metadata.yaml`。

## 免责声明

本工具基于标准模板生成文档，不构成法律建议。与 Common Paper、Bonterms、Y Combinator、NVCA 或任何模板来源不存在附属关系或背书关系。请咨询律师获取法律建议。
