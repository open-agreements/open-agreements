## 1. SAFE stockholder consent backport

- [x] 1.1 Add `content/templates/openagreements-stockholder-consent-safe/`
      with canonical Contract IR authoring files, metadata, generated
      artifacts, and a reference source DOCX.
- [x] 1.2 Preserve the stockholder consent legal text, Section 228 timing
      concept, SAFE approval flow, placeholders, and signature structure from
      the current Joey Tsang source template.

## 2. Verification

- [x] 2.1 Register the stockholder consent in the Contract IR generation
      workflow.
- [x] 2.2 Add focused tests for Contract IR loading, validation, rendering,
      fidelity, and clean filled-output behavior.
- [x] 2.3 Run targeted generation, OpenSpec validation, and test commands, then
      update this checklist to reflect the completed work.
