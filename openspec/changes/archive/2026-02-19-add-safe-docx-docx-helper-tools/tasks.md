# Tasks: Add Docx Helper Tooling to Safe-Docx

## 1. Tool Surface and Schemas
- [x] 1.1 Add MCP tool schema and dispatch wiring for `add_comment`.
- [x] 1.2 Add `normalize_first` option to `smart_edit` input schema.
- [x] 1.3 Ensure `add_comment` supports session resolution parity (`session_id` or `file_path`).
- [x] 1.4 Add structured success/error response payloads with comment IDs, mode, and session metadata.
- [N/A] ~~1.5 Add standalone MCP tools for `replace_text`, `merge_runs`, `simplify_redlines`, `validate_document`, `convert_to_pdf`.~~
  - `replace_text` absorbed into `smart_edit` via `normalize_first`. Others remain internal primitives. `convert_to_pdf` dropped (LibreOffice too heavy).

## 2. Comment and Reply Support
- [x] 2.1 Add docx-primitives helpers to insert comments and threaded replies at OOXML level (`comments.ts`).
- [x] 2.2 Add bootstrap logic for missing comment parts (`comments.xml`, `commentsExtended.xml`, `people.xml`) plus required rel/content-type entries.
- [x] 2.3 Add deterministic comment-anchor markers (`commentRangeStart`/`commentRangeEnd`) for target ranges and verify round-trip.

## 3. Replacement and Run Normalization
- [x] 3.1 Existing `merge_runs` helper parity confirmed (used internally by normalize-on-open).
- [x] 3.2 Add `normalize_first` option to `smart_edit` that merges format-identical adjacent runs before search.
- [N/A] ~~3.3 Enforce replacement-count guardrails and structured ambiguity errors for standalone `replace_text`.~~
  - `smart_edit` already handles unique-match enforcement.

## 4. Redline Simplification
- [x] 4.1 Existing `simplify_redlines` helper confirmed (used internally by normalize-on-open).
- [x] 4.2 Existing tracked-change author summary behavior confirmed (returned in open_document normalization stats).
- [N/A] ~~4.3 Standalone MCP tool for `simplify_redlines`.~~
  - Remains internal primitive.

## 5. Validation and Auto-Repair
- [x] 5.1 Existing `validate_document` behavior confirmed (exercised through validate-before-download).
- [x] 5.2 Existing redline validation mode confirmed (exercised when download produces tracked output against baseline).
- [x] 5.3 Existing auto-repair behavior confirmed (proofErr removal, run merging on normalize-on-open).
- [N/A] ~~5.4 Standalone MCP tool for `validate_document`.~~
  - Remains internal primitive.

## 6. DOCX to PDF Conversion
- [N/A] ~~6.1 Add `convert_to_pdf` helper.~~
- [N/A] ~~6.2 Add compatibility behavior for restricted runtimes.~~
- [N/A] ~~6.3 Return structured dependency errors.~~
  - Entire section dropped — LibreOffice dependency too heavy for local MCP package.

## 7. Tests and Documentation
- [x] 7.1 Add unit tests in `docx-primitives-ts` for comment bootstrapping, insertion, threading, and round-trip (`comments.test.ts`).
- [x] 7.2 Add integration tests in `safe-docx-ts` with OpenSpec traceability for `add_comment` and `smart_edit` `normalize_first` (`add_safe_docx_docx_helper_tools.allure.test.ts`).
- [x] 7.3 Add integration tests covering internal primitives (merge_runs, simplify_redlines, validate_document) exercised through normalize-on-open and validate-before-download paths.

## 8. Validation
- [x] 8.1 OpenSpec spec coverage passes for implemented scenarios.
- [x] 8.2 `npm run test:run -w @usejunior/docx-primitives` passes for new helper coverage.
- [x] 8.3 `npm run test:run -w @usejunior/safe-docx` passes for MCP tool integration coverage.
