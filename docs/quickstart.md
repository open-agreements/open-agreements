---
title: Fill and Review Your First Agreement
description: Fill a Common Paper Mutual NDA locally and inspect the resulting DOCX.
order: 2
section: Start Here
---

# Fill and review your first agreement

This procedure takes a standard form, applies controlled field values, validates
the template, and produces a DOCX for human review. It does not edit an arbitrary
existing agreement or decide whether the NDA is appropriate for your deal.

## Before you start

Install the local CLI as described in [Install OpenAgreements](installation.md).
The example uses synthetic names and writes files in your current directory.

## Find the template

```bash
open-agreements list
open-agreements validate common-paper-mutual-nda
```

The list identifies the Mutual NDA as a bundled Common Paper template. The
validation command checks its metadata, license rules, and document structure.

## Supply the transaction values

Save the following as `mutual-nda.values.json`:

```json
{
  "purpose": "Evaluating a potential logistics relationship",
  "effective_date": "2026-07-15",
  "mnda_term": "1 year",
  "confidentiality_term": "1 year",
  "confidentiality_term_start": "Effective Date",
  "governing_law": "Delaware",
  "jurisdiction": "courts located in New Castle County, Delaware",
  "changes_to_standard_terms": "None.",
  "party_1_type": "entity",
  "party_1_name": "Jane Doe",
  "party_1_title": "CEO",
  "party_1_company": "Acme Manufacturing, Inc.",
  "party_1_email": "jane@example.com",
  "party_2_type": "entity",
  "party_2_name": "John Smith",
  "party_2_title": "General Counsel",
  "party_2_company": "Northeast Logistics LLC",
  "party_2_email": "john@example.com"
}
```

The same maintained fixture is available at
[`docs/examples/mutual-nda.values.json`](examples/mutual-nda.values.json).

## Produce the reviewable DOCX

```bash
open-agreements fill common-paper-mutual-nda \
  --data mutual-nda.values.json \
  --output mutual-nda.docx
```

The CLI prints the output path and the fields used. A warning means the file may
still have been created, but a priority field needs attention.

## Review the generated agreement

Open `mutual-nda.docx` and confirm:

- both companies and signatories are correct;
- the purpose, effective date, term, governing law, and jurisdiction match the
  intended deal;
- no blank cover terms or placeholder text remain; and
- the referenced Common Paper standard terms and any changes are acceptable.

The generated DOCX is a draft. OpenAgreements does not accept changes, provide
legal advice, or sign the document.

## Continue from here

- Use [the CLI reference](reference/cli.md) to fill another template or inspect
  machine-readable template metadata.
- [Connect an AI agent](using-with-ai-agents.md) to conduct the field interview.
- [Browse the catalog](reference/catalog.md) to choose another standard form.
