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
# Optional: structured credits for contributors who materially shaped the template.
# See CONTRIBUTING.md ("Template credits") for the policy.
credits:
  - name: Contributor Name
    role: drafting_editor          # drafter | drafting_editor | reviewer | maintainer
    profile_url: https://...        # optional
# Optional: neutral prose identifying the source materials this template was derived from.
derived_from: Publicly available materials from ...
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
| `multiselect` | Zero or more values from a fixed allowlist (use `options` array) |

#### Multiselect fields

Use `multiselect` when the user should choose zero or more values from a
closed set and the template needs a shared allowlist.

```yaml
- name: industry_modules
  type: multiselect
  description: Industry riders to include
  options: [tech_rider, life_sciences_rider, healthcare_provider_rider, cross_border_rider]
  derive_booleans: true
  default: '[]'
  section: Industry Riders
```

When `derive_booleans: true` is set, the fill engine emits
`<option>_enabled: boolean` keys for every option, based on whether that
option appears in the selected array. DOCX templates can then gate
sections with `{IF tech_rider_enabled}`-style conditionals without
needing separate user-facing boolean fields.

Do not reference the multiselect field itself directly in `{IF ...}`
blocks. `{IF industry_modules}` is invalid because empty arrays are
truthy in the template runtime; the validator will reject it.

#### Statutory compliance representations

Use `statutory_compliance_representation: true` for the rare boolean field
whose `true` value asserts a *past real-world fact that is a statutory
precondition to enforceability* — for example, that a required advance
notice or written advisal was actually given before signing. This is a
NARROW, opt-in category: it is only for reps that gate enforceability, not
for ordinary representations (a purchase agreement may carry dozens of
ordinary reps that should not all demand per-rep confirmation).

```yaml
- name: advance_notice_confirmed
  type: boolean
  statutory_compliance_representation: true
  authority_url: https://www.flsenate.gov/Laws/Statutes/2025/542.45
  confirm_note: the required advance notice was actually given before signing
  description: >-
    CONFIRM-BEFORE-SIGNING: set true only if a human has verified the
    required advance notice was actually given (see <authority_url>). …
  default: 'false'
```

Such a field MUST be `boolean`, MUST declare `default: 'false'`, MUST declare
an http(s) `authority_url` (the statute / practice-note link), and MUST declare
a non-empty `confirm_note` (the short reason shown inside the rendered
`[CONFIRM …]` bracket). `authority_url` and `confirm_note` are only valid on
this category of field. Surface the broader confirmation warning in the field's
own `description` (there is no separate "requires confirmation" array —
everything a user fills requires confirmation).

Bind the field to a clause with the renderer's `confirm=` directive (canonical
`template.md`):

```md
<!-- oa:clause id=compliance-recital confirm=advance_notice_confirmed -->
### Compliance Recital

<the past-tense recital body>
```

The directive names **only** the field. The `confirm_note` and `authority_url`
shown in the bracket are pulled from that field's `metadata.yaml` entry — the
canonical compiler reads the sibling `metadata.yaml` — so they live in exactly
one place (see "Single source of truth" below). Restating `confirm_note` or
`authority_url` in the directive is a compile error.

The clause body always renders. When the field is `false` (the default,
unconfirmed) the renderer appends a yellow-highlighted
`[CONFIRM before signing: <confirm_note>; see <authority_url>]` bracket so a
human notices the open item; when the field is `true` the clause renders
clean. `confirm=` names a single boolean field and cannot be combined with
`when=`/`omitted`. The validator enforces that every
`statutory_compliance_representation` field is rendered as such a bracket and
that the bracket's URL and note match the metadata `authority_url`/`confirm_note`.

#### Single source of truth: `metadata.yaml` vs `template.md`

OpenAgreements templates keep field metadata and document prose in separate
files, with one owner each:

- **`metadata.yaml` owns field-level metadata** — field names, types, defaults,
  descriptions, and per-field properties like `authority_url` and `confirm_note`.
  The renderer and the MCP/`get_template` surface both read from here.
- **`template.md` (canonical authoring) owns document content** — clause prose,
  recital text, headings, and the directives that bind fields to that prose.

Do not restate a field's metadata in `template.md`. A `confirm=<field>`
directive references the field by name; the renderer resolves the field's
`confirm_note`/`authority_url` from `metadata.yaml` rather than having them
repeated in the directive. This keeps a single authoring source, so there is
nothing to drift between the two files.

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
