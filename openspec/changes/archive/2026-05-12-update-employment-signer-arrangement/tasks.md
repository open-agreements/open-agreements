## 1. Implementation
- [x] 1.1 Add OpenSpec requirements for arrangement-aware signer rendering and canonical employment signer cleanup.
- [x] 1.2 Update `cover-standard-signature-v1` so `mode: signers` renders stacked signer blocks and validates `entity-plus-individual`.
- [x] 1.3 Convert `openagreements-employment-offer-letter` to canonical `template.md` + `.template.generated.json` and remove the legacy `template.json`.
- [x] 1.4 Remove the individual `Title` row from the Employee IP canonical source and generated JSON.
- [x] 1.5 Keep first-party employment signer data free of `left_only` and mirrored individual-title rows.

## 2. Validation
- [x] 2.1 Add or update focused tests for canonical signer authoring and stacked DOCX signature rendering.
- [x] 2.2 Run `openspec validate update-employment-signer-arrangement --strict`.
- [x] 2.3 Run targeted integration tests for canonical-source and signature rendering behavior.
- [x] 2.4 Regenerate affected employment template artifacts (`.template.generated.json`, `template.docx`) and verify no stale legacy source files remain.
