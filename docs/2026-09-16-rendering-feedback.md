# Rendering feedback correction — 2026-09-16

## Scope and ownership

Local only in `pilot/originals-declarative-20260915`; no push, PR, deployment, or
Stella release. Existing unrelated worktrees were preserved.

The actual openagreements.org privacy policy is a separate task:
[legal-explainer #2718](https://github.com/UseJunior/legal-explainer/issues/2718).
Lantern 1 confirmed an actual `oa-site-privacy` agent in workspace w3G, pane w3G:p1,
branch/worktree `site-privacy-policy-2718-20260916`, using gpt-5.6-terra medium,
default service tier, Fast OFF. Implementation is delegated, not claimed complete.
The brief requires verified site practices and canonical-template provenance;
no invented factual defaults, publication, push, PR, or deployment.

## What went wrong and what would have caught it

The native adapter preserved content but substituted generic document styling.
The first visual gate checked readability/clipping, not the production style
contract. It also placed the publisher's metadata label in the running header,
which could misidentify a customer's filled privacy policy as OpenAgreements' own.
Production style-property assertions and a side-by-side comparison were missing.

Comparison sources supplied by Steven:

- `Downloads/openagreements-board-consent-safe (1).docx`, SHA-256
  `8f240da06a2622fb52508525b22619ba396698afe18325b2e02fe8a1afa0dbd4`.
- Corresponding PDF, SHA-256
  `be20e8e23c91544e2f41156894692142b52679b038c1c9608422c2f9a3d70986`.

Both were inspected: DOCX XML properties and all three rendered PDF pages. The
production first-page gap is a preexisting defect, not a fidelity target.

## Implemented corrections

- Native headers use the neutral document title (Privacy Policy), not publisher
  label. Attribution remains in the footer.
- Production-style blue heading/rule accents, Arial body and Georgia title,
  margins, paragraph spacing, footer attribution and page fields restored.
  Renderer commits: `21580985`, `cc777887`.
- A malformed bare tab in an initial footer attempt was caught by real rendering;
  it is now a run-wrapped tab, with a regression assertion.
- Canonical board source version 1.3 has per-director `signing_date`, distinct
  from `effective_date`; omitted signer dates remain blank, never fall back.
  A separate sentence now states the effective date. This is an intentional
  source-language change, not merely styling, and remains subject to human review.
- Canonical production presentation is traditional/continuous, and the native
  renderer has no forced page boundary between recitals and resolutions.
  This removes the reported board gap; it is not a claim to have audited every
  possible cover-table layout in every template.
- Canonical legal-explainer commits `d9781642` and `f232cbe5` live only in
  `.worktrees/board-consent-signing-dates-20260916`. The six generated board
  projection files were copied from that worktree's mirror output, not rewritten
  independently. Public snapshot regenerated for the new nested date field.

## Verification and discovered test assumptions

The full originals semantic sweep passed 81/81, and verified-only catalog export
reported 81 verified, zero blocked. Receipts bind source, runtime and oracle hashes.
The initial oracle failed the new nested date because it looked up only top-level
field types; it now tracks repeat-item types. A mutation test rejects substituting
the effective date for a distinct signing date. Header and page-field mutations
are also rejected.

The full regression run initially reported 1,961 passed, eight skipped, two failed:
the two failures were legacy board fixtures expecting an effective date at every
signature without supplying signing dates. The fixtures now explicitly supply a
different signing date and assert the effective date appears once. All six signer
integration tests then passed. Final verification status is recorded below rather
than treating the initial failing suite as a pass.

## Closing checklist assessment

The mirrored original is a blank three-table tracker, not a substantive M&A
closing checklist. Current legal-explainer source adds 32 optional priced-equity
financing starter items, but explicitly omits that content from the OA projection.
That is not merely mirror lag and is still not traditional M&A content.
Existing issue #2564 addresses the financing checklist's substance. Nothing has
been unpublished or relabelled: Steven's 'might' was not publication authorization.
Recommendation: accurately label any retained blank tracker, distinguish the
financing checklist, and treat substantive M&A content as separate authored work.

## Rendered review artifacts

Base directory: `~/Downloads/openagreements-declarative-review-2026-09-16/corrected/final/`.

- Privacy: `privacy-policy.docx`, SHA-256
  `a7ddfa54d8b3a0f489b892de47ce32af9f8fbc881a0f60290dbaf2e2925d109a`;
  `privacy-preview/privacy-policy.pdf`, SHA-256
  `9c6c2e878617f2791ae037f9dba32426f3a01242d3d8e472a7bc9351e3e018ae`.
- Board: `board-consent-reviewed.docx`, SHA-256
  `863938b73f8ef15ee494cc89e5575c12f546385469eada9faf47c9927bb0396b`;
  `board-reviewed-preview/board-consent-reviewed.pdf`, SHA-256
  `287cda1b539b7f1ec6f5ea13c60e5ee3296a493f751b57183518627db280394a`.

Each PDF has three pages. Render method: `scripts/render_docx_pages.mjs`, with
`OA_SOFFICE_PIN_PATH=/Applications/LibreOffice.app/Contents/MacOS/soffice` and
`OA_SOFFICE_PIN_VERSION=26.2.5.2`, `--keep-pdf --json`; all pages inspected as PNGs.
Both final PDFs opened with separate macOS `open` commands for human review.

That visual review caught an orphaned second director's date, not detected by
semantic text parity. Commit `0e1e0a4c` keeps each repeated signer block together
without chaining all directors. Final board page 1 includes recitals and
resolutions, page 2 has Alex's complete block, page 3 has Morgan's complete block.
Effective date is September 30; signing dates September 16 and 18. Prior files
remain intact and are explicitly superseded in `corrected/README.md`.

## Final local verification

At code commit `0e1e0a4c`, `npm run verify:original-contracts` passed all 81
discovered originals / 1,077 generated cases (including expected rejections).
Verified-only export: 81 verified, zero blocked or unverified. Runtime digest:
`4a2f8148fd4dc0f80f8f9e7a5f3ff297ee519ffbd4ac60137a96d7018fa9fc28`.
Logs: `/private/tmp/oa-feedback-final-originals.log` and
`/private/tmp/oa-feedback-final-export.log`; durable receipts remain in ignored
`.cache/original-contracts/`. Build, lint, documentation-link checks, template
validation, derived-artifact freshness and diff-whitespace checks passed.
All six board projection files matched the canonical LE mirror output by SHA-256.

The final full suite was **not wholly green**: 1,963 passed, eight skipped, one
five-second timeout in `nvca-ira-drafting-choice-coverage.test.ts` (minimum-shares
placeholder). An isolated rerun with the same timeout passed that case in 2.572s
but timed out a different case (Major Investor / board-observer thresholds), with
eight others passing. No NVCA code or persisted timeout was changed. This supports
a timing-sensitivity hypothesis, not a claim that the standard full-suite gate
passed. Logs: `/private/tmp/oa-feedback-final-suite.log` and
`/private/tmp/oa-feedback-nvca-timeout-rerun.log`.

A diagnostic-only run with `--maxWorkers=1 --testTimeout=20000` passed all nine
tests in that file (15.20s total). Log:
`/private/tmp/oa-feedback-nvca-diagnostic.log`. This checks behavioral assertions
under a bounded longer timeout; it does not erase the standard-timeout failures
or modify the repository's test settings.

## Remaining limitations

This restores specific production styling; it is not pixel-identical production
layout. Privacy clause labels remain standalone headings rather than production's
inline bold labels; board child resolutions are not automatically numbered 1.1,
1.2, etc. New visual review covers the privacy and board examples, not a fresh
render of all 81 forms. No Word fidelity or legal-compliance certification is made.
Third-party receipts from the previous runtime checkpoint are not fresh proof for
the changed runtime. No remote catalog/API or live Stella integration was shipped.
