## 1. Schema and Validation
- [x] 1.1 Replace `ClosingChecklistSchema` with document-first schema (`documents`, `checklist_entries`, `action_items`, `issues`)
- [x] 1.2 Add/adjust Zod enums for stage, entry status, signatory status, and issue status (`OPEN`, `CLOSED`)
- [x] 1.3 Add schema rules: `checklist_entry.document_id` references a known document when present
- [x] 1.4 Add schema rule: each document maps to at most one checklist entry
- [x] 1.5 Add schema rule for optional tree nesting via `parent_entry_id`
- [x] 1.6 Add schema fields: `sort_key`, optional document `labels[]`, minimal `citations[]`, and signatory `signature_artifacts[]`

## 2. Rendering Engine and Template
- [x] 2.1 Refactor checklist render preparation to derive stage-grouped trees from checklist entries
- [x] 2.2 Update Markdown renderer to stage-first nested document output
- [x] 2.3 Update `content/templates/closing-checklist/template.docx` to render nested rows correctly (one row per checklist entry)
- [x] 2.4 Add rendering for explicit named signatories, per-signer receipt status, and signature artifact links/paths
- [x] 2.5 Add rendering for minimal `citations[]` and computed display numbering from `sort_key` + tree order

## 3. Working Group Separation
- [x] 3.1 Add standalone `working-group-list` template + metadata
- [x] 3.2 Update checklist examples so working group appears as a document row/link instead of embedded table
- [x] 3.3 Ensure checklist generation works when no working-group section is embedded

## 4. CLI and MCP Contract Updates
- [x] 4.1 Update `open-agreements checklist create` and `checklist render` to consume document-first input
- [N/A] ~~4.2 Update `create_closing_checklist` MCP input schema and docs for document-first payload~~ (Not applicable: `create_closing_checklist` is not currently a public MCP tool in this repo.)
- [x] 4.3 Ensure checklist creation responses preserve structured validation errors for invalid document-first payloads

## 5. Tests and Fixtures
- [x] 5.1 Rewrite checklist schema unit tests for document-first model and referential validation
- [x] 5.2 Add rendering tests for stage grouping, nesting, stable sort order, and computed numbering
- [x] 5.3 Add tests for optional document-less checklist entries (pre-document tasks)
- [x] 5.4 Add tests for document-linked actions/issues and unlinked fallback sections

## 6. Documentation
- [N/A] ~~6.1 Update README and sample JSON payloads for checklist document-first schema~~ (Not applicable in this change: no public checklist JSON contract docs are currently published in README.)
- [x] 6.2 Document the document-first data model and stage-first rendering model
- [x] 6.3 Document contract positioning as an initial document-first checklist shape
