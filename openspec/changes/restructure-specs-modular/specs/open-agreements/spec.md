## REMOVED Requirements

### Requirement: Template Engine Sandboxing
**Reason**: Moved to the `engine` capability during modular spec restructuring.
**Migration**: See `openspec/specs/engine/spec.md`.

### Requirement: Template Validation Severity
**Reason**: Moved to the `validation` capability during modular spec restructuring.
**Migration**: See `openspec/specs/validation/spec.md`.

### Requirement: DOCX Text Extraction
**Reason**: Moved to the `engine` capability during modular spec restructuring.
**Migration**: See `openspec/specs/engine/spec.md`.

### Requirement: Metadata Schema Constraints
**Reason**: Moved to the `validation` capability during modular spec restructuring.
**Migration**: See `openspec/specs/validation/spec.md`.

### Requirement: Fill Value Validation
**Reason**: Moved to the `engine` capability during modular spec restructuring.
**Migration**: See `openspec/specs/engine/spec.md`.

### Requirement: CI License Compliance
**Reason**: Moved to the `ip-license` capability during modular spec restructuring.
**Migration**: See `openspec/specs/ip-license/spec.md`.

### Requirement: Recipe Pipeline
**Reason**: Moved to the `recipes` capability during modular spec restructuring.
**Migration**: See `openspec/specs/recipes/spec.md`.

### Requirement: Recipe CLI Subcommands
**Reason**: Moved to the `cli` capability during modular spec restructuring.
**Migration**: See `openspec/specs/cli/spec.md`.

### Requirement: DOCX Cleaner
**Reason**: Moved to the `recipes` capability during modular spec restructuring.
**Migration**: See `openspec/specs/recipes/spec.md`.

### Requirement: Cross-Run Patcher
**Reason**: Moved to the `recipes` capability during modular spec restructuring.
**Migration**: See `openspec/specs/recipes/spec.md`.

### Requirement: Post-Fill Verifier
**Reason**: Moved to the `recipes` capability during modular spec restructuring.
**Migration**: See `openspec/specs/recipes/spec.md`.

### Requirement: Scan Command
**Reason**: Moved to the `cli` capability during modular spec restructuring.
**Migration**: See `openspec/specs/cli/spec.md`.

### Requirement: Recipe Metadata Schema
Recipe metadata MUST be defined in `metadata.yaml` and validate against a Zod
schema. Required fields: `name`, `source_url` (valid URL), `source_version`,
`license_note`, `fields` (array of field definitions, reusing template field
schema). Optional fields: `description`, `optional` (boolean, default false).

#### Scenario: [OA-RCP-014] Valid recipe metadata
- **WHEN** a recipe has `metadata.yaml` with all required fields
- **THEN** schema validation passes

#### Scenario: [OA-RCP-015] Missing source_url
- **WHEN** a recipe metadata omits `source_url`
- **THEN** schema validation fails with a descriptive error

**Reason**: Shape duplicates Zod schema in `src/core/metadata.ts` after the JSDoc audit carried forward load-bearing schema prose.
**Migration**: Use the exported Zod schemas in `src/core/metadata.ts` as the metadata shape source of truth.
### Requirement: Recipe Directory Validation
**Reason**: Moved to the `validation` capability during modular spec restructuring.
**Migration**: See `openspec/specs/validation/spec.md`.

### Requirement: DOCX Template Rendering
**Reason**: Moved to the `engine` capability during modular spec restructuring.
**Migration**: See `openspec/specs/engine/spec.md`.

### Requirement: Mutual NDA Selection Semantics
The `common-paper-mutual-nda` fill flow SHALL preserve only selected option
text for checkbox-style MNDA term and confidentiality term choices, while
marking selected choices with `[ x ]`.

#### Scenario: [OA-TMP-007] Fixed term selection removes non-selected options
- **GIVEN** the user sets `mnda_term` to a fixed duration
- **AND** sets `confidentiality_term` to fixed-term language
- **WHEN** the template is filled
- **THEN** fixed-term options are marked with `[ x ]`
- **AND** conflicting alternatives (for example "until terminated" or "in perpetuity") are removed

