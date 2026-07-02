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

## Available Skills

{{AVAILABLE_SKILLS}}

## Use it with AI agents & the CLI

Fill any template from a coding agent over MCP — local stdio or the hosted server at `https://openagreements.org/api/mcp` — or from the `open-agreements` CLI, and read every guide, survey, and checklist as machine-readable JSON/CSV twins.

→ **[Using OpenAgreements with AI agents & the CLI](https://github.com/open-agreements/open-agreements/blob/main/docs/using-with-ai-agents.md)** — setup for Claude Code, Cursor, and Gemini CLI; the CLI reference; and the machine-readable twins table.

## Packages

{{PACKAGES}}

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
