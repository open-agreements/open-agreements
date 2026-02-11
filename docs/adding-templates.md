# Adding Templates

## Requirements

- Template source must be **CC BY 4.0** or **CC0** licensed
- The source document must be available as DOCX
- You must include proper attribution per the license

## Steps

### 1. Create the template directory

```bash
mkdir templates/<template-name>
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
required_fields:
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

#### License values

| Value | Description |
|-------|-------------|
| `CC-BY-4.0` | Creative Commons Attribution 4.0 |
| `CC0-1.0` | Creative Commons Zero (public domain) |

### 4. Create README.md

Document the template's source, fields, and attribution. See existing templates for examples.

### 5. Validate

```bash
open-agreements validate <template-name>
```

This checks metadata schema compliance, placeholder-field alignment, and license compliance.