#### Scenario: [OA-TMP-008] Perpetual selection marks selected options
- **GIVEN** the user sets `mnda_term` to `until terminated`
- **AND** sets `confidentiality_term` to `In perpetuity`
- **WHEN** the template is filled
- **THEN** the selected until-terminated and perpetuity options are marked with `[ x ]`
- **AND** non-selected fixed-term alternatives are removed

**Reason**: Template-family content extracted to content/templates/common-paper-mutual-nda/README.md.
**Migration**: See content/templates/common-paper-mutual-nda/README.md.
### Requirement: Signature Block Fields
**Reason**: Moved to the `engine` capability during modular spec restructuring.
**Migration**: See `openspec/specs/engine/spec.md`.

### Requirement: Template Metadata Schema
Each template directory SHALL contain a `metadata.yaml` validated by Zod schema
with fields: `name`, `source_url`, `version`, `license` (enum: CC-BY-4.0,
CC0-1.0), `allow_derivatives` (boolean), `attribution_text`, and `fields`
(array of field definitions with `name`, `type`, `description`, and optional
field metadata such as defaults, sections, enum options, and nested `items`
definitions for array fields).

#### Scenario: [OA-TMP-009] Valid metadata passes validation
- **GIVEN** a template directory with a `metadata.yaml` containing all required fields with valid values
- **WHEN** the system validates the metadata
- **THEN** validation passes with no errors

#### Scenario: [OA-TMP-010] Missing metadata field fails validation
- **GIVEN** a template directory with a `metadata.yaml` missing the `license` field
- **WHEN** the system validates the metadata
- **THEN** validation fails with an error identifying the missing field

#### Scenario: [OA-TMP-011] Invalid license enum fails validation
- **GIVEN** a template directory with `metadata.yaml` containing `license: MIT`
- **WHEN** the system validates the metadata
- **THEN** validation fails with an error indicating the license value is not in the allowed enum (CC-BY-4.0, CC0-1.0)

#### Scenario: [OA-TMP-028] Array field item schemas pass validation
- **GIVEN** a template metadata file with an array field that declares nested `items` field definitions
- **WHEN** the metadata is validated
- **THEN** validation accepts the array field schema
- **AND** nested item field definitions use the same field-definition rules as top-level fields

**Reason**: Shape duplicates Zod schema in `src/core/metadata.ts` after the JSDoc audit carried forward load-bearing schema prose.
**Migration**: Use the exported Zod schemas in `src/core/metadata.ts` as the metadata shape source of truth.
### Requirement: License Compliance Validation
**Reason**: Moved to the `ip-license` capability during modular spec restructuring.
**Migration**: See `openspec/specs/ip-license/spec.md`.

### Requirement: External Template Support
**Reason**: Moved to the `engine` capability during modular spec restructuring.
**Migration**: See `openspec/specs/engine/spec.md`.

### Requirement: CLI Interface
**Reason**: Moved to the `cli` capability during modular spec restructuring.
**Migration**: See `openspec/specs/cli/spec.md`.

### Requirement: Claude Code Skill
**Reason**: Moved to the `cli` capability during modular spec restructuring.
**Migration**: See `openspec/specs/cli/spec.md`.

### Requirement: Output Validation
**Reason**: Moved to the `engine` capability during modular spec restructuring.
**Migration**: See `openspec/specs/engine/spec.md`.

### Requirement: Agent-Agnostic Skill Architecture
**Reason**: Moved to the `cli` capability during modular spec restructuring.
**Migration**: See `openspec/specs/cli/spec.md`.

### Requirement: Agent Skills Specification Compliance
**Reason**: Moved to the `cli` capability during modular spec restructuring.
**Migration**: See `openspec/specs/cli/spec.md`.

### Requirement: Machine-Readable Template Discovery
**Reason**: Moved to the `cli` capability during modular spec restructuring.
**Migration**: See `openspec/specs/cli/spec.md`.

### Requirement: npm Package Integrity
**Reason**: Moved to the `distribution` capability during modular spec restructuring.
**Migration**: See `openspec/specs/distribution/spec.md`.

