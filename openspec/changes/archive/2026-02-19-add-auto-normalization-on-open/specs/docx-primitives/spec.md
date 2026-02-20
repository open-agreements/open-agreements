## ADDED Requirements

### Requirement: Run Merging with Safety Barriers
The docx-primitives library SHALL merge adjacent format-identical runs to reduce XML fragmentation, while enforcing safety barriers that prevent merges across structural boundaries.

#### Scenario: merge adjacent runs with equivalent formatting
- **GIVEN** a paragraph containing adjacent runs with identical effective run properties
- **WHEN** `merge_runs` is called
- **THEN** the adjacent runs SHALL be consolidated into a single run
- **AND** the merged run SHALL preserve the original visible text and formatting

#### Scenario: never merge across field boundaries
- **GIVEN** a paragraph containing runs separated by `fldChar` or `instrText` elements
- **WHEN** `merge_runs` is called
- **THEN** the runs SHALL NOT be merged across the field boundary
- **AND** field structure SHALL remain intact

#### Scenario: never merge across comment range boundaries
- **GIVEN** a paragraph containing runs separated by `commentRangeStart` or `commentRangeEnd` markers
- **WHEN** `merge_runs` is called
- **THEN** the runs SHALL NOT be merged across comment range boundaries

#### Scenario: never merge across bookmark boundaries
- **GIVEN** a paragraph containing runs separated by `bookmarkStart` or `bookmarkEnd` markers
- **WHEN** `merge_runs` is called
- **THEN** the runs SHALL NOT be merged across bookmark boundaries

#### Scenario: never merge across tracked-change wrapper boundaries
- **GIVEN** a paragraph containing runs inside different tracked-change wrappers (`w:ins`, `w:del`, `w:moveFrom`, `w:moveTo`)
- **WHEN** `merge_runs` is called
- **THEN** runs in different tracked-change wrappers SHALL NOT be merged

### Requirement: Redline Simplification with Author Constraint
The docx-primitives library SHALL consolidate adjacent tracked-change wrappers of the same type and author to reduce XML verbosity, without altering document semantics.

#### Scenario: merge adjacent same-author same-type tracked-change wrappers
- **GIVEN** adjacent `w:ins` (or `w:del`) wrappers attributed to the same author
- **WHEN** `simplify_redlines` is called
- **THEN** the adjacent wrappers SHALL be consolidated into a single wrapper
- **AND** the merged wrapper SHALL preserve all child content

#### Scenario: never merge wrappers from different authors
- **GIVEN** adjacent tracked-change wrappers attributed to different authors
- **WHEN** `simplify_redlines` is called
- **THEN** the wrappers SHALL NOT be merged
- **AND** author attribution SHALL be preserved

#### Scenario: never merge across different change types
- **GIVEN** adjacent tracked-change wrappers of different types (e.g., `w:ins` followed by `w:del`)
- **WHEN** `simplify_redlines` is called
- **THEN** the wrappers SHALL NOT be merged
