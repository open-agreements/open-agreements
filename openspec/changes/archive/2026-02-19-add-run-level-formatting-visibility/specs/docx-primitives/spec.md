## ADDED Requirements

### Requirement: Effective Run Formatting Extraction
The docx-primitives library SHALL extract effective formatting metadata per run, resolving the inheritance chain from paragraph style through run style to direct formatting.

#### Scenario: extract bold, italic, underline, highlighting tuple per run
- **GIVEN** a paragraph containing multiple runs with varying formatting
- **WHEN** effective formatting is extracted
- **THEN** each run SHALL produce a `(bold, italic, underline, highlighting)` tuple reflecting the resolved formatting
- **AND** inherited styles SHALL be resolved before direct formatting overrides

#### Scenario: detect hyperlink runs and extract href
- **GIVEN** a paragraph containing a hyperlink run with a relationship target
- **WHEN** effective formatting is extracted
- **THEN** the run SHALL be identified as a hyperlink
- **AND** the `href` SHALL be resolved from the relationship part

### Requirement: Base-Style Suppression Algorithm
The docx-primitives library SHALL compute a char-weighted modal formatting baseline to suppress redundant formatting tags for uniformly-styled paragraphs.

#### Scenario: char-weighted modal baseline selects dominant formatting tuple
- **GIVEN** a set of visible non-header runs with varying `(bold, italic, underline)` tuples
- **WHEN** the baseline is computed
- **THEN** the tuple with the highest total character weight SHALL be selected as baseline

#### Scenario: tie-break by earliest run when modal weights are equal
- **GIVEN** two or more formatting tuples with equal total character weight
- **WHEN** the baseline is computed
- **THEN** the tuple belonging to the earliest run in document order SHALL be selected

#### Scenario: suppression disabled when baseline coverage below 60%
- **GIVEN** a set of visible non-header runs where no single formatting tuple covers >= 60% of characters
- **WHEN** the baseline is computed
- **THEN** suppression SHALL be disabled
- **AND** absolute formatting tags SHALL be emitted for all runs

#### Scenario: tags nested in consistent order
- **GIVEN** a run with multiple formatting properties (e.g., bold + italic + underline)
- **WHEN** formatting tags are emitted
- **THEN** tags SHALL be nested in the order: `<b>` > `<i>` > `<u>` > `<highlighting>` (outermost to innermost)