### Requirement: Gated Skills Directory Publish Workflow
**Reason**: Moved to the `distribution` capability during modular spec restructuring.
**Migration**: See `openspec/specs/distribution/spec.md`.

### Requirement: Skill Version-Sourced Directory Publishing
**Reason**: Moved to the `distribution` capability during modular spec restructuring.
**Migration**: See `openspec/specs/distribution/spec.md`.

### Requirement: Explicit Directory Publish Scope
**Reason**: Moved to the `distribution` capability during modular spec restructuring.
**Migration**: See `openspec/specs/distribution/spec.md`.

### Requirement: Token-Based Registry Authentication
**Reason**: Moved to the `distribution` capability during modular spec restructuring.
**Migration**: See `openspec/specs/distribution/spec.md`.

### Requirement: Local Contract Templates MCP Server
**Reason**: Moved to the `distribution` capability during modular spec restructuring.
**Migration**: See `openspec/specs/distribution/spec.md`.

### Requirement: Gemini Extension Manifest Contract
**Reason**: Moved to the `distribution` capability during modular spec restructuring.
**Migration**: See `openspec/specs/distribution/spec.md`.

### Requirement: Isolated Package Runtime Smoke Gate
**Reason**: Moved to the `distribution` capability during modular spec restructuring.
**Migration**: See `openspec/specs/distribution/spec.md`.

### Requirement: Recipe Computed Interaction Profiles
**Reason**: Moved to the `engine` capability during modular spec restructuring.
**Migration**: See `openspec/specs/engine/spec.md`.

### Requirement: Computed Artifact Export
**Reason**: Moved to the `engine` capability during modular spec restructuring.
**Migration**: See `openspec/specs/engine/spec.md`.

### Requirement: Computed Profile Validation
**Reason**: Moved to the `engine` capability during modular spec restructuring.
**Migration**: See `openspec/specs/engine/spec.md`.

### Requirement: NVCA SPA Interaction Audit Coverage
The NVCA SPA test suite SHALL include interaction-focused coverage that asserts multi-condition derived outputs and their traceability, including Dispute Resolution and Governing Law dependencies.

#### Scenario: [OA-FIL-002] Dispute resolution interaction produces required computed outputs
- **WHEN** NVCA SPA computed inputs select courts vs arbitration and include a forum state
- **THEN** computed outputs indicate the selected dispute-resolution track
- **AND** computed outputs include forum vs governing-law alignment status
- **AND** when courts are selected and judicial district is omitted, computed outputs derive judicial district defaults
- **AND** the exported trace shows the dependency chain

**Reason**: Template-family content extracted to content/recipes/nvca-stock-purchase-agreement/README.md.
**Migration**: See content/recipes/nvca-stock-purchase-agreement/README.md.
### Requirement: Optional Content Root Overrides
**Reason**: Moved to the `cli` capability during modular spec restructuring.
**Migration**: See `openspec/specs/cli/spec.md`.

### Requirement: Content Root Precedence and Dedupe
**Reason**: Moved to the `cli` capability during modular spec restructuring.
**Migration**: See `openspec/specs/cli/spec.md`.

### Requirement: Unified Root-Aware Command Resolution
**Reason**: Moved to the `cli` capability during modular spec restructuring.
**Migration**: See `openspec/specs/cli/spec.md`.

### Requirement: Public Trust Signal Surfaces
**Reason**: Moved to the `quality-gates` capability during modular spec restructuring.
**Migration**: See `openspec/specs/quality-gates/spec.md`.

### Requirement: Binary Trust Mapping Status
**Reason**: Moved to the `quality-gates` capability during modular spec restructuring.
**Migration**: See `openspec/specs/quality-gates/spec.md`.

### Requirement: Runtime Trust Data Freshness Gate
**Reason**: Moved to the `quality-gates` capability during modular spec restructuring.
**Migration**: See `openspec/specs/quality-gates/spec.md`.

### Requirement: Generated README Consistency
**Reason**: Moved to the `quality-gates` capability during modular spec restructuring.
**Migration**: See `openspec/specs/quality-gates/spec.md`.

