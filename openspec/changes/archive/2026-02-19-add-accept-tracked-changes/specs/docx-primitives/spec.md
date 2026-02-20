## ADDED Requirements

### Requirement: Tracked Change Acceptance Engine
The docx-primitives library SHALL programmatically accept all tracked changes in OOXML document body content, resolving each revision type into its accepted state.

#### Scenario: accept insertions by unwrapping w:ins wrappers
- **GIVEN** a document body containing `w:ins` elements wrapping inserted content
- **WHEN** the acceptance engine processes the document
- **THEN** all `w:ins` wrapper elements SHALL be removed
- **AND** their child content SHALL be promoted to the parent element in place

#### Scenario: accept deletions by removing w:del elements and content
- **GIVEN** a document body containing `w:del` elements wrapping deleted content
- **WHEN** the acceptance engine processes the document
- **THEN** all `w:del` elements and their children SHALL be removed entirely

#### Scenario: accept property changes by removing change records
- **GIVEN** a document body containing property change records (`w:rPrChange`, `w:pPrChange`, `w:sectPrChange`, `w:tblPrChange`, `w:trPrChange`, `w:tcPrChange`)
- **WHEN** the acceptance engine processes the document
- **THEN** the change record elements SHALL be removed
- **AND** the current formatting properties SHALL be preserved

#### Scenario: accept moves by keeping destination and removing source
- **GIVEN** a document body containing `w:moveFrom` and `w:moveTo` pairs
- **WHEN** the acceptance engine processes the document
- **THEN** `w:moveFrom` elements and their children SHALL be removed
- **AND** `w:moveTo` wrapper elements SHALL be removed with child content promoted to the parent

#### Scenario: bottom-up processing resolves nested revisions
- **GIVEN** nested tracked changes (e.g., a `w:del` inside a `w:ins`)
- **WHEN** the acceptance engine processes the document
- **THEN** inner revisions SHALL be resolved before outer revisions
- **AND** no orphaned elements SHALL remain

#### Scenario: orphaned moves handled with safe fallback
- **GIVEN** a `w:moveFrom` without a corresponding `w:moveTo` (or vice versa)
- **WHEN** the acceptance engine processes the document
- **THEN** orphaned `w:moveFrom` SHALL be treated as `w:del` (removed)
- **AND** orphaned `w:moveTo` SHALL be treated as `w:ins` (unwrapped)
