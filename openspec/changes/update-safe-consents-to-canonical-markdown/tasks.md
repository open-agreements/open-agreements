## 1. Canonical signer authoring
- [x] 1.1 Extend canonical Markdown signer authoring so `oa:signature-mode` can
      declare a repeat-backed stacked signer block with one signer prototype.
- [x] 1.2 Add tests covering repeat metadata compilation and rendered loop
      output for repeat-backed signer sections.

## 2. SAFE consent migration
- [x] 2.1 Re-author the SAFE board consent as canonical `template.md` and
      remove consent-specific Contract IR sidecars.
- [x] 2.2 Re-author the SAFE stockholder consent as canonical `template.md`
      and remove consent-specific Contract IR sidecars.
- [x] 2.3 Update related docs, catalog/download plumbing, and generated
      artifacts to treat the canonical Markdown source as the only branded
      source of truth for these templates.
- [x] 2.4 Surface SAFE-specific economics and deviations from standard SAFE
      terms as cover-page sub-rows instead of an inline suffix on the
      Instrument row.

## 3. Verification
- [x] 3.1 Run `node scripts/generate_templates.mjs`.
- [x] 3.2 Run `openspec validate update-safe-consents-to-canonical-markdown --strict`.
- [x] 3.3 Run `npm run check:spec-coverage`.
- [x] 3.4 Run focused Vitest coverage for canonical authoring, SAFE consent
      generation/fill behavior, and signer-loop rendering.