### Requirement: README Drift Gate
**Reason**: Moved to the `quality-gates` capability during modular spec restructuring.
**Migration**: See `openspec/specs/quality-gates/spec.md`.

### Requirement: CI-Published Coverage and Test Results
**Reason**: Moved to the `quality-gates` capability during modular spec restructuring.
**Migration**: See `openspec/specs/quality-gates/spec.md`.

### Requirement: Repository-Defined Coverage Gate Policy
**Reason**: Moved to the `quality-gates` capability during modular spec restructuring.
**Migration**: See `openspec/specs/quality-gates/spec.md`.

### Requirement: Spec-Backed Allure Coverage Expansion
**Reason**: Moved to the `quality-gates` capability during modular spec restructuring.
**Migration**: See `openspec/specs/quality-gates/spec.md`.

### Requirement: Canonical Evidence Story
**Reason**: Moved to the `quality-gates` capability during modular spec restructuring.
**Migration**: See `openspec/specs/quality-gates/spec.md`.

### Requirement: Document-First Closing Checklist Data Model
**Reason**: Moved to the `closing-checklist` capability during modular spec restructuring.
**Migration**: See `openspec/specs/closing-checklist/spec.md`.

### Requirement: Stage-First Nested Lawyer Rendering
**Reason**: Moved to the `closing-checklist` capability during modular spec restructuring.
**Migration**: See `openspec/specs/closing-checklist/spec.md`.

### Requirement: Stable Sort Key and Computed Display Numbering
**Reason**: Moved to the `closing-checklist` capability during modular spec restructuring.
**Migration**: See `openspec/specs/closing-checklist/spec.md`.

### Requirement: Optional Document Labels
**Reason**: Moved to the `closing-checklist` capability during modular spec restructuring.
**Migration**: See `openspec/specs/closing-checklist/spec.md`.

### Requirement: Named Signatory Tracking with Signature Artifacts
**Reason**: Moved to the `closing-checklist` capability during modular spec restructuring.
**Migration**: See `openspec/specs/closing-checklist/spec.md`.

### Requirement: Minimal Citation Support
**Reason**: Moved to the `closing-checklist` capability during modular spec restructuring.
**Migration**: See `openspec/specs/closing-checklist/spec.md`.

### Requirement: Document-Linked and Document-Less Checklist Entries
**Reason**: Moved to the `closing-checklist` capability during modular spec restructuring.
**Migration**: See `openspec/specs/closing-checklist/spec.md`.

### Requirement: Simplified Issue Lifecycle
**Reason**: Moved to the `closing-checklist` capability during modular spec restructuring.
**Migration**: See `openspec/specs/closing-checklist/spec.md`.

### Requirement: Standalone Working Group Document
**Reason**: Moved to the `closing-checklist` capability during modular spec restructuring.
**Migration**: See `openspec/specs/closing-checklist/spec.md`.

### Requirement: Legacy Checklist Payload Rejection
**Reason**: Moved to the `closing-checklist` capability during modular spec restructuring.
**Migration**: See `openspec/specs/closing-checklist/spec.md`.

### Requirement: Atomic Checklist JSON Patch Transactions
**Reason**: Moved to the `closing-checklist` capability during modular spec restructuring.
**Migration**: See `openspec/specs/closing-checklist/spec.md`.

### Requirement: Optimistic Concurrency for Patch Apply
**Reason**: Moved to the `closing-checklist` capability during modular spec restructuring.
**Migration**: See `openspec/specs/closing-checklist/spec.md`.

### Requirement: Dry-Run Patch Validation
**Reason**: Moved to the `closing-checklist` capability during modular spec restructuring.
**Migration**: See `openspec/specs/closing-checklist/spec.md`.

### Requirement: Apply Requires Prior Successful Validation
**Reason**: Moved to the `closing-checklist` capability during modular spec restructuring.
**Migration**: See `openspec/specs/closing-checklist/spec.md`.

### Requirement: Strict Target Resolution Without Guessing
**Reason**: Moved to the `closing-checklist` capability during modular spec restructuring.
**Migration**: See `openspec/specs/closing-checklist/spec.md`.

