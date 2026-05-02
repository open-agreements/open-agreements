## ADDED Requirements

### Requirement: Canonical Markdown Repeat-Backed Signer Authoring
The canonical Markdown compiler and shared branded-template renderer SHALL
support repeat-backed stacked signer sections declared on
`oa:signature-mode`.

#### Scenario: [OA-TMP-036] Repeat-backed stacked signer sections compile into loop-backed output
- **WHEN** a canonical Markdown template declares
  `<!-- oa:signature-mode arrangement=stacked repeat=signers item=signer -->`
  and authors one signer prototype using `{signer.*}` references
- **THEN** the compiler records repeat metadata in the contract spec
- **AND** the rendered output emits `{FOR signer IN signers}`
- **AND** signer row values render with loop-safe placeholders such as
  `{$signer.name}`
- **AND** the rendered output closes the loop with `{END-FOR signer}`

### Requirement: SAFE Board Consent Canonical Markdown Authoring
The SAFE board consent SHALL be authored canonically in
`content/templates/openagreements-board-consent-safe/template.md`, with the
generated JSON spec and rendered DOCX derived from that source.

#### Scenario: [OA-TMP-037] SAFE board consent canonical source preserves source fidelity
- **WHEN** the SAFE board consent canonical source is compiled, rendered, and
  filled
- **THEN** the generated outputs preserve the board consent legal text,
  resolution flow, placeholders, and professional formatting
- **AND** the signature section expands `board_members` into the exact number
  of signer blocks without leaving loop markers in the filled output

### Requirement: SAFE Stockholder Consent Canonical Markdown Authoring
The SAFE stockholder consent SHALL be authored canonically in
`content/templates/openagreements-stockholder-consent-safe/template.md`, with
the generated JSON spec and rendered DOCX derived from that source.

#### Scenario: [OA-TMP-038] SAFE stockholder consent canonical source preserves source fidelity
- **WHEN** the SAFE stockholder consent canonical source is compiled, rendered,
  and filled
- **THEN** the generated outputs preserve the stockholder consent legal text,
  Section 228 timing behavior, placeholders, and professional formatting
- **AND** the signature section expands `stockholders` into the exact number of
  signer blocks without leaving loop markers in the filled output

## REMOVED Requirements

### Requirement: Contract IR Pointer-Based Template Authoring
**Reason**: OpenAgreements-authored branded templates now use canonical
`template.md` as the sole authored source of truth.
**Migration**: Re-author branded templates in canonical Markdown and generate
their JSON specs with `generate:templates`.

### Requirement: Contract IR Validation
**Reason**: Removing the branded-template Contract IR authoring path removes
the associated template validation surface.
**Migration**: Validate canonical Markdown authoring through the shared
canonical compiler and generated JSON spec checks.

### Requirement: Contract IR Dual Rendering
**Reason**: Branded templates now render through the canonical Markdown ->
generated JSON -> DOCX pipeline.
**Migration**: Use `node scripts/generate_templates.mjs` to generate JSON and
DOCX artifacts from canonical Markdown sources.

### Requirement: SAFE Board Consent Contract IR Backport
**Reason**: The SAFE board consent is now canonically authored in `template.md`
with generated JSON and DOCX artifacts.
**Migration**: Use the canonical board consent source and generated
`.template.generated.json` in the template directory.
