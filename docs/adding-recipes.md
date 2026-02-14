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
required_fields:
  - company_name
```

## Step 4: Create replacements.json

Map source placeholders to template tags:

```json
{
  "[Company Name]": "{company_name}",
  "[Date]": "{effective_date}"
}
```

**Critical: Keys must match actual document text.** Do NOT guess placeholder labels.
Always derive keys from the scan output or by extracting text from the DOCX. Common
pitfalls:
- A placeholder labeled `[Insert Company Name]` on a signature page may appear as
  `[____________]` (underscores) in the document body — use the body text as your key
- Case matters: `[Company Counsel Name]` ≠ `[Company counsel name]`
- Date patterns vary: `[_____ __, 20___]` vs `[________], 20[__]` — check exact text

### Disambiguating generic underscore patterns

When the same underscore pattern (e.g., `[____________]`) appears multiple times with
different meanings, include surrounding context text in the key:

```json
{
  "among [____________], a Delaware": "among {company_name}, a Delaware",
  "[____________] (the \u201cInvestor\u201d)": "{investor_name} (the \u201cInvestor\u201d)"
}
```

The patcher performs **surgical replacement**: it automatically detects common prefix/suffix
between key and value, and only modifies the differing middle portion in the XML. This
preserves formatting on the context text. No special syntax needed — just make sure the
value includes the same context text as the key.

Example: `"among [____________], a Delaware"` → `"among {company_name}, a Delaware"`
- Common prefix: `"among "` (6 chars)
- Common suffix: `", a Delaware"` (13 chars)
- Only `[____________]` → `{company_name}` is modified in the XML

### Currency and percent fields

When a template has `$[amount]` (dollar sign outside the brackets), the patched template
becomes `${field_name}`. If a user provides `$1,000,000` as the value, the output would be
`$$1,000,000`. The `sanitizeCurrencyValues()` utility handles this automatically — it detects
`${field}` patterns in replacements and strips leading `$` from user values. The verifier
also checks for double dollar signs in the output.

The same issue can occur with percent signs (`%`). Be aware when authoring replacements.

### Two types of brackets in NVCA documents

NVCA documents use brackets for two distinct purposes:
1. **Fill-in fields**: `[Company Name]`, `[____________]` — these should be replaced
2. **Optional/alternative clauses**: `[or consultant (excluding service solely as member
   of the Board)]` — these should be left as-is for the drafter to decide

Only map fill-in fields in `replacements.json`. Leave optional clauses alone.

Tips:
- Sort keys longest-first is handled automatically by the patcher
- Include both smart quote and straight quote variants for the same placeholder
- Use `{tag_name}` format (single braces, snake_case)

## Step 5: Create clean.json (if needed)

The cleaner removes content that shouldn't appear in the filled output — footnotes,
drafting notes, preliminary commentary, multi-paragraph comment blocks, etc.

```json
{
  "removeFootnotes": true,
  "removeParagraphPatterns": [
    "^Comment:",
    "^NOTE:"
  ],
  "removeRanges": [
    {
      "start": "^MODEL INDEMNIFICATION AGREEMENT$",
      "end": "against their own directors and officers\\."
    },
    {
      "start": "^\\[Comment:",
      "end": "\\]\\s*$"
    }
  ]
}
```

### clean.json fields

| Field | Type | Description |
|---|---|---|
| `removeFootnotes` | boolean | Remove all footnotes from `word/footnotes.xml` |
| `removeParagraphPatterns` | string[] | Regex patterns — any paragraph matching one is removed |
| `removeRanges` | `{ start, end }[]` | Remove all paragraphs from the first matching `start` through the first subsequent `end` (inclusive). All occurrences of a range pattern are matched, not just the first. |
| `clearParts` | string[] | OOXML part paths to clear entirely (e.g., `word/footer1.xml`) |

### Optional: normalize.json for post-fill clause fixes

Some source documents (especially NVCA forms) still contain bracket artifacts
after normal fill (for example trailing `]`, unresolved underscore placeholders,
or alternative clauses that should collapse to one branch). Add `normalize.json`
to apply explicit post-fill rules.

```json
{
  "paragraph_rules": [
    {
      "id": "fill-company-counsel-name",
      "section_heading": "Conditions of the Purchasers’ Obligations at Closing",
      "section_heading_any": ["Qualifications"],
      "paragraph_contains": "The Purchasers shall have received from",
      "replacements": {
        "[___________]": "{company_counsel_name}"
      },
      "trim_unmatched_trailing_bracket": true
    }
  ]
}
```

Rule behavior:
- `section_heading`: primary heading to scope the rule.
- `section_heading_any`: optional heading aliases (useful when source headings differ across versions).
- `paragraph_contains`: required anchor; rule applies only if paragraph contains this text.
- `replacements`: optional token replacements; `{field_name}` is resolved from fill values (or `_______` if missing).
- `trim_unmatched_trailing_bracket`: removes dangling trailing `]` after replacement.

This keeps cleanup declarative and versionable, instead of relying on brittle ad hoc parsing scripts.

### Range deletion

`removeRanges` is useful for multi-paragraph blocks where individual patterns would be
brittle. For example, the NVCA indemnification agreement has a 12-paragraph "Preliminary
Notes" section and scattered multi-paragraph `[Comment: ...]` blocks. Two range entries
replace what would otherwise require 15+ individual patterns.

Each range scans paragraphs sequentially: when `start` matches, all paragraphs from that
point through the first subsequent `end` match (inclusive) are removed. Matching then
resumes from the next paragraph, so the same range pattern can match multiple occurrences
in a single document.

## Step 6: Define fields in metadata.yaml

Fields in `metadata.yaml` control default values for unfilled placeholders:

- **`default: ""`** (explicit empty string): Field renders as empty — use for optional
  fields that should be invisible when not provided (e.g., `amended_restated`)
- **No `default` key**: Field renders as `_______` — a visible placeholder indicating
  the field still needs to be filled in
- **`default: "some value"`**: Field uses the specified default text

```yaml
fields:
  - name: company_name
    type: string
    description: Full legal name
  - name: amended_restated
    type: string
    description: "Amended and Restated or empty"
    default: ""              # explicit empty → invisible when not provided
  - name: judicial_district
    type: string
    description: Federal judicial district
    default: District of Delaware  # default value used when not provided
