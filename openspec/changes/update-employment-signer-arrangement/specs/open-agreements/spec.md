## ADDED Requirements
### Requirement: Employment Signer Arrangement Rendering
The employment template renderer SHALL honor signer-mode arrangements so
canonical employment templates can express asymmetric entity/individual
signature blocks without mirrored title rows or row-level suppression flags.

#### Scenario: [OA-FIL-025] Entity-plus-individual signers render as stacked asymmetric blocks
- **WHEN** `cover-standard-signature-v1` renders a template with
  `mode: signers` and `arrangement=entity-plus-individual`
- **THEN** it renders a stacked entity signer block followed by a stacked
  individual signer block in DOCX
- **AND** the Markdown output preserves the same signer order
- **AND** the individual signer block omits any `Title` row
- **AND** legacy `two-party` rendering remains unchanged

### Requirement: Canonical Employment Templates Use the Signer Model
First-party employment templates SHALL express asymmetric signer semantics
through canonical signer metadata instead of mirrored `two-party` rows.

#### Scenario: [OA-TMP-036] Offer letter and employment signer sources avoid mirrored individual title rows
- **WHEN** the canonical employment template sources are compiled into contract
  specs
- **THEN** the employment offer letter is sourced from canonical `template.md`
  with a committed derived JSON spec
- **AND** the offer letter, Employee IP assignment, and Wyoming restrictive
  covenant templates all use `mode: signers`
- **AND** the entity signer may include `Title`
- **AND** the individual signer does not include `Title`
- **AND** no first-party employment template relies on `left_only`
