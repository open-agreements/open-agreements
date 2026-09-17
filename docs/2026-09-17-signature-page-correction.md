# Dedicated signature-page regression — 2026-09-17

Steven identified that the native filled board consent lacked a page break
before Signatures. The canonical website adapter already retains this boundary:
`lib/docx/agreement-docx.ts` emits next-page boundaries between populated
sections. The new CLI renderer flattened every section into one continuous
section to remove the recital/resolution gap and neutralize filled-policy
branding; that over-broad presentation change erased the signature boundary.

The previously passing 82-template render audit did not prove intended section
pagination: missing-title/footer and overlap checks cannot catch this defect.
Its zero-finding result remains valid for those signals, not this invariant.

Correction in `src/core/original-contract-renderer/index.ts`: emit a page-break-
before paragraph immediately before a signature section containing an actual
signature-block. Operative text remains continuous; contact-only sections such
as the privacy policy do not get this break. This uses existing canonical tags,
not a template-ID special case or a changed source/mirror artifact.

Regression in `src/core/original-contract-renderer/index.test.ts` asserts exactly
one explicit break after the resolutions and before Signatures, no next-page
section separating recitals/resolutions, and no break for a contact-only section.
Focused suite: 24 tests passed, build and lint passed. Normal budgets unchanged.

Actual fresh CLI fill of the repository board-consent canonical source, using
the retained synthetic Acme input from the post-merge demo, succeeded. Rendered
through LibreOffice using a new disposable profile. PDF reading-order text and
all three page PNGs inspected: recitals and resolutions share page 1, remaining
resolutions page 2, Signatures begins page 3 with Jane Doe September 17 / John
Smith September 18 signing dates, independent of September 30 effective date.

New artifacts, without replacing the previously reviewed bytes:
`/Users/stevenobiajulu/Downloads/board-signature-page-correction-20260917/`.
Worktree: `/Users/stevenobiajulu/Projects/oa-signature-page-20260917`, branch
`fix/declarative-signature-page-20260917`, based on merged main
`69697fe26ad389a5e282a6651d478e1db77ff163`.

Local correction only: not pushed, merged or released. Astra review, normal
pre-push/full gates and a follow-up PR remain required before shipping. No
Word/Pages compatibility or legal/delivery-readiness certificate claimed.