required_fields:
  - company_name             # no default → shows _______ if not provided
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

## Guidance Extraction

Source documents often contain expert commentary — footnotes, `[Comment: ...]` blocks,
and drafting notes — that explain why fields exist, what the implications of different
values are, and how sections interact. The cleaner removes this content to produce a
fillable document, but the knowledge is valuable for anyone (human or AI) filling the
form.

The `--extract-guidance` flag on `recipe clean` captures all removed content as structured
JSON **before** deleting it from the DOCX:

```bash
open-agreements recipe clean source.docx \
  -o cleaned.docx \
  --recipe nvca-indemnification-agreement \
  --extract-guidance guidance.json
```

### Output format

```json
{
  "extractedFrom": {
    "sourceHash": "f9b61b4d...",
    "configHash": "b77c2d27..."
  },
  "entries": [
    {
      "source": "range",
      "part": "word/document.xml",
      "index": 0,
      "text": "MODEL INDEMNIFICATION AGREEMENT",
      "groupId": "range-0"
    },
    {
      "source": "pattern",
      "part": "word/document.xml",
      "index": 12,
      "text": "Comment: This section addresses..."
    },
    {
      "source": "footnote",
      "part": "word/footnotes.xml",
      "index": 40,
      "text": "See Delaware General Corporation Law § 145."
    }
  ]
}
```

Each entry records:

| Field | Description |
|---|---|
| `source` | How the content was removed: `footnote`, `pattern`, or `range` |
| `part` | OOXML part the content came from |
| `index` | Global extraction order (preserves document position) |
| `text` | The removed text content |
| `groupId` | Shared identifier for entries from the same range match (range entries only) |

### Staleness detection

The `extractedFrom` object contains SHA-256 hashes of both the source DOCX and the
`clean.json` config. If either changes, the guidance should be re-extracted.

### Licensing note

Extracted guidance contains verbatim source text. For non-redistributable sources (like
NVCA), the guidance file must NOT be committed to the repository or shipped in the npm
package — it is a **local-only, authoring-time** artifact generated on the user's machine.
For permissive-licensed sources, guidance could be committed, but this is not required.

## Important: No .docx Files in Recipe Directories

Recipe directories must **never** contain `.docx` files. The source document is
copyrighted and must not be committed to the repository. The recipe only contains
transformation instructions. This is enforced by validation.

## Known Limitations

- Tracked changes in source documents are not handled
- Content controls (structured document tags) are not processed
- Textboxes are not processed

Note: Headers, footers, and endnotes **are** processed. The patcher uses
`enumerateTextParts()` to find all general OOXML text parts in the DOCX.
