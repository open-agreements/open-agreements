---
title: Adding Templates
description: How to add a new CC BY or CC0 template to the repository.
order: 2
section: Guides
---

# Adding Templates

## Requirements

- Template source must be **CC BY 4.0** or **CC0** licensed
- The source document must be available as DOCX
- You must include proper attribution per the license
- Source terms must not conflict with automation or redistribution policy

## Steps

### 1. Create the template directory

```bash
mkdir content/templates/<template-name>
```

Use kebab-case for the directory name (e.g., `common-paper-mutual-nda`).

### 2. Create the DOCX template

Create a `template.docx` with `{field_name}` placeholders where values should be inserted.

- Use single curly braces: `{party_name}`, `{effective_date}`
- Field names should be `snake_case`
- Preserve all formatting from the source document

### 3. Create metadata.yaml

```yaml
name: Template Display Name
description: Brief description of the template
source_url: https://github.com/source/repo
version: "1.0"
license: CC-BY-4.0
allow_derivatives: true
attribution_text: >-
  Based on [Template Name], available at [URL].
  Licensed under CC BY 4.0. Copyright [Author].
fields:
  - name: party_name
    type: string
    description: Full legal name of the party
    section: Parties
  - name: effective_date
    type: date
    description: Date the agreement takes effect
    section: Terms
priority_fields:
  - party_name
  - effective_date
```

#### Field types

| Type | Description |
|------|-------------|
| `string` | Free-form text |
| `date` | Date value (any format) |
| `number` | Numeric value |
| `boolean` | true/false |
| `enum` | One of a fixed set of options (use `options` array) |
| `array` | Repeating list of objects or values (use nested `items` definitions when you need object fields) |

#### License values

| Value | Description |
|-------|-------------|
| `CC-BY-4.0` | Creative Commons Attribution 4.0 |
| `CC0-1.0` | Creative Commons Zero (public domain) |

#### Variable signer blocks

Preferred pattern: array field plus `{FOR}` loop.

```yaml
fields:
  - name: signers
    type: array
    description: Signers on the document
    items:
      - name: name
        type: string
        description: Printed signer name
      - name: title
        type: string
        description: Printed signer title
```

```text
{FOR signer IN signers}
_________________________________
{$signer.name}
{$signer.title}
Date: {effective_date}
{END-FOR signer}
```

Use this whenever the document can have a variable number of parties, directors, investors, or signers. The fill pipeline already passes arrays through to `docx-templates`, and this pattern keeps the template honest for 1, 3, 7, or more entries without manual cleanup.

Legacy-compatible pattern: fixed extra slots wrapped in `{IF}` blocks.

```yaml
fields:
  - name: signer_1_name
    type: string
    description: Primary signer name
  - name: signer_2_name
    type: string
    description: Optional second signer name
    default: ""
  - name: signer_2_date
    type: date
    description: Optional second signer date
```

```text
{IF signer_2_name}
_________________________________
{signer_2_name}
Date: {signer_2_date}
{END-IF}
```

Use this only when you are preserving a legacy fixed-slot template and do not want to rewrite it around a loop yet. The `default: ""` on the optional slot anchor is required. Without it, the template-path blank placeholder (`_______`) is truthy and the extra block will not prune.

### 4. Create README.md

Document the template's source, fields, and attribution. See existing templates for examples.

### 5. Validate

```bash
open-agreements validate <template-name>
```

This checks metadata schema compliance, placeholder-field alignment, and license compliance.

## Source Terms Gate

Before adding a template, classify the source as one of:

- `permissive`
- `pointer-only`
- `restricted-no-automation`

Do not onboard `restricted-no-automation` sources into `content/templates/`, `content/external/`,
or recipe auto-fetch flows without explicit written permission. Employment-pack
classifications are tracked in `docs/employment-source-policy.md`.

## Maintainer-Generated Metadata Sidecars

Some templates ship with a sibling `metadata.legal-context.yaml` file next to
their `metadata.yaml`. This is a **generated artifact** — the project's
maintainers regenerate it from a separate editorial pipeline and it will be
overwritten on every regeneration. It carries curated legal defaults and the
rationales behind them (`default`, `default_value_rationale`, `options`) for
fields where the right value depends on law-firm analysis.

**Do not hand-edit `metadata.legal-context.yaml` files.** If you spot an
incorrect rationale or an outdated default, open a PR or issue pointing at
the specific field; a maintainer will fix it upstream and regenerate the
sidecar.

See [`two-sidecar-metadata-ownership.md`](./two-sidecar-metadata-ownership.md)
for the ownership model, merge rules, and what to do when a field rename
trips the CI lint at `scripts/validate_metadata_sidecar.mjs`.
