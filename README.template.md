<p align="center">
  <img src="https://raw.githubusercontent.com/open-agreements/open-agreements/main/docs/assets/oa-seal.svg" alt="OpenAgreements seal" width="140">
</p>

# OpenAgreements

[![npm version](https://img.shields.io/npm/v/open-agreements)](https://www.npmjs.com/package/open-agreements)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![CI](https://github.com/open-agreements/open-agreements/actions/workflows/ci.yml/badge.svg)](https://github.com/open-agreements/open-agreements/actions/workflows/ci.yml)
[![codecov](https://img.shields.io/codecov/c/github/open-agreements/open-agreements/main)](https://app.codecov.io/gh/open-agreements/open-agreements)

OpenAgreements helps people and software agents find primary-source-backed U.S.
legal guidance and produce reviewable DOCX files from standard agreement
templates.

## What OpenAgreements does

- Publishes jurisdiction-specific practice guides with citations to primary law.
- Provides standard agreement templates with source and license metadata.
- Fills templates locally through a CLI or over MCP.
- Publishes review checklists and comparison surveys in human- and
  machine-readable formats.

OpenAgreements provides legal information and document mechanics, not legal
advice. It does not decide whether a form or clause is right for a transaction,
and generated documents are drafts for human review.

The project’s longer-term goal is a citable conformance layer for legal AI:
primary law becomes inspectable requirements, an AI can check a document against
them, and a lawyer owns the final call. Read [Why OpenAgreements Exists](https://openagreements.org/manifesto.md)
for the rationale; this README stays focused on using the project.

## Fill your first agreement

Install the CLI locally, inspect the available forms, and fill the Common Paper
Mutual NDA:

```bash
npm install -g open-agreements
open-agreements list
open-agreements fill common-paper-mutual-nda \
  --set party_1_name="Jane Doe" \
  --set party_1_company="Acme Manufacturing, Inc." \
  --set party_2_name="John Smith" \
  --set party_2_company="Northeast Logistics LLC" \
  --set effective_date="2026-07-15" \
  --set purpose="Evaluating a potential logistics relationship" \
  --output mutual-nda.docx
```

The last command writes `mutual-nda.docx`. Open it in Word or another DOCX
viewer and review every filled term before signature. Defaults supply the
standard one-year term, Delaware governing law, and other omitted cover terms;
the CLI reports any priority fields that still need attention.

For a complete, copyable example and field-review steps, follow the
[quick start](https://github.com/open-agreements/open-agreements/blob/main/docs/quickstart.md).

## Understand the workflow

```text
standard form + source and license metadata
  → supplied field values
  → validation and local rendering
  → reviewable DOCX
  → human legal and business review
```

The standard form is authoritative until rendering. Your supplied values become
the transaction-specific inputs. The generated DOCX is an output for review; it
is never automatically accepted or signed.

The legal-content path is separate: practice guides cite primary sources,
surveys compare jurisdictions, and checklists turn requirements into review
steps. Those materials can inform a decision, but they do not mutate an
agreement.

## Choose your next step

- [Install OpenAgreements](https://github.com/open-agreements/open-agreements/blob/main/docs/installation.md) — choose local CLI, local MCP, or hosted MCP.
- [Fill a standard agreement](https://github.com/open-agreements/open-agreements/blob/main/docs/quickstart.md) — complete the canonical workflow end to end.
- [Use legal guidance and checklists](https://github.com/open-agreements/open-agreements/blob/main/docs/workflows/use-legal-content.md) — find the right human- or machine-readable source.
- [Connect an AI agent](https://github.com/open-agreements/open-agreements/blob/main/docs/using-with-ai-agents.md) — configure Claude Code, Codex CLI, Cursor, or Gemini CLI.
- [Browse the full catalog](https://github.com/open-agreements/open-agreements/blob/main/docs/reference/catalog.md) — templates, guides, surveys, checklists, skills, and packages.
- [Understand system boundaries](https://github.com/open-agreements/open-agreements/blob/main/docs/architecture.md) — follow content and documents through the system.
- [Contribute](https://github.com/open-agreements/open-agreements/blob/main/CONTRIBUTING.md) — change code, documentation, templates, or field-selectors.

{{LINKS}}

## Privacy and document handling

- Local CLI and local stdio MCP processing stay on your machine.
- Hosted MCP template filling runs server-side; filled documents are not stored
  after the response is returned.
- Some field-selector workflows download an official source document at runtime.

Choose an execution mode that matches your document-sensitivity and internal
policy requirements. See the [trust-boundary status](https://github.com/open-agreements/open-agreements/blob/main/docs/trust-checklist.md)
and [security policy](https://github.com/open-agreements/open-agreements/blob/main/SECURITY.md).

## License

Project code is licensed under [Apache License 2.0](LICENSE). Content retains its
source-specific license. See the [licensing reference](https://github.com/open-agreements/open-agreements/blob/main/docs/licensing.md)
and each template's `metadata.yaml` before redistribution or modification.
