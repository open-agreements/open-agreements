# Tasks: Safe-Docx Layout Format Controls

## 1. Docx Primitives: Layout Mutation Core
- [x] 1.1 Add OOXML constants for layout elements/attributes needed for spacing and table geometry (`w:spacing`, `w:trHeight`, `w:tcMar`, margin sides, rules).
- [x] 1.2 Implement deterministic paragraph spacing mutation helper(s) in `packages/docx-primitives-ts`.
- [x] 1.3 Implement deterministic table row height mutation helper(s) in `packages/docx-primitives-ts`.
- [x] 1.4 Implement deterministic cell padding mutation helper(s) in `packages/docx-primitives-ts`.
- [x] 1.5 Ensure helpers create missing `pPr`/`trPr`/`tcPr` containers safely and preserve existing unrelated formatting nodes.

## 2. Safe-Docx MCP Surface
- [x] 2.1 Add `format_layout` tool schema and server registration in `packages/safe-docx-ts/src/server.ts`.
- [x] 2.2 Implement `format_layout` tool with file-first/session-first resolution parity.
- [x] 2.3 Add deterministic parameter validation with structured errors (invalid units/ranges/selectors).
- [x] 2.4 Return mutation summary metadata (affected paragraphs/rows/cells, resolved session metadata).

## 3. Guardrails and Invariants
- [x] 3.1 Enforce “no spacer paragraphs” invariant for layout operations (paragraph count unchanged unless explicitly requested by other tools).
- [x] 3.2 Ensure bookmark stability and existing paragraph IDs remain valid after layout mutations.
- [x] 3.3 Ensure operations are idempotent for identical requests.

## 4. Tests
- [x] 4.1 Add `docx-primitives-ts` unit tests for paragraph spacing writes and container creation behavior.
- [x] 4.2 Add `docx-primitives-ts` unit tests for row height and cell padding writes.
- [x] 4.3 Add `safe-docx-ts` integration tests for `format_layout` end-to-end mutation + save/download flow.
- [x] 4.4 Add regression test asserting no spacer paragraphs are introduced by layout formatting.

## 5. Documentation
- [x] 5.1 Update `packages/safe-docx-ts/README.md` with `format_layout` usage examples and selector patterns.
- [x] 5.2 Document unit semantics (`twips`, `dxa`, `lineRule`) and recommended defaults for legal docs.
- [x] 5.3 Add a short build-time template-authoring recipe showing local layout formatting workflow without Aspose runtime dependency.

## 6. Validation
- [x] 6.1 `openspec validate add-safe-docx-layout-format-controls --strict` passes.
- [x] 6.2 `npm run test:run -w @usejunior/docx-primitives` passes.
- [x] 6.3 `npm run test:run -w @usejunior/safe-docx` passes.
