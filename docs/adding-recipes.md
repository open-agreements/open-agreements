# Adding Recipes

Recipes enable OpenAgreements to work with non-redistributable document sources
(like NVCA model financing documents) by hosting only transformation instructions.

## Prerequisites

- A publicly downloadable DOCX source document
- Understanding of the document's placeholder conventions

## Step 1: Scan the Source Document

Use the `scan` command to discover all bracketed placeholders:

```bash
open-agreements scan ~/Downloads/source-document.docx
```

This reports:
- Short placeholders (likely fill-in fields)
- Long alternative clauses (typically left as-is)
- Split-run placeholders (where Word splits text across XML elements)
- Footnote count

To generate a draft `replacements.json`:

```bash
open-agreements scan ~/Downloads/source-document.docx --output-replacements replacements-draft.json
```

## Step 2: Create the Recipe Directory

```bash
mkdir recipes/your-recipe-name/
```

## Step 3: Create metadata.yaml

```yaml
name: Your Document Name
description: Brief description of the document
source_url: https://example.com/document.docx
source_version: "2025-01"
license_note: >-
  Describe the licensing situation and why a recipe is needed.
optional: false
fields:
  - name: company_name
    type: string
    description: Full legal name
    required: true
```

## Step 4: Create replacements.json

Map source placeholders to template tags:

```json
{
  "[Company Name]": "{company_name}",
  "[Date]": "{effective_date}"
}
```

Tips:
- Sort keys longest-first is handled automatically by the patcher
- Include both smart quote and straight quote variants for the same placeholder
- Use `{tag_name}` format (single braces, snake_case)

## Step 5: Create clean.json (if needed)

```json
{
  "removeFootnotes": true,
  "removeParagraphPatterns": [
    "^Note to Drafter:",
    "^Preliminary Note\\b"
  ]
}
```

## Step 6: Create schema.json

Define all fields that replacement targets reference:

```json
{
  "fields": [
    { "name": "company_name", "type": "string", "description": "Full legal name" }
  ]
}
```

## Step 7: Test

```bash
# Validate the recipe
open-agreements validate

# Test individual stages
open-agreements recipe clean source.docx -o cleaned.docx --recipe your-recipe-name
open-agreements recipe patch cleaned.docx -o patched.docx --recipe your-recipe-name

# Full pipeline
open-agreements recipe run your-recipe-name -d values.json -o output.docx --keep-intermediate
```

## Important: No .docx Files in Recipe Directories

Recipe directories must **never** contain `.docx` files. The source document is
copyrighted and must not be committed to the repository. The recipe only contains
transformation instructions. This is enforced by validation.

## Known Limitations

- Tracked changes in source documents are not handled
- Headers and footers are not processed
- Content controls (structured document tags) are not processed
- Textboxes are not processed
- Only `word/document.xml` is patched (not headers, footers, or other parts)
