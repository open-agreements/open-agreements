## Context

`openspec/specs/open-agreements/spec.md` accreted to 1,869 lines / 106 requirements covering distinct concerns: simple-fill engine, recipe pipeline (cleaner/patcher/computed/verifier), CLI surface, MCP tool contracts, checklist data model + lifecycle, signing provider integration, npm/runtime distribution, canonical Markdown authoring, validation rules, license compliance, CI quality gates, and content-specific rules for SAFE / NVCA / Employment / Mutual NDA / Common Paper templates. Reviewers cannot tell from a diff which concern a change touches; new concerns (e.g. DocuSign) have no natural home. Data-model "requirements" prose-duplicate Zod schemas.

## Goals / Non-Goals

**Goals**
- Replace the 1-monolith / 106-requirement spec with 12 focused capabilities.
- Delete data-model shape duplication; Zod schemas + JSDoc become the shape source of truth.
- Move template-family content out of OpenSpec into per-template READMEs.
- Add audience framing to `project.md` + README.
- Regenerate `id-mapping.json` against the new capability paths.
- Rebase 4 near-done in-flight changes onto new capability paths.

**Non-Goals (deferred)**
- Markdoc-style internals refactor of canonical-markdown (separate post-merge issue).
- Closing the 6 stalled in-flight changes (separate cleanup pass).
- Closing the 6 stale GitHub issues (#330, #339, #354, #355, #366, #373) — separate batch, not connected to this PR.

## Decisions

- **Hybrid splitting axis** (surface specs + concern specs). Surface specs for entry points (engine, CLI, MCPs, providers, distribution); concern specs for cross-cutting (authoring, validation, ip-license, quality-gates). Pure surface-only would scatter ip-license rules across every surface and guarantee drift; pure concern-only would lose the "one spec per external consumer" framing.
- **Recipes split**: cleaner/patcher/verifier/source-drift live in `recipes` capability; computed/derived field rules move to `engine` because they will generalize beyond NVCA. Per user direction.
- **`closing-checklist` as own top-level capability** including its MCP tools (single capability, not `checklist-core` + `checklist-mcp`).
- **`signing` + `provider-docusign` split**. Generic interface in `signing`; DocuSign-specific PKCE/anchor/webhook in `provider-docusign`. Pattern for future `provider-adobe-sign`.
- **Single big-bang PR** per user direction. Avoids weeks of half-restructured intermediate state. Reviewer cost mitigated by clear mapping table in this design doc.
- **Canonical Markdown formalized as-is** in `authoring` spec. Markdoc-style internals refactor is a separate post-merge issue.
- **Zod-as-doc for data-model shape**: any requirement that just enumerates field types / required-vs-optional / enum members is deleted with `**Reason**: Shape duplicates Zod schema in src/core/metadata.ts`. Cross-field semantic invariants (e.g. derived-boolean collision rules; mutual-exclusion across multiselect derived keys) are kept with explicit `**See**: Zod schema reference` pointers.
- **Template-family content → per-template README**: any requirement whose title or scope names a specific template family (SAFE Board Consent, SAFE Stockholder Consent, SAFE Consent Recitals, NVCA Option Vesting Policy, NVCA SPA Interaction Audit, Employment Memo Generation, Employment Template Formatting Integrity, Canonical Employment Templates Use the Signer Model, Mutual NDA Selection Semantics, Signature Block Fields-Common-Paper-specifics) is deleted from spec and equivalent rules captured in `content/templates/<id>/README.md`.

## Risks / Trade-offs

- **Risk**: 7 in-flight changes target `specs/open-agreements/`; rebasing them onto new capability paths can drop work in long task lists.
  - **Mitigation**: rebase the 4 near-done changes as part of this PR (task 7). The 6 stalled changes (≤9% complete) defer to a separate cleanup pass.
- **Risk**: per-requirement mapping is judgment-heavy at the margins (e.g. "Signature Block Fields" — engine or authoring? "API Endpoint Protocol Compliance" — distribution or mcp-contract-templates?).
  - **Mitigation**: the mapping table in §Mapping below documents every call; reviewers see exactly which capability got which requirement and why.
- **Risk**: data-model deletions could lose load-bearing semantics if mis-identified as shape-only.
  - **Mitigation**: JSDoc enrichment audit pass (task 4.4) is mandatory before deleting any requirement; the JSDoc must carry forward whatever the deleted prose was load-bearing for.
- **Risk**: legacy `OA-NNN` scenario IDs cite paths that no longer point to the truth source.
  - **Mitigation**: id-mapping regeneration (task 6.3) updates the legacy→new ID mapping in-place.
- **Trade-off**: single big-bang PR has high reviewer cost but lands atomically per user preference.

## Migration Plan

This PR is implemented by Codex CLI via `/codex-implement` in an isolated worktree. Steps:

1. Codex reads the scaffold (proposal.md, tasks.md, this design.md) plus the source monolith spec.
2. Codex executes tasks 1–8 in order, committing per task group.
3. Mandatory peer-review gate (Gemini + Codex) runs before the PR opens.
4. After PR opens: human review, address comments, merge.
5. After merge: file the Markdoc-style internals follow-up issue; close 6 stale issues batch; cleanup pass on stalled in-flight changes.

## Mapping (requirement → capability)

| Requirement | Target | Notes |
|---|---|---|
| Template Engine Sandboxing | engine | Moved verbatim. |
| Template Validation Severity | validation | Moved verbatim. |
| DOCX Text Extraction | engine | Moved verbatim. |
| Metadata Schema Constraints | validation | Semantic invariants kept; See pointer added to Zod schemas. |
| Fill Value Validation | engine | Moved verbatim. |
| CI License Compliance | ip-license | Moved verbatim. |
| Recipe Pipeline | recipes | Moved verbatim. |
| Recipe CLI Subcommands | cli | Moved verbatim. |
| DOCX Cleaner | recipes | Moved verbatim. |
| Cross-Run Patcher | recipes | Moved verbatim. |
| Post-Fill Verifier | recipes | Moved verbatim. |
| Scan Command | cli | Moved verbatim. |
| Recipe Metadata Schema | DELETED | Shape-only; Zod schema is source of truth after JSDoc audit. |
| Recipe Directory Validation | validation | Moved verbatim. |
| DOCX Template Rendering | engine | Moved verbatim. |
| Mutual NDA Selection Semantics | EXTRACTED | Template-family content extracted to content/templates/common-paper-mutual-nda/README.md. |
| Signature Block Fields | engine | Moved verbatim. |
| Template Metadata Schema | DELETED | Shape-only; Zod schema is source of truth after JSDoc audit. |
| License Compliance Validation | ip-license | Moved verbatim. |
| External Template Support | engine | Moved verbatim. |
| CLI Interface | cli | Moved verbatim. |
| Claude Code Skill | cli | Moved verbatim. |
| Output Validation | engine | Moved verbatim. |
| Agent-Agnostic Skill Architecture | cli | Moved verbatim. |
| Agent Skills Specification Compliance | cli | Moved verbatim. |
| Machine-Readable Template Discovery | cli | Moved verbatim. |
| npm Package Integrity | distribution | Moved verbatim. |
| Gated Skills Directory Publish Workflow | distribution | Moved verbatim. |
| Skill Version-Sourced Directory Publishing | distribution | Moved verbatim. |
| Explicit Directory Publish Scope | distribution | Moved verbatim. |
| Token-Based Registry Authentication | distribution | Moved verbatim. |
| Local Contract Templates MCP Server | distribution | Moved verbatim. |
| Gemini Extension Manifest Contract | distribution | Moved verbatim. |
| Isolated Package Runtime Smoke Gate | distribution | Moved verbatim. |
| Recipe Computed Interaction Profiles | engine | Moved verbatim. |
| Computed Artifact Export | engine | Moved verbatim. |
| Computed Profile Validation | engine | Moved verbatim. |
| NVCA SPA Interaction Audit Coverage | EXTRACTED | Template-family content extracted to content/recipes/nvca-stock-purchase-agreement/README.md. |
| Optional Content Root Overrides | cli | Moved verbatim. |
| Content Root Precedence and Dedupe | cli | Moved verbatim. |
| Unified Root-Aware Command Resolution | cli | Moved verbatim. |
| Public Trust Signal Surfaces | quality-gates | Moved verbatim. |
| Binary Trust Mapping Status | quality-gates | Moved verbatim. |
| Runtime Trust Data Freshness Gate | quality-gates | Moved verbatim. |
| Generated README Consistency | quality-gates | Moved verbatim. |
| README Drift Gate | quality-gates | Moved verbatim. |
| CI-Published Coverage and Test Results | quality-gates | Moved verbatim. |
| Repository-Defined Coverage Gate Policy | quality-gates | Moved verbatim. |
| Spec-Backed Allure Coverage Expansion | quality-gates | Moved verbatim. |
| Canonical Evidence Story | quality-gates | Moved verbatim. |
| Document-First Closing Checklist Data Model | closing-checklist | Moved verbatim. |
| Stage-First Nested Lawyer Rendering | closing-checklist | Moved verbatim. |
| Stable Sort Key and Computed Display Numbering | closing-checklist | Moved verbatim. |
| Optional Document Labels | closing-checklist | Moved verbatim. |
| Named Signatory Tracking with Signature Artifacts | closing-checklist | Moved verbatim. |
| Minimal Citation Support | closing-checklist | Moved verbatim. |
| Document-Linked and Document-Less Checklist Entries | closing-checklist | Moved verbatim. |
| Simplified Issue Lifecycle | closing-checklist | Moved verbatim. |
| Standalone Working Group Document | closing-checklist | Moved verbatim. |
| Legacy Checklist Payload Rejection | closing-checklist | Moved verbatim. |
| Atomic Checklist JSON Patch Transactions | closing-checklist | Moved verbatim. |
| Optimistic Concurrency for Patch Apply | closing-checklist | Moved verbatim. |
| Dry-Run Patch Validation | closing-checklist | Moved verbatim. |
| Apply Requires Prior Successful Validation | closing-checklist | Moved verbatim. |
| Strict Target Resolution Without Guessing | closing-checklist | Moved verbatim. |
| Patch-Level Idempotency | closing-checklist | Moved verbatim. |
| Flexible Evidence Citations in Patch Updates | closing-checklist | Moved verbatim. |
| Optional Proposed Patch Mode | closing-checklist | Moved verbatim. |
| Currency Field Detection and Sanitization | engine | Moved verbatim. |
| Post-Fill Verification Checks | engine | Moved verbatim. |
| Fill Data Preparation | engine | Moved verbatim. |
| Multiselect Derived Boolean Fill Behavior | engine | Moved verbatim. |
| Fill Pipeline DOCX Rendering | engine | Moved verbatim. |
| Fill Pipeline Behavioral Consistency | engine | Moved verbatim. |
| Loop-Based Array Rendering | engine | Moved verbatim. |
| Employment Signer Arrangement Rendering | EXTRACTED | Template-family content extracted to content/templates/openagreements-employment-offer-letter/README.md. |
| API Endpoint Protocol Compliance | distribution | Moved verbatim. |
| OpenSpec Coverage Validation Script | quality-gates | Moved verbatim. |
| Template Validation for All Templates | validation | Moved verbatim. |
| Canonical Markdown Employment Template Authoring | authoring | Moved verbatim. |
| Canonical Employment Templates Use the Signer Model | authoring | Moved verbatim. |
| CLI Fill for All Template Types | cli | Moved verbatim. |
| npm Package Distribution Integrity | distribution | Moved verbatim. |
| List Command Envelope Structure | cli | Moved verbatim. |
| Recipe Validation for Bundled Recipes | validation | Moved verbatim. |
| Recipe Negative Validation | validation | Moved verbatim. |
| MCP Protocol Envelope Contract | mcp-contract-templates | Moved verbatim. |
| MCP Template Discovery Preserves Field Metadata | mcp-contract-templates | Moved verbatim. |
| Employment Memo Generation | EXTRACTED | Template-family content extracted to content/templates/openagreements-employment-offer-letter/README.md. |
| Source Drift Detection | recipes | Moved verbatim. |
| NVCA Option Vesting Policy Computation | EXTRACTED | Template-family content extracted to content/recipes/nvca-voting-agreement/README.md. |
| JSON Template Renderer | engine | Moved verbatim. |
| NVCA Template Assumption Validation | EXTRACTED | Template-family content extracted to content/recipes/nvca-voting-agreement/README.md. |
| Metadata Completeness Assessment | validation | Moved verbatim. |
| Employment Template Formatting Integrity | EXTRACTED | Template-family content extracted to content/templates/openagreements-employment-offer-letter/README.md. |
| Formatting Diff Boundary Conditions | EXTRACTED | Template-family content extracted to content/templates/openagreements-employment-offer-letter/README.md. |
| Closing Checklist Stage-First Rendering | closing-checklist | Moved verbatim. |
| NVCA SPA Preview Rendering | EXTRACTED | Template-family content extracted to content/recipes/nvca-stock-purchase-agreement/README.md. |
| Working Group List Rendering | closing-checklist | Moved verbatim. |
| Recipe Patcher Operations | recipes | Moved verbatim. |
| Recipe Patcher Extensions | recipes | Moved verbatim. |
| Replacement Key Parsing | recipes | Moved verbatim. |
| Recipe Verifier Edge Cases | validation | Moved verbatim. |
| OOXML Part Enumeration | recipes | Moved verbatim. |
| Bracket Artifact Normalization | recipes | Moved verbatim. |
| Declarative Paragraph Pruning | recipes | Moved verbatim. |
| Metadata Field Schema Validation | validation | Moved verbatim. |
| Template Metadata Required Fields | validation | Moved verbatim. |
| Recipe Metadata Defaults | validation | Moved verbatim. |
| Clean Configuration Schema | validation | Moved verbatim. |
| Guidance Output Schema | validation | Moved verbatim. |
| Checklist Schema Structural Rules | validation | Moved verbatim. |
| Patch Schema Validation Rules | validation | Moved verbatim. |
| Patch Validator Artifact Expiry | validation | Moved verbatim. |
| Template Credits and Provenance | validation | Moved verbatim. |
| Canonical Markdown Section Directive Anchors | authoring | Moved verbatim. |
| Canonical Markdown Repeat-Backed Signer Authoring | authoring | Moved verbatim. |
| SAFE Board Consent Canonical Markdown Authoring | EXTRACTED | Template-family content extracted to content/templates/openagreements-board-consent-safe/README.md. |
| SAFE Stockholder Consent Canonical Markdown Authoring | EXTRACTED | Template-family content extracted to content/templates/openagreements-stockholder-consent-safe/README.md. |
| SAFE Consent Recitals Authoring | EXTRACTED | Template-family content extracted to content/templates/openagreements-board-consent-safe/README.md and content/templates/openagreements-stockholder-consent-safe/README.md. |

## Requirement Accounting

Actual source count: 120 = 106 moved + 2 deleted-as-shape + 12 extracted-to-README.

Deleted-as-shape: Template Metadata Schema, Recipe Metadata Schema.

Extracted-to-README: Mutual NDA Selection Semantics -> content/templates/common-paper-mutual-nda/README.md; NVCA SPA Interaction Audit Coverage -> content/recipes/nvca-stock-purchase-agreement/README.md; Employment Signer Arrangement Rendering -> content/templates/openagreements-employment-offer-letter/README.md; Employment Memo Generation -> content/templates/openagreements-employment-offer-letter/README.md; NVCA Option Vesting Policy Computation -> content/recipes/nvca-voting-agreement/README.md; NVCA Template Assumption Validation -> content/recipes/nvca-voting-agreement/README.md; Employment Template Formatting Integrity -> content/templates/openagreements-employment-offer-letter/README.md; Formatting Diff Boundary Conditions -> content/templates/openagreements-employment-offer-letter/README.md; NVCA SPA Preview Rendering -> content/recipes/nvca-stock-purchase-agreement/README.md; SAFE Board Consent Canonical Markdown Authoring -> content/templates/openagreements-board-consent-safe/README.md; SAFE Stockholder Consent Canonical Markdown Authoring -> content/templates/openagreements-stockholder-consent-safe/README.md; SAFE Consent Recitals Authoring -> content/templates/openagreements-board-consent-safe/README.md and content/templates/openagreements-stockholder-consent-safe/README.md.

## Open Questions

- Does `openspec validate --strict` correctly handle ADDED Requirements where the capability spec.md does not yet exist? (Expected: yes — change creates the capability. Verify in task 8.1.)
- How is the `contracts-workspace` → `mcp-contracts-workspace` capability rename represented in OpenSpec's delta format? AGENTS.md covers requirement renames but not capability renames. Codex should consult the OpenSpec CLI docs or fall back to: (a) ADDED block in new `mcp-contracts-workspace` capability + REMOVED block in `contracts-workspace`, or (b) directory rename + spec.md untouched. Pick whichever satisfies `openspec validate --strict`.
- For id-mapping regeneration: is there an existing script? Codex should check `scripts/` for a generator; if absent, the file may be hand-curated and a regeneration script should be added.
