## 1. Metadata and Schema Changes
- [ ] 1.1 Add `CC-BY-ND-4.0` to `LicenseEnum` in `src/core/metadata.ts`
- [ ] 1.2 Create `ExternalMetadataSchema` in `src/core/metadata.ts` extending `TemplateMetadataSchema` with `source_sha256: z.string()`
- [ ] 1.3 Add `loadExternalMetadata()` and `validateExternalMetadata()` functions to `src/core/metadata.ts`
- [ ] 1.4 Redefine `allow_derivatives: false` semantics — update `src/core/validation/license.ts` so it no longer hard-blocks rendering; instead, it means "source DOCX must not be modified"
- [ ] 1.5 Update `src/commands/fill.ts` fill guard to use directory context (templates/ vs external/) rather than `allow_derivatives` alone to determine fill strategy

## 2. Path Utilities
- [ ] 2.1 Add `externalDir()` helper to `src/utils/paths.ts` returning the `external/` directory path
- [ ] 2.2 Add `listExternalTemplates()` helper to enumerate external template directories

## 3. External Fill Pipeline
- [ ] 3.1 Create `src/core/external/index.ts` — orchestrator that runs clean → patch → fill → verify using the local external DOCX as input (reuse recipe engine stages from `src/core/recipe/`)
- [ ] 3.2 Create `src/core/external/types.ts` — `ExternalFillOptions` and `ExternalFillResult` types
- [ ] 3.3 Add SHA-256 integrity check before pipeline execution (compare committed DOCX against `source_sha256` in metadata); on mismatch, print expected vs actual hash and abort
- [ ] 3.4 Add CLI redistribution warning: print notice about CC-BY-ND terms when filling external templates ("You may fill for your own use; do not redistribute modified versions")

## 4. CLI Integration
- [ ] 4.1 Update `src/commands/fill.ts` to search `templates/` first, then `external/`; route external matches to the external fill pipeline
- [ ] 4.2 Update `src/commands/list.ts` to show a single unified table with a "Source" column (e.g., "Common Paper", "Y Combinator") including both templates and external templates
- [ ] 4.3 Ensure `list --json` includes external templates with full field definitions for agent discovery
- [ ] 4.4 Update `src/commands/fill.ts` error message for "template not found" to mention that the ID was not found in templates or external agreements

## 5. Validation
- [ ] 5.1 Create `src/core/validation/external.ts` — validate external template directories: metadata schema, DOCX SHA-256 integrity (print expected vs actual on mismatch), replacements.json format, clean.json format (if present), field coverage between metadata and replacement targets
- [ ] 5.2 Update `src/commands/validate.ts` to run external template validation alongside template and recipe validation
- [ ] 5.3 Add regression test: `validate` and `list` must not treat the `external/` container directory itself as a template ID

## 6. Source Documents — Download, Scan, and Verify YC SAFEs (GATE)
- [ ] 6.1 Download all 4 YC Post-Money SAFE DOCX files from verified official URLs
- [ ] 6.2 Run `open-agreements scan` on each downloaded DOCX to identify placeholder patterns (brackets, underscores, content controls)
- [ ] 6.3 **Decision gate**: If placeholders are NOT `[bracket]` format, document the pattern and determine whether the recipe patcher needs extension before proceeding to Task 7
- [ ] 6.4 Compute SHA-256 hashes for each file and record in design.md Evidence section
- [ ] 6.5 Store scan output summaries in design.md Evidence section

## 7. External Template Authoring — YC SAFE Valuation Cap
- [ ] 7.1 Create `external/yc-safe-valuation-cap/` directory with unmodified `template.docx`, `metadata.yaml`, `replacements.json`, `clean.json`, `README.md`
- [ ] 7.2 Map all `[bracket]` placeholders to `{template_tags}` in `replacements.json` (including smart quote and curly quote variants)
- [ ] 7.3 Define all fill fields in `metadata.yaml` with types, descriptions, sections, and required/optional status
- [ ] 7.4 Set `source_sha256` in metadata to the hash computed in Task 6.4
- [ ] 7.5 Run end-to-end fill test with sample values; verify no unrendered tags or brackets remain

## 8. External Template Authoring — YC SAFE Discount
- [ ] 8.1 Create `external/yc-safe-discount/` directory with unmodified `template.docx`, `metadata.yaml`, `replacements.json`, `clean.json`, `README.md`
- [ ] 8.2 Map all bracket placeholders to template tags in `replacements.json` (compare against valuation cap variant for shared fields)
- [ ] 8.3 Define all fill fields in `metadata.yaml`
- [ ] 8.4 Run end-to-end fill test with sample values

## 9. External Template Authoring — YC SAFE MFN
- [ ] 9.1 Create `external/yc-safe-mfn/` directory with unmodified `template.docx`, `metadata.yaml`, `replacements.json`, `clean.json`, `README.md`
- [ ] 9.2 Map all bracket placeholders to template tags in `replacements.json`
- [ ] 9.3 Define all fill fields in `metadata.yaml`
- [ ] 9.4 Run end-to-end fill test with sample values

## 10. External Template Authoring — YC Pro Rata Side Letter
- [ ] 10.1 Create `external/yc-safe-pro-rata-side-letter/` directory with unmodified `template.docx`, `metadata.yaml`, `replacements.json`, `clean.json`, `README.md`
- [ ] 10.2 Map all bracket placeholders to template tags in `replacements.json`
- [ ] 10.3 Define all fill fields in `metadata.yaml`
- [ ] 10.4 Run end-to-end fill test with sample values

## 11. Licensing and Attribution
- [ ] 11.1 Create `external/LICENSE` with CC-BY-ND 4.0 full text and Y Combinator copyright attribution
- [ ] 11.2 Create `external/README.md` explaining what external templates are, licensing constraints, attribution requirements, and the "never re-save, always re-download" update workflow
- [ ] 11.3 Update `docs/licensing.md` to document the external tier, CC-BY-ND handling, redistribution warning for filled output, and "not legal advice" disclaimer

## 12. Skill and Discovery Updates
- [ ] 12.1 Update `skills/open-agreements/SKILL.md` to handle external templates in the interview flow (no behavioral change for user, but skill should show the ND warning and include attribution guidance)
- [ ] 12.2 Ensure `list --json` output includes external templates with field definitions for agent discovery

## 13. Tests
- [ ] 13.1 Add unit tests for `ExternalMetadataSchema` validation (valid metadata, missing hash, wrong license)
- [ ] 13.2 Add unit tests for SHA-256 integrity check (matching hash, mismatched hash with expected/actual output)
- [ ] 13.3 Add unit tests for updated `allow_derivatives` semantics (external templates with `false` are fillable, regular templates with `false` are still blocked if any exist)
- [ ] 13.4 Add integration tests for external template validation against real YC SAFE files
- [ ] 13.5 Add integration test: end-to-end external fill pipeline for `yc-safe-valuation-cap` (fill with sample values, verify output contains values, no leftover brackets/tags)
- [ ] 13.6 Add regression test: `list` and `validate` do not treat `external/` container as a template ID

## 14. Exports and Documentation
- [ ] 14.1 Export external types and functions from `src/index.ts`
- [ ] 14.2 Create `docs/adding-external-templates.md` with authoring guide (download workflow, scan, replacements, hash, testing)
- [ ] 14.3 Document SHA-256 update workflow: "never re-save through Word; re-download from source_url; update hash + version together"
