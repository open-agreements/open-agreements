# Change: Add variable signer blocks

## Why
Fixed-count signer fields (`party_1_name`, `board_member_2_name`, etc.) do not scale to templates that require a variable number of signers. They also leave dangling signature blocks when extra signer slots are omitted, which forces manual cleanup and blocks held consent-template work.

## What Changes
- Document and test conditional signature-block pruning using existing `docx-templates` `{IF}` / `{END-IF}` blocks plus explicit empty-string defaults for optional signer-slot anchor fields
- Add first-class array item schemas to template metadata so templates can declare repeatable object arrays such as `signers` or `board_members`
- Surface nested array item schemas through template listing and MCP `get_template`
- Add end-to-end DOCX fixture tests for fixed-slot pruning and `{FOR}`-based repeating signer blocks
- Update template-authoring docs with the preferred `{FOR}` pattern and the legacy-compatible pruning pattern

## Impact
- Affected specs: `open-agreements`
- Affected code: `src/core/metadata.ts`, `src/core/template-listing.ts`, `packages/contract-templates-mcp/src/core/tools.ts`, metadata/listing tests, fill-pipeline rendering tests, `docs/adding-templates.md`
- Non-goals: migrating held Cooley consent templates in this change
