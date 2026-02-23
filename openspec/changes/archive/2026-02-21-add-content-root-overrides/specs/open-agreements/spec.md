## ADDED Requirements

### Requirement: Optional Content Root Overrides
The system SHALL support optional content root overrides via the
`OPEN_AGREEMENTS_CONTENT_ROOTS` environment variable. The value MUST be treated
as a path-delimited list of root directories that may contain `templates/`,
`external/`, and `recipes/` subdirectories.

#### Scenario: Default behavior without env var
- **WHEN** `OPEN_AGREEMENTS_CONTENT_ROOTS` is not set
- **THEN** agreement discovery uses bundled package directories only

#### Scenario: Additional discovery with env var
- **WHEN** `OPEN_AGREEMENTS_CONTENT_ROOTS` is set to one or more directories
- **THEN** agreement discovery includes matching IDs from those directories
- **AND** bundled package directories remain available as fallback

### Requirement: Content Root Precedence and Dedupe
The system SHALL apply deterministic precedence when duplicate agreement IDs
exist across multiple content roots, and the system SHALL dedupe by first
match.

#### Scenario: Override wins over bundled content
- **GIVEN** agreement ID `x` exists in both an override root and bundled content
- **WHEN** `OPEN_AGREEMENTS_CONTENT_ROOTS` includes the override root first
- **THEN** commands resolve ID `x` to the override root copy
- **AND** bundled duplicate entries are not listed a second time

### Requirement: Unified Root-Aware Command Resolution
The `fill`, `list`, and `validate` commands SHALL resolve agreements using the
merged root model (override roots first, bundled fallback).

#### Scenario: Fill from override root
- **WHEN** `fill <id>` is run and `<id>` exists only in an override root
- **THEN** the command resolves and fills that agreement successfully

#### Scenario: List includes override-only entries
- **WHEN** `list --json` is run with override roots configured
- **THEN** the output includes override-only entries merged into the inventory

#### Scenario: Validate single ID across tiers with overrides
- **WHEN** `validate <id>` is run for an ID present in templates, external, or recipes under override roots
- **THEN** the command validates the matching entry from the merged root set
