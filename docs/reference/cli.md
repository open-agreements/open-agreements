---
title: CLI Reference
description: Commands and options for template discovery, filling, validation, field-selectors, scanning, and checklists.
order: 2
section: Reference
---

# Use the OpenAgreements CLI

This page is the canonical command reference. Run `open-agreements <command>
--help` for the exact options in your installed version.

## Discover templates

```bash
open-agreements list
open-agreements list --json
open-agreements list --json-strict
open-agreements template show <template>
open-agreements template show <template> --json
```

`--json` includes field definitions for automation. `--json-strict` also exits
non-zero if any catalog metadata fails to load.

`template show` narrows the same canonical catalog record to one agreement. Its
human-readable output highlights stability, provenance, distribution, and
priority fields; `--json` returns the exact item shape used by `list --json`.

## Fill a standard form

```bash
open-agreements fill <template> --data values.json --output agreement.docx
open-agreements fill <template> --set field=value --output agreement.docx
```

`--values` is an alias for `--data`. Repeat `--set` for multiple fields. Values
provided with `--set` override the same keys loaded from the JSON file.

### Companion memos

Two template families can emit a companion memo alongside the filled document,
as JSON, Markdown, or both:

- **Employment** — the offer letter and every state variant of it, the
  confidentiality and invention assignment agreement and its state variants, and
  the Wyoming restrictive covenant. The memo reports clause-presence signals,
  baseline variance, and jurisdiction warnings.
- **Founder separation** — every `openagreements-founder-*` template. The memo
  reports the source documents the package relies on, the branch decisions the
  fill took, unresolved facts, and required approvals.

```bash
open-agreements fill openagreements-employment-offer-letter-new-york \
  --data employee.json \
  --output offer.docx \
  --memo both

open-agreements fill openagreements-founder-share-repurchase-notice \
  --data separation.json \
  --output notice.docx \
  --memo both
```

Asking for `--memo` on a template outside both families fails with an error that
lists every template that does support it.

A memo is operational information about template fields and the records those
fields cite. It is not legal advice, and neither generator will emit
prescriptive wording.

Use `open-agreements fill --help` for memo output paths, jurisdiction overrides,
and baseline comparison options.

## Manage persistent local agreements

```bash
open-agreements agreements create <template> --data terms.json
open-agreements agreements list [--json]
open-agreements agreements show <id> [--json]
open-agreements agreements update <id> --revision 1 --set field=value
open-agreements agreements review <id>
open-agreements agreements render <id> --output agreement.docx
```

Agreement state stays on the local filesystem under
`.open-agreements/agreements/<id>/`; add `.open-agreements/` to the consuming
project's `.gitignore`. Set `OPEN_AGREEMENTS_STATE_ROOT` to override the
agreements directory. Updates merge declared template fields, advance the
revision, and can use `--revision` for optimistic concurrency. Review persists
unfilled-priority, provenance-drift, and rendered-document integrity warnings.
Render uses the existing local template engine and records the output SHA-256.
These commands do not log in, send documents, or access the network.

## Validate templates and field-selectors

```bash
open-agreements validate
open-agreements validate <template>
open-agreements validate --strict
```

Strict mode treats warnings such as scaffolds or missing optional files as
errors.

## Run a field-selector pipeline

```bash
open-agreements field-selector run <field-selector-id> \
  --data values.json \
  --output agreement.docx
```

If `--input` is omitted, the pipeline downloads the configured official source
document. `--keep-intermediate` preserves stage outputs and `--computed-out`
writes computed interactions for audit. See [Adding field-selectors](../adding-field-selectors.md)
for the clean and patch subcommands.

## Scan a source DOCX

```bash
open-agreements scan source.docx
open-agreements scan source.docx --output-replacements replacements-draft.json
```

Scanning reports bracketed placeholders and can create a starting replacement
map. It does not alter the source document.

## Manage a closing checklist

```text
open-agreements checklist create <deal-name>
open-agreements checklist list
open-agreements checklist show <name-or-id> [--json]
open-agreements checklist update <name-or-id> --data patch.json
open-agreements checklist render <name-or-id> --output checklist.docx
open-agreements checklist history <name-or-id>
```

The lower-level `patch-validate` and `patch-apply` commands support validated,
revision-aware integrations. Inspect their help before use because they require
state and validation-artifact files.
