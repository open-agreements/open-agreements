## ADDED Requirements

### Requirement: Contract IR Pointer-Based Template Authoring
The system SHALL support a Contract IR authoring path where a canonical
Markdown content document points, via YAML frontmatter, to an external schema
registry and an external style registry.

#### Scenario: [OA-TMP-022] Content document resolves external registries
- **WHEN** a Contract IR template is loaded from `content.md`
- **THEN** the loader resolves the referenced schema and style YAML files
- **AND** the normalized template model retains document metadata, variables,
  and style semantics from those external registries

### Requirement: Contract IR Validation
The system SHALL reject Contract IR templates that reference unknown variables,
unknown style slugs, or malformed `{style=slug}` directives before rendering.

#### Scenario: [OA-TMP-023] Contract IR validation rejects bad references
- **WHEN** a Contract IR content document contains an unknown variable,
  unknown style slug, or malformed style tag
- **THEN** validation fails with an actionable error
- **AND** no rendered artifacts are produced from the invalid template

### Requirement: Contract IR Dual Rendering
The system SHALL render a validated Contract IR template into both DOCX and a
readable Markdown preview from the same normalized model.

#### Scenario: [OA-TMP-024] Contract IR renders deterministic artifacts
- **WHEN** the SAFE board consent Contract IR template is generated
- **THEN** the system writes `template.docx` and `template.md`
- **AND** both artifacts contain the required headings, placeholders, and
  signature sections from the canonical content source

### Requirement: SAFE Board Consent Contract IR Backport
The system SHALL include the SAFE board consent template as a canonical
Contract IR-authored template under `content/templates/openagreements-board-consent-safe/`.

#### Scenario: [OA-TMP-025] SAFE board consent preserves source fidelity
- **WHEN** the Contract IR SAFE board consent is rendered
- **THEN** the output preserves the Joey Tsang board consent legal text,
  resolution flow, variable placeholders, and signature structure with
  materially similar professional formatting
