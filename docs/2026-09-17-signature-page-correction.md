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

## Pre-shipping follow-up — 2026-09-18

Synced the isolated branch with current main `fcdd68e0`; the PR delta remains
these three files. Astra medium, non-fast dynamic review of integrated
`c1463332` passed with recorded limits: 27 focused tests after a required build,
real board pagination and independent signer dates, and no leading blank page
in an executed signature-only probe. Initial reviewer pre-build CLI failures
remain recorded as setup failures, not passes. AST inventory shows 77 affected
actual signature-block sections, one exempt privacy contact-only section, and
no current empty/leading/conditional signature blocks. A syntactically empty
block can produce a heading-only page: future-input hardening advisory, not
proof of rendered signer presence or a current-corpus blocker.

Default parallel preflight failed four unchanged NVCA IRA five-second timeout
cases (1,969 passed/eight skipped). An unchanged-assertion, unchanged-budget
single-worker rerun passed 1,973 tests/eight skipped, all 160 passing files/four
skipped. All equivalent CI preflight checks, DOCX structure and isolated-package
runtime checks passed. Logs `/private/tmp/oa-signature-preship-20260918.log` and
`/private/tmp/oa-signature-preship-single-worker-20260918.log` retain both results.
Current-runtime 82-template receipt/export/PDF refresh remains in progress;
automerge must wait for it. This supersedes the local-only workflow state above,
not its historical evidence. Review: `/Users/stevenobiajulu/Downloads/oa-signature-astra-review-20260918-analysis.md`.
