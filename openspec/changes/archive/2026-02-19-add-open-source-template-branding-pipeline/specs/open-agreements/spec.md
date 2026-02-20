## ADDED Requirements

### Requirement: Branded Employment Template Layout
The system SHALL generate OpenAgreements employment base templates with a
professional branded layout that includes section-specific running headers,
license/version footers with page numbering, fixed-width key-terms tables, and
structured signature-page components.

#### Scenario: Section-specific running headers
- **WHEN** employment templates are generated
- **THEN** each major section uses a running header with an accent top bar
- **AND** each header includes an all-caps section label (for example `COVER TERMS`, `STANDARD TERMS`, `SIGNATURE PAGE`)

#### Scenario: Footer metadata and page fields
- **WHEN** a generated employment template is opened in Word
- **THEN** the footer includes form name/version and `Free to use under CC BY 4.0`
- **AND** the footer contains dynamic `PAGE` and `NUMPAGES` fields rendered as `Page X of Y`

#### Scenario: Signature page uses structured table layout
- **WHEN** a generated employment template includes signature capture
- **THEN** the signature block is represented as a structured table with labeled rows (for example `Signature`, `Print Name`, `Title`, `Date`)
- **AND** signature line cells are layout-driven (table borders), not underscore characters

### Requirement: Open-Source Base Template Generation
Base template branding and generation SHALL be executable offline with
open-source tooling and SHALL NOT require Aspose at runtime.

#### Scenario: Runtime fill remains open-source
- **WHEN** a user fills a branded employment template through `fill`
- **THEN** the runtime path uses existing open-source rendering components
- **AND** no Aspose runtime license is required in cloud execution

#### Scenario: Optional LibreOffice normalization
- **WHEN** maintainers run the one-time LibreOffice normalization script in an environment with `soffice`
- **THEN** generated templates are re-exported via LibreOffice headless conversion
- **AND** if `soffice` is unavailable, the script exits with actionable setup guidance