### Requirement: Patch-Level Idempotency
**Reason**: Moved to the `closing-checklist` capability during modular spec restructuring.
**Migration**: See `openspec/specs/closing-checklist/spec.md`.

### Requirement: Flexible Evidence Citations in Patch Updates
**Reason**: Moved to the `closing-checklist` capability during modular spec restructuring.
**Migration**: See `openspec/specs/closing-checklist/spec.md`.

### Requirement: Optional Proposed Patch Mode
**Reason**: Moved to the `closing-checklist` capability during modular spec restructuring.
**Migration**: See `openspec/specs/closing-checklist/spec.md`.

### Requirement: Currency Field Detection and Sanitization
**Reason**: Moved to the `engine` capability during modular spec restructuring.
**Migration**: See `openspec/specs/engine/spec.md`.

### Requirement: Post-Fill Verification Checks
**Reason**: Moved to the `engine` capability during modular spec restructuring.
**Migration**: See `openspec/specs/engine/spec.md`.

### Requirement: Fill Data Preparation
**Reason**: Moved to the `engine` capability during modular spec restructuring.
**Migration**: See `openspec/specs/engine/spec.md`.

### Requirement: Multiselect Derived Boolean Fill Behavior
**Reason**: Moved to the `engine` capability during modular spec restructuring.
**Migration**: See `openspec/specs/engine/spec.md`.

### Requirement: Fill Pipeline DOCX Rendering
**Reason**: Moved to the `engine` capability during modular spec restructuring.
**Migration**: See `openspec/specs/engine/spec.md`.

### Requirement: Fill Pipeline Behavioral Consistency
**Reason**: Moved to the `engine` capability during modular spec restructuring.
**Migration**: See `openspec/specs/engine/spec.md`.

### Requirement: Loop-Based Array Rendering
**Reason**: Moved to the `engine` capability during modular spec restructuring.
**Migration**: See `openspec/specs/engine/spec.md`.

### Requirement: Employment Signer Arrangement Rendering
The employment template renderer SHALL honor signer-mode arrangements so
canonical employment templates can express asymmetric entity/individual
signature blocks without mirrored title rows or row-level suppression flags.

#### Scenario: [OA-FIL-029] Entity-plus-individual signers render as stacked asymmetric blocks
- **WHEN** `cover-standard-signature-v1` renders a template with
  `mode: signers` and `arrangement=entity-plus-individual`
- **THEN** it renders a stacked entity signer block followed by a stacked
  individual signer block in DOCX
- **AND** the Markdown output preserves the same signer order
- **AND** the individual signer block omits any `Title` row
- **AND** legacy `two-party` rendering remains unchanged

**Reason**: Template-family content extracted to content/templates/openagreements-employment-offer-letter/README.md.
**Migration**: See content/templates/openagreements-employment-offer-letter/README.md.
### Requirement: API Endpoint Protocol Compliance
**Reason**: Moved to the `distribution` capability during modular spec restructuring.
**Migration**: See `openspec/specs/distribution/spec.md`.

### Requirement: OpenSpec Coverage Validation Script
**Reason**: Moved to the `quality-gates` capability during modular spec restructuring.
**Migration**: See `openspec/specs/quality-gates/spec.md`.

### Requirement: Template Validation for All Templates
**Reason**: Moved to the `validation` capability during modular spec restructuring.
**Migration**: See `openspec/specs/validation/spec.md`.

### Requirement: Canonical Markdown Employment Template Authoring
**Reason**: Moved to the `authoring` capability during modular spec restructuring.
**Migration**: See `openspec/specs/authoring/spec.md`.

### Requirement: Canonical Employment Templates Use the Signer Model
**Reason**: Moved to the `authoring` capability during modular spec restructuring.
**Migration**: See `openspec/specs/authoring/spec.md`.

### Requirement: CLI Fill for All Template Types
**Reason**: Moved to the `cli` capability during modular spec restructuring.
**Migration**: See `openspec/specs/cli/spec.md`.

### Requirement: npm Package Distribution Integrity
**Reason**: Moved to the `distribution` capability during modular spec restructuring.
**Migration**: See `openspec/specs/distribution/spec.md`.

