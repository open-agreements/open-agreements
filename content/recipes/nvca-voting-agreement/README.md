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

## Option Vesting Policy Computation

The NVCA voting agreement recipe includes option-vesting policy computation
coverage for deterministic derived values. When option-vesting inputs select a
policy profile, computed outputs reflect the selected vesting treatment and the
exported trace records the rule path used to derive those outputs.

The NVCA option resolution engine applies clause-level policies including
costs-of-enforcement and dispute-resolution, defaulting venue and district
values. Costs-of-enforcement policy retains only the each-party clause. When
dispute-resolution selects arbitration, venue defaults are applied. When courts
are selected, district defaults by state with alignment flags. When no explicit
clause policy is defined for an in-line legal alternative, the alternative text
is preserved unresolved until a policy is added.

## Assumption Validation

Template assumption validation confirms that required NVCA recipe assumptions
are explicit and machine-checkable. When bundled NVCA recipe assumptions are
validated, missing or inconsistent assumptions fail validation with actionable
messages rather than silently producing a filled document.

NVCA template processing preserves bracket-prefixed headings while removing
bracketed alternatives during clean, and normalizes heading-leading brackets
during the normalize step.

## Behavioral Scenarios

### [OA-FIL-018] NVCA clause policy resolution
- **WHEN** costs-of-enforcement policy is applied
- **THEN** only the each-party clause is retained
- **AND** when dispute-resolution selects arbitration, venue defaults are applied
- **AND** when courts are selected, district defaults by state with alignment flags

### [OA-FIL-019] Unresolved legal alternatives preserved
- **WHEN** no explicit clause policy is defined for an in-line legal alternative
- **THEN** the alternative text is preserved unresolved until a policy is added

### [OA-TMP-018] NVCA clean and normalize assumptions
- **WHEN** the clean step processes bracket-prefixed headings and bracketed alternatives
- **THEN** bracket-prefixed headings are preserved while bracketed alternatives are removed
- **AND** declarative normalize strips heading-leading brackets and trims unmatched trailing brackets
