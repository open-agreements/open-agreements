# Change: Refactor Closing Checklist to Document-First Model

## Why

The current closing checklist shape is flat (`working_group`, `documents`, `action_items`, `open_issues`) and renders as separate peer sections. That structure is easy for machines, but it does not match how transactional lawyers actually use closing checklists in live deals.

In practice, lawyers treat documents as the source of truth. Stages (pre-signing, signing, closing, post-closing) are a presentation layer. Issues, signatures, and action items are tracked in relation to specific documents, not as independent top-level artifacts of equal weight.

Two specific workflow gaps drive this proposal:

1. The same legal instrument often appears twice in the checklist lifecycle (for example, an escrow agreement as a form-final exhibit at signing and as an executed deliverable at closing).
2. Signature tracking must show who signed and who has not signed yet; aggregate counts are insufficient for legal operations.

The current model cannot represent those patterns cleanly. It also keeps the working group table embedded in the checklist, while users want the working group list as a standalone document that is referenced by the checklist.

## What Changes

- Replace the closing checklist input contract with a **document-first schema**:
  - Canonical document records with stable string `document_id` identifiers
  - Stage-scoped checklist entries, with one document mapped to one checklist entry
  - Optional checklist entries that have no document yet (pre-document tasks)
  - Nested rendering via a single parent pointer on entries
- Keep the lawyer-facing output in a **stage-first nested format** (K&L Gates / Practical Law style) while preserving a flatter canonical model underneath.
- Remove multi-appearance modeling in this initial contract; form and executed records are represented as separate documents/entries when needed.
- Add per-signatory tracking on checklist entries with explicit signer identity and per-signer status.
- Add per-signatory signature artifact location tracking (`uri`/`path`) with optional `received_at`.
- Add optional agreement citation metadata as minimal list entries (for example `[{ ref: "SPA §6.2(b)" }]`) and responsibility metadata at entry/document level.
- Add stable insertion ordering with `sort_key`; human row numbering is computed at render time.
- Add optional freeform `labels[]` on documents.
- Model action items and issues as document-linked objects (`related_document_ids`), with a fallback section for unlinked entries.
- Move working group roster data into a separate **Working Group List** document flow and reference it from the checklist as a normal document row.

## Contract Positioning

- This proposal defines the initial stable document-first checklist contract for this project.
- The earlier flat checklist shape is treated as a draft internal shape, not a long-lived public contract.
- Embedded `working_group` table content is removed from the closing checklist render path; working group is now a separate document.

No compatibility shim is required for this change.

## Scope Boundaries

### In scope
- New document-first checklist schema and validation
- Stage-first nested rendering from document-first canonical data
- One-document-to-one-entry mapping with optional document-less entries
- Named signatory tracking per entry
- Signature artifact location tracking per signatory
- Optional minimal agreement citations
- Stable sorting via `sort_key` and computed row numbering
- Optional document labels
- Document-linked issues and action items
- Issue status simplified to `OPEN` / `CLOSED`
- Standalone working-group-list document support and checklist linkage

### Out of scope
- Signature voting thresholds or cap-table vote math
- Cross-deal document identity and global document registry
- Workflow automation (notifications, reminders, approval routing)
- Automatic migration tooling between draft checklist payload variants

## Impact

- Affected specs: `open-agreements`
- Affected code (expected):
  - `src/core/checklist/schemas.ts` (document-first checklist schema and validation)
  - `src/core/checklist/index.ts` (rewrite Markdown and template render preparation)
  - `src/commands/checklist.ts` (document-first input validation and summaries)
  - `api/_shared.ts` (document-first validation for checklist creation path)
  - `content/templates/closing-checklist/template.docx` and `metadata.yaml` (new nested render model)
  - `content/templates/working-group-list/` (new standalone template)
  - checklist tests and integration fixtures
- Compatibility: treated as initial contract; no migration path is required