### Requirement: List Command Envelope Structure
**Reason**: Moved to the `cli` capability during modular spec restructuring.
**Migration**: See `openspec/specs/cli/spec.md`.

### Requirement: Recipe Validation for Bundled Recipes
**Reason**: Moved to the `validation` capability during modular spec restructuring.
**Migration**: See `openspec/specs/validation/spec.md`.

### Requirement: Recipe Negative Validation
**Reason**: Moved to the `validation` capability during modular spec restructuring.
**Migration**: See `openspec/specs/validation/spec.md`.

### Requirement: MCP Protocol Envelope Contract
**Reason**: Moved to the `mcp-contract-templates` capability during modular spec restructuring.
**Migration**: See `openspec/specs/mcp-contract-templates/spec.md`.

### Requirement: MCP Template Discovery Preserves Field Metadata
**Reason**: Moved to the `mcp-contract-templates` capability during modular spec restructuring.
**Migration**: See `openspec/specs/mcp-contract-templates/spec.md`.

### Requirement: Employment Memo Generation
The employment memo generator MUST produce disclaimers, findings, jurisdiction
warnings, and language-guarded output for matching employment templates.

#### Scenario: [OA-FIL-016] Employment memo content generation
- **WHEN** an employment template fill triggers memo generation with matching jurisdiction rules
- **THEN** output includes mandatory disclaimer, compliance findings, and jurisdiction-specific warnings
- **AND** deterministic baseline variance findings are produced against the selected baseline template
- **AND** markdown output includes mandatory disclaimer and citations

#### Scenario: [OA-FIL-017] Employment memo language guard
- **WHEN** memo text contains prescriptive wording or prohibited phrases
- **THEN** the language guard rewrites prescriptive wording and blocks prohibited phrases

**Reason**: Template-family content extracted to content/templates/openagreements-employment-offer-letter/README.md.
**Migration**: See content/templates/openagreements-employment-offer-letter/README.md.
### Requirement: Source Drift Detection
**Reason**: Moved to the `recipes` capability during modular spec restructuring.
**Migration**: See `openspec/specs/recipes/spec.md`.

### Requirement: NVCA Option Vesting Policy Computation
The NVCA option resolution engine MUST apply clause-level policies including
costs-of-enforcement and dispute-resolution, defaulting venue and district values.

#### Scenario: [OA-FIL-018] NVCA clause policy resolution
- **WHEN** costs-of-enforcement policy is applied
- **THEN** only the each-party clause is retained
- **AND** when dispute-resolution selects arbitration, venue defaults are applied
- **AND** when courts are selected, district defaults by state with alignment flags

#### Scenario: [OA-FIL-019] Unresolved legal alternatives preserved
- **WHEN** no explicit clause policy is defined for an in-line legal alternative
- **THEN** the alternative text is preserved unresolved until a policy is added

**Reason**: Template-family content extracted to content/recipes/nvca-voting-agreement/README.md.
**Migration**: See content/recipes/nvca-voting-agreement/README.md.
### Requirement: JSON Template Renderer
**Reason**: Moved to the `engine` capability during modular spec restructuring.
**Migration**: See `openspec/specs/engine/spec.md`.

### Requirement: NVCA Template Assumption Validation
The NVCA template processing MUST preserve bracket-prefixed headings while removing
bracketed alternatives during clean, and normalize heading-leading brackets during
the normalize step.

#### Scenario: [OA-TMP-018] NVCA clean and normalize assumptions
- **WHEN** the clean step processes bracket-prefixed headings and bracketed alternatives
- **THEN** bracket-prefixed headings are preserved while bracketed alternatives are removed
- **AND** declarative normalize strips heading-leading brackets and trims unmatched trailing brackets

**Reason**: Template-family content extracted to content/recipes/nvca-voting-agreement/README.md.
**Migration**: See content/recipes/nvca-voting-agreement/README.md.
### Requirement: Metadata Completeness Assessment
**Reason**: Moved to the `validation` capability during modular spec restructuring.
**Migration**: See `openspec/specs/validation/spec.md`.

