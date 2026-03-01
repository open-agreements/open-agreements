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

> **Aviso de tradução:** o `README.md` em inglês é a fonte canônica de verdade. Esta tradução pode ter pequeno atraso. Atualizações importantes do README em inglês devem ser propagadas em até 72 horas.

<!-- TODO: Add OpenSSF Scorecard badge once repo is indexed at securityscorecards.dev -->
<!-- TODO: Add OpenSSF Best Practices badge after registration at bestpractices.dev -->
<!-- TODO: Re-evaluate Snyk badge — Advisor migrated to security.snyk.io (July 2024) -->

<p align="center">
  <img src="docs/assets/demo-fill-nda.gif" alt="Fill a Mutual NDA in Claude Code — prompt, answer questions, get a signed-ready DOCX" width="720">
</p>

> *Demo: Claude preenche um NDA mútuo da Common Paper em menos de 2 minutos. Acelerado para brevidade.*

Preencha modelos padrão de acordos legais e gere arquivos DOCX prontos para assinatura. Os modelos cobrem NDAs, termos de cloud, documentos de trabalho, acordos com contratados, SAFEs e documentos de financiamento NVCA.

Construído pela equipe por trás da [UseJunior.com](https://usejunior.com) — em produção em escritórios Am Law 100.

## Qualidade e sinais de confiança

- O CI roda em pull requests e em pushes para `main`.
- A saúde do serviço em produção é publicada via OpenStatus em `openagreements.openstatus.dev`.
- A cobertura é publicada no Codecov com gates de patch/projeto definidos no repositório em `codecov.yml`.
- O framework de testes JS ativo é Vitest, com resultados JUnit enviados para analytics de testes no Codecov.
- A rastreabilidade de cenários OpenSpec é aplicada com `npm run check:spec-coverage`. Para exportar uma matriz local, rode `npm run check:spec-coverage -- --write-matrix integration-tests/OPENSPEC_TRACEABILITY.md`.
- O canário de source drift de recipes (`npm run check:source-drift`) valida o hash de origem esperado e âncoras estruturais de replace/normalize.
- Regressões em nível de suposição são rastreadas em `docs/assumptions.md` e validadas por testes de regressão direcionados + gates de CI.
- A renderização visual de DOCX com LibreOffice usa configuração fixada no macOS (`config/libreoffice-headless.json`); rode `npm run check:libreoffice` antes de testes visuais de evidência do Allure.
- Maintainer: [Steven Obiajulu](https://www.linkedin.com/in/steven-obiajulu/) (engenheiro mecânico formado no MIT; advogado com formação em Harvard Law).

## Como funciona

1. Etapa 1: escolha um modelo (36 acordos padrão)
2. Etapa 2: preencha seus dados (prompts interativos ou MCP)
3. Etapa 3: receba um DOCX com formatação profissional

O OpenAgreements oferece dois modos de execução com limites de confiança diferentes:

- Conector MCP remoto hospedado (`https://openagreements.ai/api/mcp`) para setup rápido no Claude.
- Execução totalmente local do pacote (`npx`, instalação global ou pacote MCP local por stdio) para fluxos de trabalho na própria máquina.

Não há recomendação global de modo padrão. Escolha com base na sensibilidade do documento, política interna e velocidade desejada no fluxo de trabalho. Veja `docs/trust-checklist.md` para um resumo de fluxo de dados em 60 segundos.

### Decisão rápida

- Se seu documento é sensível, use execução totalmente local do pacote.
- Se você prioriza conveniência, use o conector MCP remoto hospedado.

## Uso com Claude Code

OpenAgreements funciona como [plugin do Claude Code](https://docs.anthropic.com/en/docs/claude-code/plugins) e [Agent Skill](https://agentskills.io). Não é necessária pré-instalação: o Claude baixa e executa o CLI sob demanda via `npx`.

### Opção 1: Agent Skill (recomendado)

```bash
npx skills add open-agreements/open-agreements
```

Depois, peça ao Claude para redigir um acordo:

```
> Draft an NDA between Acme Corp and Beta Inc
```

O Claude descobre os modelos disponíveis, entrevista você para coletar valores de campos e gera um DOCX pronto para assinatura.

### Opção 2: Extensão Gemini CLI

```bash
gemini extensions install https://github.com/open-agreements/open-agreements
```

Depois, peça ao Gemini para redigir um acordo. A extensão fornece ferramentas MCP, arquivos de contexto e skills para descoberta e preenchimento de modelos.

### Opção 3: Direto com Claude Code

Se você tiver Node.js >= 20, basta pedir ao Claude:

```
> Fill the Common Paper mutual NDA for my company
```

O Claude executa `npx -y open-agreements@latest list --json` para descobrir modelos e depois `npx -y open-agreements@latest fill <template>` para gerar a saída. Sem instalação.

### Opção 4: CLI

```bash
# Install globally
npm install -g open-agreements

# List available templates
open-agreements list

# Fill a template
open-agreements fill common-paper-mutual-nda -d values.json -o my-nda.docx
```

### O que acontece

1. O Claude executa `list --json` para descobrir modelos disponíveis e seus campos
2. O Claude entrevista você para coletar valores de campos (agrupados por seção, até 4 perguntas por rodada)
3. O Claude executa `fill <template>` para gerar um DOCX preservando toda a formatação original
4. Você revisa e assina o documento de saída

## Uso com Cursor

Este repositório inclui um manifesto de plugin do Cursor com integração MCP:

- Plugin manifest: `.cursor-plugin/plugin.json`
- MCP config: `mcp.json`
- Skill: `skills/open-agreements/SKILL.md`

A configuração MCP padrão em `mcp.json` inclui:

- Conector MCP OpenAgreements hospedado (`https://openagreements.ai/api/mcp`)
- Servidor MCP local de workspace (`npx -y @open-agreements/contracts-workspace-mcp`)
- Servidor MCP local para drafting de modelos (`npx -y @open-agreements/contract-templates-mcp`)

Para publicar este plugin no Cursor Marketplace, envie este repositório em:

- https://cursor.com/marketplace/publish

## Modelos

28 modelos em três níveis. Rode `open-agreements list` para ver o inventário completo.

| Nível | Quantidade | Fonte | Como funciona |
|------|-------|--------|--------------|
| Modelos internos | 17 | [Common Paper](https://commonpaper.com), [Bonterms](https://bonterms.com), OpenAgreements | Empacotados no pacote, CC BY 4.0 |
| Modelos externos | 4 | [Y Combinator](https://www.ycombinator.com/documents) | Vendorizados sem alterações, CC BY-ND 4.0 |
| Recipes | 7 | [NVCA](https://nvca.org/model-legal-documents/) | Baixados sob demanda (não redistribuíveis) |

**Modelos internos** (NDAs, termos cloud, formulários de trabalho, acordos com contratados etc.) são CC BY 4.0 — enviamos o DOCX com placeholders `{tag}`.

**Modelos externos** (YC SAFEs) são CC BY-ND 4.0 — vendorizamos o original sem alterações. A saída preenchida é um derivado transitório na sua máquina.

**Recipes** (documentos de financiamento NVCA) são livremente baixáveis, mas não redistribuíveis — enviamos apenas instruções de transformação e baixamos o DOCX de origem de nvca.org em tempo de execução.

### Extração de guidance

Documentos de origem contêm comentários especializados — notas de rodapé, notas de redação, blocos `[Comment: ...]` — escritos por especialistas de domínio (por exemplo, advogados de mercado de capitais). O limpador de recipes remove esse conteúdo para produzir um documento preenchível, mas também pode extraí-lo como JSON estruturado:

```bash
open-agreements recipe clean source.docx -o cleaned.docx \
  --recipe nvca-indemnification-agreement \
  --extract-guidance guidance.json
```

Isso produz um `guidance.json` com cada nota de rodapé, comentário e nota de redação removidos, marcados por tipo de fonte e posição no documento. O guidance é um artefato somente local (não é commitado nem distribuído) que agentes de IA ou autores humanos podem consultar ao preencher o formulário. Veja [Adding Recipes — Guidance Extraction](docs/adding-recipes.md#guidance-extraction) para detalhes de formato.

**Por que extração programática?** O documento de origem é a única fonte de verdade. Reexecutar a extração após uma atualização do editor gera guidance atualizado sem esforço manual, preserva a linguagem exata de especialistas e captura tudo — uma IA pode resumir em tempo real, mas não pode recuperar conteúdo descartado.

Cada modelo é um diretório autocontido:

```
content/templates/<name>/
├── template.docx     # DOCX with {tag} placeholders
├── metadata.yaml     # Fields, license, source, attribution
└── README.md         # Template-specific documentation
```

## Comandos CLI

### `fill <template>`

Renderiza um DOCX preenchido a partir de um modelo.

```bash
# Using a JSON data file
open-agreements fill common-paper-mutual-nda -d data.json -o output.docx

# Using inline --set flags
open-agreements fill common-paper-mutual-nda --set party_1_name="Acme Corp" --set governing_law="Delaware"
```

### `validate [template]`

Executa o pipeline de validação em um ou todos os modelos.

```bash
open-agreements validate                          # All templates
open-agreements validate common-paper-mutual-nda  # One template
```

### `list`

Mostra modelos disponíveis com informações de licença e contagem de campos.

```bash
open-agreements list

# Machine-readable JSON output (for agent skills and automation)
open-agreements list --json
```

## Contracts Workspace CLI (pacote separado)

O OpenAgreements agora inclui um pacote irmão para operações de repositório/workspace:

- Package: `@open-agreements/contracts-workspace`
- Binary: `open-agreements-workspace`
- Docs: `docs/contracts-workspace.md`

Este pacote é propositalmente separado de `open-agreements`, permitindo que equipes adotem:

- apenas preenchimento de modelos
- apenas gerenciamento de workspace
- ou ambos juntos

Recursos principais de workspace:

- planejamento `init` orientado por tópicos (estrutura mínima sugerida com domínios de nível superior)
- catálogo de formulários com validação de URL + SHA-256
- indexação e lint de status YAML com status `_executed` orientado por nome de arquivo

O modelo v1 é apenas filesystem e funciona em pastas de nuvem sincronizadas localmente (por exemplo, sync do Google Drive). Não requer integração com Drive API/OAuth.

## MCP local para demo de workspace

Para demos de conectores locais, há um pacote MCP local por stdio:

- Package: `@open-agreements/contracts-workspace-mcp`
- Binary: `open-agreements-workspace-mcp`
- Docs: `docs/contracts-workspace.md`

Início rápido:

```bash
npm run build:workspace-mcp
node packages/contracts-workspace-mcp/bin/open-agreements-workspace-mcp.js
```

## MCP local para drafting de modelos

Para fluxos locais de drafting de modelos em Gemini/Cursor, use:

- Package: `@open-agreements/contract-templates-mcp`
- Binary: `open-agreements-contract-templates-mcp`

Início rápido:

```bash
npm run build:contract-templates-mcp
node packages/contract-templates-mcp/bin/open-agreements-contract-templates-mcp.js
```

## Website (Vercel)

Um site estático de marketing é gerado a partir de `site/` com Eleventy.

- Entry points: `site/index.njk`, `site/templates.njk`, `site/template-detail.njk`
- Styles: `site/styles.css`
- Demo media: `site/assets/demo-fill-nda.gif`
- Deployment config: `vercel.json`
- Discovery outputs (generated during `npm run build:site`): `_site/llms.txt`, `_site/llms-full.txt`, `_site/sitemap.xml`, `_site/robots.txt`

Pré-visualização local:

```bash
npm run build:site
python3 -m http.server 8080 --directory _site
```

Depois abra `http://localhost:8080`.

Notas de deploy na Vercel:

- Importe este repositório na Vercel
- Mantenha a raiz do projeto como a raiz do repositório
- O `vercel.json` incluído publica `_site/` como saída estática

## Raízes opcionais de conteúdo (preparação para o futuro)

Para suportar desacoplamento lógico conforme bibliotecas de formulários crescem, `open-agreements` pode carregar conteúdo de raízes adicionais via:

- env var: `OPEN_AGREEMENTS_CONTENT_ROOTS`
- format: lista delimitada por separador de caminho de diretórios absolutos/relativos (por exemplo, `dirA:dirB` em macOS/Linux)
- estrutura esperada em cada raiz: `templates/`, `external/` e/ou `recipes/` (ou aninhados em `content/`)

A precedência de busca é:

1. raízes em `OPEN_AGREEMENTS_CONTENT_ROOTS` (na ordem listada)
2. conteúdo empacotado padrão (fallback)

Isso mantém instalações padrão simples e permite que usuários avançados movam bibliotecas de conteúdo grandes para fora do pacote principal.

## Contribuindo

Veja [CONTRIBUTING.md](CONTRIBUTING.md) para saber como adicionar modelos, recipes e outras melhorias.

- [Adding templates](docs/adding-templates.md) (fontes CC BY 4.0 / CC0)
- [Adding recipes](docs/adding-recipes.md) (fontes não redistribuíveis)
- [Employment source policy](docs/employment-source-policy.md) (classificações de confiança e termos)
- [Code of Conduct](CODE_OF_CONDUCT.md) (expectativas da comunidade e aplicação)

## Releases

Releases são automatados via GitHub Actions usando publicação confiável da npm (OIDC) com provenance habilitada.

1. Atualize versões no pacote raiz + pacotes MCP publicáveis.
2. Faça push do commit + tag com `git push origin main --tags`
3. Rode o gate local da extensão Gemini (copiar/symlink para `~/.gemini/extensions/open-agreements` e verificar que ambos servidores MCP locais iniciam/respondem).
4. O workflow `Release` publica a partir da tag após rodar build, validação, testes, smoke de runtime isolado e checks de pacote.

Guardrails do workflow:

- a tag deve corresponder às versões do pacote raiz + pacotes publicáveis
- o commit de release deve estar contido em `origin/main`
- a publicação falha se qualquer versão alvo na npm já existir

## Arquitetura

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

## Recursos

- [Claude Code Documentation](https://docs.anthropic.com/en/docs/claude-code)
- [Claude Code Plugins Guide](https://docs.anthropic.com/en/docs/claude-code/plugins)
- [Agent Skills Specification](https://agentskills.io)

## Licença

MIT

O conteúdo dos modelos é licenciado por seus respectivos autores — CC BY 4.0 (Common Paper, Bonterms), CC BY-ND 4.0 (Y Combinator) ou proprietário (NVCA, baixado em tempo de execução). Veja `metadata.yaml` de cada modelo para detalhes.

## Aviso legal

Esta ferramenta gera documentos a partir de modelos padrão. Ela não fornece assessoria jurídica. Não há afiliação com ou endosso por Common Paper, Bonterms, Y Combinator, NVCA ou qualquer fonte de modelo. Consulte um advogado para orientação jurídica.
