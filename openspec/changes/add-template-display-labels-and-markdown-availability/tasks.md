## 1. Implementation

- [x] 1.1 Extend template field metadata schema with optional `display_label`.
- [x] 1.2 Project `display_label` through `mapFields()` and all list/discovery surfaces.
- [x] 1.3 Add `has_template_md` to template discovery output and the committed snapshot.
- [x] 1.4 Seed curated `display_label` values into first-party OpenAgreements employment template metadata.
- [x] 1.5 Update downstream-facing helpers (API, MCP, and repo-local catalog helpers) to consume the new metadata without legacy label derivation, while allowing repo-local catalog code to derive richer capability booleans directly from template contents.

## 2. Validation

- [x] 2.1 Add or update focused tests for metadata parsing and list/discovery projection.
- [x] 2.2 Regenerate `data/templates-snapshot.json`.
- [ ] 2.3 Run `node scripts/export-templates-snapshot.mjs --check`.
- [ ] 2.4 Run focused Vitest coverage for metadata, list/discovery, API, and MCP surfaces.
- [x] 2.5 Run `openspec validate add-template-display-labels-and-markdown-availability --strict`.

Note: `2.3` and `2.4` remain open in this worktree because local build/test artifacts are unavailable here (`node_modules/` and `dist/` are absent, and `npm run build` fails with `tsc: command not found`).