### Requirement: Employment Template Formatting Integrity
Employment templates MUST maintain paragraph style names and spacing values
(e.g. 6pt) in Standard Terms sections across all employment template variants.

#### Scenario: [OA-FIL-020] Employment template paragraph styles and spacing
- **WHEN** employment templates are examined for Standard Terms sections
- **THEN** paragraph style names match expected values
- **AND** spacing values are preserved (e.g. 6pt)

**Reason**: Template-family content extracted to content/templates/openagreements-employment-offer-letter/README.md.
**Migration**: See content/templates/openagreements-employment-offer-letter/README.md.
### Requirement: Formatting Diff Boundary Conditions
Run-level formatting operations MUST preserve underline boundaries while stripping
heading-leading brackets and trimming trailing unmatched brackets without moving
anchored text.

#### Scenario: [OA-FIL-021] Formatting boundary preservation
- **WHEN** bracket stripping operates on underlined heading text
- **THEN** underline boundaries are preserved
- **AND** trailing unmatched brackets are trimmed without moving underlined anchor text

**Reason**: Template-family content extracted to content/templates/openagreements-employment-offer-letter/README.md.
**Migration**: See content/templates/openagreements-employment-offer-letter/README.md.
### Requirement: Closing Checklist Stage-First Rendering
**Reason**: Moved to the `closing-checklist` capability during modular spec restructuring.
**Migration**: See `openspec/specs/closing-checklist/spec.md`.

### Requirement: NVCA SPA Preview Rendering
The system SHALL support rendering NVCA SPA template output as PNG evidence
pages for human review.

#### Scenario: [OA-FIL-022] NVCA rendered preview evidence
- **WHEN** NVCA template prerequisites are available
- **THEN** rendered pages are attached as PNG evidence for human review

**Reason**: Template-family content extracted to content/recipes/nvca-stock-purchase-agreement/README.md.
**Migration**: See content/recipes/nvca-stock-purchase-agreement/README.md.
### Requirement: Working Group List Rendering
**Reason**: Moved to the `closing-checklist` capability during modular spec restructuring.
**Migration**: See `openspec/specs/closing-checklist/spec.md`.

### Requirement: Recipe Patcher Operations
**Reason**: Moved to the `recipes` capability during modular spec restructuring.
**Migration**: See `openspec/specs/recipes/spec.md`.

### Requirement: Recipe Patcher Extensions
**Reason**: Moved to the `recipes` capability during modular spec restructuring.
**Migration**: See `openspec/specs/recipes/spec.md`.

### Requirement: Replacement Key Parsing
**Reason**: Moved to the `recipes` capability during modular spec restructuring.
**Migration**: See `openspec/specs/recipes/spec.md`.

### Requirement: Recipe Verifier Edge Cases
**Reason**: Moved to the `validation` capability during modular spec restructuring.
**Migration**: See `openspec/specs/validation/spec.md`.

### Requirement: OOXML Part Enumeration
**Reason**: Moved to the `recipes` capability during modular spec restructuring.
**Migration**: See `openspec/specs/recipes/spec.md`.

### Requirement: Bracket Artifact Normalization
**Reason**: Moved to the `recipes` capability during modular spec restructuring.
**Migration**: See `openspec/specs/recipes/spec.md`.

### Requirement: Declarative Paragraph Pruning
**Reason**: Moved to the `recipes` capability during modular spec restructuring.
**Migration**: See `openspec/specs/recipes/spec.md`.

### Requirement: Metadata Field Schema Validation
**Reason**: Moved to the `validation` capability during modular spec restructuring.
**Migration**: See `openspec/specs/validation/spec.md`.

### Requirement: Template Metadata Required Fields
**Reason**: Moved to the `validation` capability during modular spec restructuring.
**Migration**: See `openspec/specs/validation/spec.md`.

### Requirement: Recipe Metadata Defaults
**Reason**: Moved to the `validation` capability during modular spec restructuring.
**Migration**: See `openspec/specs/validation/spec.md`.

### Requirement: Clean Configuration Schema
**Reason**: Moved to the `validation` capability during modular spec restructuring.
**Migration**: See `openspec/specs/validation/spec.md`.

