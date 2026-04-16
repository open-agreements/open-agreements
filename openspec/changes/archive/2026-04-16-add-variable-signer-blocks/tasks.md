## 1. Spec and regression coverage
- [x] 1.1 Add spec deltas for conditional signer-block pruning and array item schema discovery
- [x] 1.2 Add a failing regression test that reproduces dangling fixed-slot signature blocks with omitted signer values

## 2. Metadata and discovery
- [x] 2.1 Extend template metadata to allow nested item schemas on array fields
- [x] 2.2 Surface nested array item schemas through template listing and MCP `get_template`
- [x] 2.3 Add metadata/listing/MCP tests for nested array item schemas

## 3. Rendering and docs
- [x] 3.1 Add fill-path tests for conditional signature-block pruning with explicit empty-string defaults
- [x] 3.2 Add end-to-end fixture-template tests for `{FOR}`-based signer arrays with 1, 3, and 7 signers
- [x] 3.3 Update `docs/adding-templates.md` with the preferred loop pattern and the legacy-compatible pruning pattern

## 4. Verification
- [x] 4.1 Run `npm run preflight:ci` before the change and record the result
- [x] 4.2 Run targeted tests during implementation
- [x] 4.3 Run `openspec validate add-variable-signer-blocks --strict`
- [x] 4.4 Run `npm run preflight:ci` after the change
