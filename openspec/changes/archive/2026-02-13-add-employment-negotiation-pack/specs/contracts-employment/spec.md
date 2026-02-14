## ADDED Requirements

### Requirement: Employment Template Pack
The system SHALL provide a dedicated employment template pack for startup hiring
workflows. At minimum, the pack MUST include an offer letter and an employee
IP/inventions assignment agreement.

#### Scenario: Employment templates listed
- **WHEN** a user runs template discovery commands
- **THEN** the employment templates are visible with source, license, and field metadata

#### Scenario: Employment template fill
- **WHEN** a user fills a supported employment template with required inputs
- **THEN** the system generates a signable DOCX output using existing fill guarantees

### Requirement: Structured Negotiation Memo Output
The system SHALL provide an optional structured negotiation memo output for
employment workflows. The memo MUST contain findings categories, citations to
underlying rules/templates, and confidence labels.

#### Scenario: Memo includes deterministic findings
- **WHEN** memo generation runs on a filled employment workflow
- **THEN** output includes clause checks and baseline variance findings
- **AND** each finding includes an evidence reference

#### Scenario: Memo available as markdown and JSON
- **WHEN** a user requests memo output
- **THEN** the system can emit memo artifacts in both markdown and JSON formats

### Requirement: Jurisdiction-Aware Warning Rules
The system SHALL support jurisdiction-aware warning rules for employment
workflow categories. Each rule MUST include source reference and source date.

#### Scenario: Jurisdiction warning triggered
- **WHEN** a clause pattern matches a configured jurisdiction-sensitive rule
- **THEN** the memo includes a warning with jurisdiction label, rule id, and source metadata

#### Scenario: No matching rule
- **WHEN** no jurisdiction rule matches a clause category
- **THEN** the system does not fabricate a jurisdiction warning

### Requirement: Information-Only Output Boundary
Employment memo and review outputs SHALL remain within information-only
boundaries and MUST NOT present personalized legal advice.

#### Scenario: Mandatory non-advice disclaimer
- **WHEN** an employment memo is generated
- **THEN** the output includes explicit non-legal-advice disclaimer text

#### Scenario: Advice-like recommendation blocked
- **WHEN** output generation would emit prescriptive legal strategy language
- **THEN** the system blocks or rewrites the phrase to a neutral informational form
- **AND** includes counsel-escalation guidance for high-risk findings

### Requirement: Licensing and Provenance Controls
Employment template content SHALL follow the existing licensing model for
in-repo, external, and pointer/recipe content sources.

#### Scenario: Permissive source included in repo
- **WHEN** a template source allows redistribution under compatible terms
- **THEN** the template may be included in-repo with required attribution metadata

#### Scenario: Restricted source handled as pointer/recipe
- **WHEN** a template source has restricted or unclear redistribution rights
- **THEN** the system stores pointer/recipe metadata rather than vendoring source text

### Requirement: Source Terms Compatibility Gate
Employment source onboarding SHALL enforce terms-of-use compatibility before
automated fetch, transformation, or redistribution workflows are enabled.

#### Scenario: Restricted provider blocks automation
- **WHEN** source terms prohibit redistribution, derivative transformation,
  automated scraping/crawling, or external linking without permission
- **THEN** the source is classified as `restricted-no-automation`
- **AND** catalog fetch, recipe auto-download, and in-repo vendoring are not enabled by default

#### Scenario: Written permission allows reclassification
- **WHEN** maintainers record explicit written permission that authorizes the
  intended automation and distribution pattern
- **THEN** the source may be reclassified to pointer or recipe tier with
  documented constraints and provenance metadata

### Requirement: Documentation of Usage Boundaries
Project documentation SHALL include employment workflow boundaries, including
what the system does and does not do in UPL-sensitive contexts.

#### Scenario: User reads employment docs
- **WHEN** a user reads employment workflow documentation
- **THEN** docs clearly state information-only scope, licensing boundaries, and when to consult counsel
