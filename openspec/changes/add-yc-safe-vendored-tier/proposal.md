# Change: Add YC SAFE external templates

## Why

Y Combinator's Post-Money SAFE is the most widely used early-stage investment instrument. The documents are licensed CC-BY-ND 4.0, which allows redistribution of unmodified copies but not derivatives. The current architecture has templates (CC-BY/CC0, pre-modified DOCX with `{tags}`) and recipes (non-redistributable, downloaded at runtime). Neither path works for documents that are redistributable but non-modifiable. A new `external/` directory lets us ship the original DOCX files for offline/batteries-included use while respecting the No-Derivatives constraint via runtime patching.

The distinction between `templates/` and `external/` is a compliance detail for the repository maintainer, not a functional distinction for the end user. Users just run `open-agreements fill yc-safe-valuation-cap` and it works.

## What Changes

### External template directory (new)
- New top-level `external/` directory for CC-BY-ND licensed documents (sibling to `templates/` and `recipes/`)
- Each external template directory contains:
  - `template.docx` — unmodified original from the source (committed to repo)
  - `metadata.yaml` — Zod-validated schema with fields, source URL, license info, and `source_sha256` integrity hash
  - `replacements.json` — bracket-to-tag mapping (reuses recipe patcher format)
  - `clean.json` — optional cleanup config (footnotes, notes to drafter)
  - `README.md` — attribution, source link, usage notes
- `LICENSE` and `README.md` at the `external/` level with CC-BY-ND attribution and no-modification notice

### Unified CLI experience
- `fill` command searches `templates/` first, then `external/`; users never need to know which tier an agreement belongs to
- `list` command shows a single unified table with a "Source" column (e.g., "Common Paper", "Y Combinator") instead of separate sections
- `list --json` includes external templates alongside regular templates with full field definitions for agent discovery
- CLI prints a redistribution warning when filling external templates: "This is an external document (CC-BY-ND 4.0). You may fill it for your own use, but do not redistribute modified versions. See [source URL] for license terms."

### YC Post-Money SAFE documents (4 templates)
- `external/yc-safe-valuation-cap/` — Valuation Cap, No Discount
- `external/yc-safe-discount/` — Discount, No Valuation Cap
- `external/yc-safe-mfn/` — MFN, No Valuation Cap, No Discount
- `external/yc-safe-pro-rata-side-letter/` — Pro Rata Side Letter

Note: The "Valuation Cap and Discount" combined variant is no longer offered as an official DOCX download on the YC SAFE page as of February 2026.

### Verified YC download URLs
- Valuation Cap: `https://bookface-static.ycombinator.com/assets/ycdc/Postmoney%20Safe%20-%20Valuation%20Cap%20Only%20-%20FINAL-f2a64add6d21039ab347ee2e7194141a4239e364ffed54bad0fe9cf623bf1691.docx`
- Discount: `https://bookface-static.ycombinator.com/assets/ycdc/Postmoney%20Safe%20-%20Discount%20Only%20-%20FINAL-b9ecb516615d60c6c4653507442aa2561023004368232b7d6e75edc9629acc99.docx`
- MFN: `https://bookface-static.ycombinator.com/assets/ycdc/Postmoney%20Safe%20-%20MFN%20Only%20-%20FINAL-2bc87fa3d2ec5072a60d653aec9a885fb43879781e44341fa720a8e7d1cc42ff.docx`
- Pro Rata Side Letter: `https://bookface-static.ycombinator.com/assets/ycdc/Pro%20Rata%20Side%20Letter-d6dd8d827741862b18fba0f658da17fb4e787e5f2dda49584b9caea89bf42302.docx`

### Metadata and validation changes
- Add `CC-BY-ND-4.0` to `LicenseEnum` in `src/core/metadata.ts`
- Redefine `allow_derivatives` semantics: `false` now means "the committed source DOCX must not be modified" rather than "the tool must not render output." Update `validateLicense` and `fill` accordingly.
- Add `ExternalMetadataSchema` extending the template schema with `source_sha256` for integrity checks
- Update `validate` command to validate external templates (metadata schema, DOCX SHA-256 integrity, replacements.json format, clean.json format, field coverage)
- Update `docs/licensing.md` to document the external tier and CC-BY-ND handling

### Runtime fill pipeline for external templates
- Read unmodified DOCX from `external/<id>/template.docx`
- Apply cleaning (reuse `src/core/recipe/cleaner.ts`)
- Apply bracket-to-tag patching (reuse `src/core/recipe/patcher.ts`)
- Fill with `docx-templates` (reuse `src/core/engine.ts`)
- Run verification (reuse `src/core/recipe/verifier.ts`)
- The original `template.docx` in the repo is never modified; all transformations happen in a temp directory

## Impact
- Affected specs: `open-agreements`
- Affected code: `src/core/metadata.ts`, `src/core/validation/license.ts`, `src/commands/fill.ts`, `src/commands/list.ts`, `src/commands/validate.ts`, `src/utils/paths.ts`, `src/cli/index.ts`
- New code: `src/core/external/index.ts` (orchestrator), `src/core/external/types.ts`, `src/core/validation/external.ts`
- New directories: `external/yc-safe-*/`
- New docs: `external/LICENSE`, `external/README.md`, updates to `docs/licensing.md`
- Reuses without modification: `src/core/recipe/cleaner.ts`, `src/core/recipe/patcher.ts`, `src/core/recipe/verifier.ts`
