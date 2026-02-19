# NVCA Model Voting Agreement

Recipe for the NVCA Model Voting Agreement (version 10-1-2025).

## Source

The source document is freely downloadable from [NVCA](https://nvca.org) but is not
redistributable. This recipe contains only transformation instructions.

## Usage

```bash
# Full pipeline (auto-downloads from NVCA)
open-agreements recipe run nvca-voting-agreement -d values.json -o voting-agreement.docx

# With a local copy of the source document
open-agreements recipe run nvca-voting-agreement -i NVCA-Voting-Agreement.docx -d values.json -o voting-agreement.docx

# Individual stages
open-agreements recipe clean source.docx -o cleaned.docx --recipe nvca-voting-agreement
open-agreements recipe patch cleaned.docx -o patched.docx --recipe nvca-voting-agreement
```

## Values File

Create a JSON file with the field values:

```json
{
  "company_name": "Acme Corp",
  "company_name_upper": "ACME CORP",
  "state_of_incorporation": "Delaware",
  "state_of_incorporation_lower": "Delaware",
  "investor_1_name": "Sequoia Capital Fund XIV",
  "investor_1_designee": "Michael Moritz",
  "series_name": "Series A",
  "company_counsel": "Wilson Sonsini, 650 Page Mill Road, Palo Alto, CA 94304",
  "investor_counsel": "Cooley LLP, 3175 Hanover Street, Palo Alto, CA 94304",
  "effective_date": "January 15, 2025",
  "drag_along_percentage": "sixty percent (60%)",
  "board_size": "five (5)",
  "notice_period_days": "120",
  "judicial_district": "Northern District of California",
  "key_holder_name": "Jane Doe"
}
```

## What the Recipe Does

1. **Clean**: Removes explanatory footnotes and drafting notes ("Note to Drafter:", "Preliminary Note")
2. **Patch**: Replaces 33 bracketed placeholders with template tags, handling Word's split-run XML
3. **Fill**: Renders template tags with your values using docx-templates
4. **Verify**: Confirms all values appear, no leftover placeholders or unrendered tags remain
