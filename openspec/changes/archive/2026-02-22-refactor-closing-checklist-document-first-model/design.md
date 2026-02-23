## Context

Closing checklists are document-control artifacts, not generic task boards. In real legal workflows:

- documents are the primary objects
- stages are a human-readable grouping mechanism
- signatures are tracked per expected signer identity
- issues/actions are tied to documents
- checklist rows often cite agreement sections that require each deliverable

The current model flattens these concerns into sibling arrays and cannot represent nested, stage-first lawyer output cleanly.

## Goals / Non-Goals

- Goals:
  - Make canonical data document-first with stable string IDs
  - Render lawyer-native stage-first nested checklist output
  - Keep one document mapped to one checklist row entry
  - Allow checklist entries without documents for pre-document tasks
  - Track named signatory receipt status and signature artifact locations per entry
  - Tie issues and actions to documents
  - Separate working group roster into its own document

- Non-Goals:
  - Model every legal edge case (voting thresholds, entity-control trees)
  - Build a full project/task management system
  - Guarantee compatibility with earlier draft checklist payload variants

## Decisions

### Decision: Use canonical documents plus stage checklist entries

The model separates identity from presentation:

- `documents[]` are canonical legal artifacts (stable ID, title, optional canonical link, optional labels)
- `checklist_entries[]` are stage-rendered rows (status, sort order, tree nesting, signatures, citations)

Each checklist entry references at most one document (`document_id` optional), and each document maps to at most one checklist entry. This keeps the model simple while still allowing pre-document entries.

### Decision: Keep nesting simple with a single parent pointer on entries

Instead of a general relationship graph, each checklist entry has optional `parent_entry_id`.

This supports lawyer-expected indentation (agreement -> schedules -> attachments) while avoiding relationship overengineering.

### Decision: Track signature status by named signatory, not aggregate counts

Each checklist entry may include explicit signatories. Every signatory has identity and status.
Each signatory may include signature artifact locations (`uri` or `path`) plus optional `received_at`.

This ensures output answers legal-operational questions directly: who is missing, not just how many are missing.

### Decision: Keep issue lifecycle simple for the initial contract

Issue status uses two states only: `OPEN` and `CLOSED`.

### Decision: Use entry status enum plus stable `sort_key`

Each checklist entry uses one lifecycle `status` enum and one insertion-oriented `sort_key`.

Proposed status enum:
- `NOT_STARTED`
- `DRAFT`
- `CIRCULATED`
- `FORM_FINAL`
- `PARTIALLY_SIGNED`
- `FULLY_EXECUTED`
- `DELIVERED`
- `FILED_OR_RECORDED`

`sort_key` is non-positional and stable so entries can be inserted without renumbering existing display numbers. Rendered numbering (`1`, `1.1`, etc.) is computed from tree order.

### Decision: Working group roster is a separate document type

The working group list is generated as its own document and referenced from the closing checklist, typically in pre-signing.

This aligns with legal workflow and prevents the checklist from becoming a mixed roster-and-deliverables artifact.

## Canonical Data Shape

```json
{
  "deal_name": "Project Atlas - Series A Closing",
  "updated_at": "2026-02-21",
  "documents": [
    {
      "document_id": "escrow-agreement-executed",
      "title": "Escrow Agreement (Executed)",
      "primary_link": "https://dataroom.example.com/docs/escrow-agreement-executed",
      "labels": ["phase:closing"]
    }
  ],
  "checklist_entries": [
    {
      "entry_id": "entry-order-good-standing",
      "stage": "PRE_SIGNING",
      "sort_key": "030",
      "title": "Order Delaware good standing certificate",
      "status": "NOT_STARTED",
      "citations": [{ "ref": "SPA §6.2(d)" }]
    },
    {
      "entry_id": "entry-escrow-closing",
      "document_id": "escrow-agreement-executed",
      "stage": "CLOSING",
      "sort_key": "120",
      "title": "Escrow Agreement (Executed)",
      "status": "FULLY_EXECUTED",
      "citations": [{ "ref": "SPA §6.2(c)" }],
      "signatories": [
        {
          "party": "Buyer",
          "name": "A. Lee",
          "status": "RECEIVED",
          "signature_artifacts": [
            { "uri": "https://drive.google.com/file/d/buyer-sig-page", "received_at": "2026-02-20T14:02:00Z" }
          ]
        },
        {
          "party": "Seller",
          "name": "M. Kent",
          "status": "RECEIVED",
          "signature_artifacts": [
            { "path": "/dealroom/signature-pages/seller-escrow-signature-page.pdf" }
          ]
        }
      ]
    }
  ],
  "action_items": [
    {
      "action_id": "act_101",
      "description": "Finalize funds flow memo",
      "status": "IN_PROGRESS",
      "related_document_ids": ["escrow-agreement-executed"]
    }
  ],
  "issues": [
    {
      "issue_id": "iss_22",
      "title": "Escrow release mechanics",
      "status": "OPEN",
      "related_document_ids": ["escrow-agreement-executed"]
    }
  ]
}
```

## Rendering Model

1. Group checklist entries by stage in fixed order:
   - `PRE_SIGNING`
   - `SIGNING`
   - `CLOSING`
   - `POST_CLOSING`
2. Within stage, sort by `sort_key`.
3. Build tree per stage using `parent_entry_id`.
4. Compute display numbering (`1`, `1.1`, `1.1.1`) at render time from tree order.
5. Render each entry row with:
   - computed display number
   - title
   - optional citations
   - optional responsible party
   - status
   - signatories (named with per-signer status indicator and optional signature artifact locations)
6. Render document-linked actions/issues beneath related entry rows when linked.
7. Render unlinked actions/issues in explicit trailing sections.

## Risks / Trade-offs

- Risk: More complex schema than the earlier flat array shape.
  - Mitigation: Keep relations constrained (`document_id`, `parent_entry_id`, `related_document_ids`) and avoid generic relationship tables.
- Risk: Existing checklist fixtures and examples break.
  - Mitigation: Replace fixtures atomically; document the document-first contract and keep examples aligned.
- Risk: Form-vs-executed continuity depends on users creating two documents when needed.
  - Mitigation: Provide authoring guidance with explicit naming and citation conventions for paired form/executed records.

## Implementation Plan

1. Introduce document-first schema and template rendering logic.
2. Use document-first validation in checklist CLI and shared checklist creation paths.
3. Add standalone working-group-list document template and sample payloads.
4. Remove flat-shape draft schema/tests/fixtures and update docs in one release cut.
5. Verify end-to-end with checklist creation/render flows and DOCX output tests.

Rollback: restore previous schema and template files from git if rollout blocks checklist generation.

## Open Questions

- Should custom stage labels be allowed in addition to the default four stages?
- Should signature artifact objects allow both `uri` and `path` on the same object, or require exactly one?