### Requirement: Guidance Output Schema
**Reason**: Moved to the `validation` capability during modular spec restructuring.
**Migration**: See `openspec/specs/validation/spec.md`.

### Requirement: Checklist Schema Structural Rules
**Reason**: Moved to the `validation` capability during modular spec restructuring.
**Migration**: See `openspec/specs/validation/spec.md`.

### Requirement: Patch Schema Validation Rules
**Reason**: Moved to the `validation` capability during modular spec restructuring.
**Migration**: See `openspec/specs/validation/spec.md`.

### Requirement: Patch Validator Artifact Expiry
**Reason**: Moved to the `validation` capability during modular spec restructuring.
**Migration**: See `openspec/specs/validation/spec.md`.

### Requirement: Template Credits and Provenance
**Reason**: Moved to the `validation` capability during modular spec restructuring.
**Migration**: See `openspec/specs/validation/spec.md`.

### Requirement: Canonical Markdown Section Directive Anchors
**Reason**: Moved to the `authoring` capability during modular spec restructuring.
**Migration**: See `openspec/specs/authoring/spec.md`.

### Requirement: Canonical Markdown Repeat-Backed Signer Authoring
**Reason**: Moved to the `authoring` capability during modular spec restructuring.
**Migration**: See `openspec/specs/authoring/spec.md`.

### Requirement: SAFE Board Consent Canonical Markdown Authoring
The SAFE board consent SHALL be authored canonically in
`content/templates/openagreements-board-consent-safe/template.md`, with the
generated JSON spec and rendered DOCX derived from that source.

#### Scenario: [OA-TMP-059] SAFE board consent canonical source preserves source fidelity
- **WHEN** the SAFE board consent canonical source is compiled, rendered, and
  filled
- **THEN** the generated outputs preserve the board consent legal text,
  resolution flow, placeholders, and professional formatting
- **AND** the signature section expands `board_members` into the exact number
  of signer blocks without leaving loop markers in the filled output

**Reason**: Template-family content extracted to content/templates/openagreements-board-consent-safe/README.md.
**Migration**: See content/templates/openagreements-board-consent-safe/README.md.
### Requirement: SAFE Stockholder Consent Canonical Markdown Authoring
The SAFE stockholder consent SHALL be authored canonically in
`content/templates/openagreements-stockholder-consent-safe/template.md`, with
the generated JSON spec and rendered DOCX derived from that source.

#### Scenario: [OA-TMP-060] SAFE stockholder consent canonical source preserves source fidelity
- **WHEN** the SAFE stockholder consent canonical source is compiled, rendered,
  and filled
- **THEN** the generated outputs preserve the stockholder consent legal text,
  Section 228 timing behavior, placeholders, and professional formatting
- **AND** the signature section expands `stockholders` into the exact number of
  signer blocks without leaving loop markers in the filled output

**Reason**: Template-family content extracted to content/templates/openagreements-stockholder-consent-safe/README.md.
**Migration**: See content/templates/openagreements-stockholder-consent-safe/README.md.
### Requirement: SAFE Consent Recitals Authoring
The SAFE board and SAFE stockholder canonical consents SHALL support a separate
`recitals` body section so WHEREAS clauses can be authored separately from the
operative resolutions while preserving rendered legal content.

#### Scenario: [OA-TMP-056] SAFE consents separate WHEREAS and RESOLVED content
- **WHEN** a SAFE board or stockholder consent canonical source declares
  `<!-- oa:section type=recitals -->` before `## Recitals` and
  `<!-- oa:section type=standard_terms -->` before `## Resolutions`
- **THEN** WHEREAS clauses compile into the `recitals` section
- **AND** RESOLVED clauses compile into the operative section
- **AND** the rendered traditional consent output preserves the recital text,
  resolution text, ordering, and signature behavior

**Reason**: Template-family content extracted to content/templates/openagreements-board-consent-safe/README.md and content/templates/openagreements-stockholder-consent-safe/README.md.
**Migration**: See content/templates/openagreements-board-consent-safe/README.md and content/templates/openagreements-stockholder-consent-safe/README.md.
