# OpenAgreements-original declarative adapter migration

## Latest checkpoint: 2026-09-17

The local original-form migration covers **82/82 current originals**, with
1,078 passing verification cases and 82 receipt-gated PDFs spanning 429 pages.
The inventory below describes the initial 81-form checkpoint; refreshed main
added one form. This is local implementation/verification, not a published npm,
MCP, Stella or hosted-API rollout. Whole-suite timing limits and passing focused
rechecks are recorded in the September 17 regression section.

## 2026-09-16 user-review correction

The earlier visual checkpoint below did not establish production design parity.
Steven identified a misleading publisher eyebrow, lost blue accents, and altered
vertical spacing. Passing semantic checks and checking for clipping did not catch
those differences. See [the feedback correction record](2026-09-16-rendering-feedback.md)
for source comparisons, fixes, verification limits, and the separately owned site
privacy-policy work. Earlier page counts describe the older renderer, not the
corrected production-style profile.

The statement below that source agreements remain unchanged describes the initial
migration only. The subsequent board-consent correction intentionally changes the
canonical source to version 1.3, separating each director's signing date from the
effective date and removing the forced recital/resolution page boundary.

## Scope and source of truth

Local migration work began 2026-09-15 (America/Chicago), against upstream
`518040de`, in branch `pilot/originals-declarative-20260915`. The work is isolated
from the primary checkout. Nothing in this branch has been published, deployed,
or wired into Stella.

The inventory is filesystem-discovered, not a manually curated list: 79 originals
under `templates/openagreements-cc-by-4.0/` and two under
`templates/openagreements-cc0-1.0/`. All 81 already contain canonical `template.mdoc`.
The migration is therefore of the **executable contract/catalog/fill adapter**,
not a rewrite of legal prose or a conversion of 81 previously nondeclarative sources.

The earlier seven-template Common Paper pilot used a separate, bounded
source-DOCX/selection profile. Its 65 tests passed against this updated upstream
baseline before this extension. **Corrected 2026-09-16:** subsequent independent
verification revoked Design Partner's promotion: legacy-output parity had
preserved an ambiguous replacement that reused one answer in unrelated numeric
provisions. The third-party batch now rejects that source mapping rather than
counting the old passing tests as semantic proof. Third-party and external-fetch
forms are not silently treated as OpenAgreements originals.

## Defects uncovered, and what detects them

1. Public metadata has 1,670 fields while canonical sources have 1,732. Thirteen
   forms omit a total of 62 canonical fields from their public metadata. Privacy
   Policy has 35 canonical fields versus 14 public fields. Canonical fields—not
   the public projection—must drive conditional execution. The catalog retains
   the distinction so consumers can collect required facts without exposing
   derived gates as editable answers.
2. Privacy Policy's existing `template.fill.docx` has only one IF command and no
   controls for its 21 canonical-only fields. Its canonical source has 22
   `include-when` attributes. Comparing two fills of that same flattened DOCX
   would preserve the defect. Verification must assert canonical clause retention
   and omission, not rely solely on legacy-output parity.
3. The repository's older `scripts/template_renderer/canonical-source.mjs`
   consumes a different source dialect (section comments and Markdown tables).
   Attempting to feed it these Markdoc sources failed for all 81. The adapter
   uses a bounded native Markdoc renderer instead; it does not claim compatibility
   merely because both formats were called canonical.
4. Canonical `derived_gate` formulas are not ordinary user-controlled booleans.
   A schema that strips that property silently turns dependencies into stale
   defaults. A restricted boolean grammar, dependency checks, and tests that
   reject caller-supplied derived values are required.

These are integration findings, not new legal conclusions. The source agreements
and published DOCX artifacts are left unchanged. Raw logs, manifests, receipts,
and filled synthetic examples belong under ignored `.cache/original-contracts/`.

**Post-checkpoint correction, 2026-09-16:** independent review found that the
adapter and its first oracle both treated the literal string `"false"` as a
Boolean false, silently hiding a text-dependent clause. The employment-offer
`bonus_terms` reproduction demonstrated actual content loss. Typed strings now
use nonblank/non-placeholder presence, and every string-bound branch receives
an exact `"false"` regression case. This is why agreement with an oracle sharing
the same assumption was insufficient.

The same review found ignored document-layout directives. The native profile
now applies authored cover-row height, footer size, label/version, and the three
defined-term visual modes; unknown future document/frontmatter settings fail
closed. `include_cloud_doc_line: true` is an explicit **legacy-inert compatibility
flag**, not a claimed cloud integration: no implementation exists in the older
renderer and the inspected published employment DOCX contains no such line.
The contract, catalog, and fill CLI expose this limitation as rendering notes;
unverified alternative values are rejected. Source legal prose is unchanged.

## Verification and promotion rules

- Every discovered form receives a verified or blocked receipt; none disappears
  from the denominator because compilation failed.
- Typed fixtures exercise scalar values, enum alternatives, boolean polarities,
  and arrays with zero, one, and two rows. Derived branches require source-fact
  fixtures and independent expectations. Ordinary baseline checks are not an
  exhaustive proof of every possible boolean combination.
- Confirmation representations remain unconfirmed in ordinary synthetic fixtures.
  A false confirmation must retain its conspicuous warning when applicable; it
  is not permission to omit an applicable legal recital or assert compliance.
- Verification binds to source hashes, the compiled contract, runtime inputs,
  and the verification implementation. Source/runtime changes invalidate prior
  promotion; they do not inherit yesterday's verified label.
- Unknown source syntax fails closed. License/attribution and public descriptions
  travel with the contract. Descriptions are not legal suitability determinations.
- A local compiled manifest is **not** a portable standalone renderer, a shipped
  API, or a live Stella catalog. It requires the matching OpenAgreements runtime.
  The September 17 CLI integration supports packaged installations as well as
  a source checkout; it is not yet a published npm release.

## Local use

Install the locked dependencies and build before verification. Export and fill
automatically rebuild using the checkout's installed TypeScript compiler and
run the runtime-capability check before loading the generated JavaScript. This
prevents executing a stale `dist` copy while certifying current source hashes.
The verification runner produces per-template
receipts at `.cache/original-contracts/<template-id>/receipt.json` and a complete
inventory receipt at `.cache/original-contracts/catalog-receipt.json`.

```sh
npm run build
npm run verify:original-contracts
npx vitest run scripts/export-original-contracts.test.mjs
npm run export:original-contracts
node scripts/fill-original-contract.mjs \
  --template openagreements-privacy-policy \
  --values /absolute/path/to/synthetic-values.json \
  --output /absolute/path/to/new-output.docx
```

The exporter writes `.cache/original-contracts/export/catalog.json` plus relative
contract manifests. `--verified-only` filters out blocked or stale entries but
preserves full-inventory counts in the summary. The fill script refuses missing
or stale verification and refuses to overwrite an existing output.

## Verification method

The independent oracle walks the canonical Markdoc AST and reconstructs the
expected ordered body paragraphs, including static prose, substituted fields,
conditional omissions, and each repeated row. It compares those expectations
with `word/document.xml`, not the renderer's own flattened text or a legacy
DOCX. Header/footer label, version, and attribution are now independently checked
in their separate OOXML package parts for every generated case; removing the
footer or changing the header is covered by adversarial mutation tests. The oracle
independently evaluates derived gates and checks local/global confirmation warning
cardinality. Representative rendered samples additionally check visual layout.

`scripts/original-oracle-mutation.test.ts` proves that this oracle rejects
deleted/duplicated unconditional prose, an injected row when the array is empty,
damaged static repeat prose with intact field sentinels, a duplicated repeat row,
and incorrect warning/body presence across the confirmation triad. A confirmed
test fixture is synthetic mechanism testing, never evidence that a real party
has satisfied a statutory requirement.

Two test-harness defects were corrected before final promotion: array sentinels
now include the collection name so same-named fields in different collections
do not collide; explicit empty field defaults are distinguished from absent
values that render as blanks. Changing the verifier invalidates and regenerates
all receipts. The catalog-proof test originally used `node:test`; it now uses
Vitest so the repository's actual full-suite runner executes it correctly.

Adversarial review also found that a self-consistent shortened receipt could
otherwise receive promotion. Verification and promotion now share a deterministic
case planner; promotion recomputes the full ordered case-ID/input-hash inventory
from the current contract and requires an exact match. Generator changes are
hash-pinned too. Scalar branch cases use pre-lowering source bindings, not
renderer-owned synthetic gate names. This expanded the sweep from 840 to 998
cases. Numbered lists with an unsupported starting number now fail closed.

A fourth visual sample (Florida's pending-confirmation fixture) exposed collapsed
signature lines: Markdown soft breaks were treated as spaces even inside signer
blocks. The renderer now emits Word line breaks inside signers while preserving
ordinary paragraph wrapping. A focused regression distinguishes those two cases.
It also avoids adding a second metadata caption when the source already begins
the signer block with that exact caption. The independent oracle models that
presentation rule separately. No legal text was changed.

## Execution status

The first original-form adapter checkpoint completed locally: **81/81 discovered
forms, 998/998 generated cases passed, zero blocked**, with 81 entries in the
verified-only export. Privacy Policy has 44 cases; Florida has 39. A broader
third-party batch is still being worked separately. These are the pre-audit
checkpoint counts and hashes, retained as history; the post-audit corrections
above invalidate those receipts and require a fresh final sweep before delivery.

Checkpoint receipt runtime digest:
`52d06108c2abadf905ff40224b6e8e5942a32a2b931c03b77ffc6980f9a4fbff`.
Verifier SHA-256:
`f2b225e0f6d105e4bc8d0959680dc14d61195a508ae5c701973b373ca518d047`.
Case-planner SHA-256:
`ee450cec44bd6e6d30d4bda0ed490e09605632bf429ee4496a8e8cb75fbcc2a5`.
All 81 receipts have the same runtime digest and their own source and expected
case-inventory digests. Later core-code edits require fresh receipts.

Measured checks:

- `npm run build`, `npm run lint`, and `git diff --check`: passed.
- `node bin/open-agreements.js validate`: passed for 106 bundled templates,
  four external templates, and seven field selectors (pre-existing warnings
  remain; no unrelated metadata was changed).
- `npm run test:run -- --maxWorkers=2`: 156 test files passed, four skipped;
  1,935 tests passed, eight skipped. This was followed by the final caption-only
  change and its focused renderer/oracle run: 16 tests passed. The initial
  high-concurrency run hit two unrelated five-second NVCA timeouts; reducing
  worker concurrency passed without weakening timeouts or editing those tests.
- `npx vite-node scripts/verify-original-contracts.ts`: authoritative post-caption
  sweep passed all 998 cases; `node scripts/export-original-contracts.mjs
  --verified-only` exported all 81.
- `git diff --name-only 518040de -- templates`: empty. No canonical template
  text, metadata, published DOCX, or source license was modified.

Full-suite log: `/private/tmp/oa-originals-final-regression.log`; full-sweep log:
`/private/tmp/oa-originals-998-final.log`. These logs and generated receipts are
local regenerable evidence, not tracked source artifacts.

Three actual CLI fills succeeded without warnings and were rendered using
LibreOffice **26.2.5.2**, explicitly pinned for these invocations (the shared
environment's older pin was not changed):

| Synthetic example | DOCX path under `.cache/original-contracts/` | PDF/pages |
| --- | --- | --- |
| Privacy Policy | `demos/privacy-policy.docx` | `demos/privacy-render/privacy-policy.pdf` — 2 |
| SAFE board consent, two directors | `demos/board-consent.docx` | `demos/board-render/board-consent.pdf` — 2 |
| Closing checklist, two documents/one action/no issues | `demos/closing-checklist.docx` | `demos/checklist-render/closing-checklist.pdf` — 1 |

All five rendered pages were visually inspected and all three PDFs opened in
the local viewer. Review checklist:

- Privacy: one title, continuous numbering after omitted sections, intact
  rights/UOOM sections, contact details, and attribution.
- Board consent: intact resolutions, exactly two director signature blocks,
  consistent signature text size, and no clipped text.
- Checklist: exactly two document entries and one action; no phantom entry under
  the empty Open Issues section; intact links and source disclaimer.

Florida's pending-confirmation fixture was additionally sampled on pages 1 and 6.
The final page-6 render in `demos/florida-signature-final/` confirms preserved
signature line breaks and a single Employee caption. This is a sampled visual
check, not a claim to have visually reviewed all six pages or all 81 forms.

Hashes, gate evaluation, stale-evidence rejection, and mutation resistance are
test evidence, not visually verifiable properties. These checks do not certify
Microsoft Word pagination or the legal sufficiency of the source provisions.

## Final combined checkpoint — 2026-09-16

This supersedes the historical 998-case checkpoint above. All **81 originals
are verified, across 1,077 passing verification cases, with zero blocked**.
Cases include expected rejection of invalid inputs, not 1,077 generated DOCXs.
The freshly rebuilt verified-only catalog contains all 81 originals.

- Original runtime digest: `10130af5fba17fc653d52e33d8fc492dd125b72eb9d9de7002c0aff5b6989a21`.
- Original verifier SHA-256: `7d6f00ce634f3f0e7959155991e32103717970fb58365965147ffb8537559294`.
- Original sweep log: `/private/tmp/oa-originals-release-evidence.log`.
- Combined full regression: **159 test files passed, four skipped; 1,959 tests
  passed, eight skipped**, using `npm run test:run -- --maxWorkers=2`.
  Log: `/private/tmp/oa-declarative-all-tests-final.log`.
- Build, lint, validation, derived-artifact checks, documentation checks, and
  diff whitespace checks passed. The inventory validator covers 106 bundled
  templates, four external templates, and seven selectors.
- `git diff --name-only 518040de -- templates external field-selectors` is empty:
  no canonical legal prose, metadata, distributed DOCX, or external recipe changed.

The combined third-party extension verifies 12 fillable forms across 107 cases,
validates one zero-field static copy, and keeps 12 forms blocked. See
`thirdparty-declarative-blockers.md` for exact classifications and the independently
checked explicit-empty reference profile. A global placeholder-truthiness change
initially broke seven NVCA regression tests; it was corrected in `16468e5e` by
making the new selection behavior adapter-only. The final full suite includes
those unchanged NVCA tests. No NVCA or YC source is redistributed by this work.

### Corpus rendering and final review artifacts

Every original's baseline DOCX was rendered using LibreOffice 26.2.5.2: **81/81
PDFs, 351 pages**. Automated checks found the expected title and attribution in
all 81 PDFs and all 118,606 extracted word boxes within page bounds (0.25-point
tolerance). The reproducible audit is at
`.cache/original-contracts/render-audit/audit.json`; that snapshot precedes the
third-party-only selector correction and uses the same original renderer.
Bounds checks do not prove absence of overlap or certify Word pagination.

Visual sampling covered Privacy Policy and the first/last pages of generic and
Florida employment offers. A claimed Florida name/date concatenation was a
review false positive: direct inspection of the exact PNG, OOXML breaks, and
PDF text established separate lines. The audit retains the superseded finding
and dated correction; no source or renderer change was made for it.

Three fresh fills from the final verified runtime are in
`/Users/stevenobiajulu/Downloads/openagreements-declarative-review-2026-09-16/`:
`privacy-policy.docx`, `board-consent.docx`, and `closing-checklist.docx`, with
synthetic JSON inputs and PDF/PNG previews. All five final preview pages were
visually inspected and the three PDFs opened. Check the privacy numbering and
rights clauses, two separate director signature blocks, and exactly two document
rows/one action/no phantom issue in the checklist. Attribution and headers are
visible throughout. These are demonstrations, not client-ready legal advice.

## Remaining boundary

This is a **local, verified adapter migration**, not a live Stella release. It
does not publish a GitHub catalog artifact, add a hosted API, connect Stella's
browsing/import UI, or automatically collect missing business facts. It uses
the current source checkout; GitHub mirror freshness remains a separate concern.
Unsupported new syntax fails closed rather than receiving an inherited verified
label. The new document-layout profile is explicit and is not a claim of
pixel-identical legacy DOCX output.

The migration preserves operative source language except the separately reviewed
board-consent correction (independent signing dates and effective date). Footer
provenance is retained in source comments rather than rendered attribution.
Published template binaries are not replaced by the experimental profile. Source
legal review, source-specific stability graduation, and suitability advice are
separate from renderer verification. NVCA and YC forms are not reclassified as
redistributable originals or copied into this profile.

## September 17 CLI integration

The standard CLI retains its legacy default. Select the canonical renderer explicitly:

```sh
open-agreements fill openagreements-privacy-policy --declarative --data values.json -o filled.docx
```

This compiles the current canonical source, validates supplied values against its
complete schema, and renders its conditions and arrays. It does not itself issue
the all-fixture promotion receipt used by the verified-only catalog exporter.
New unsupported source constructs fail closed. Renderer compatibility notes are
returned as warnings; internal rendering gates are not reported as user fields.

### Before and now

```text
Before (original forms were already authored in Markdoc):
  legal-explainer canonical .mdoc
                |
                v  projection / GitHub mirror (can lag)
  open-agreements: DOCX + narrower public metadata
                |
                v  legacy placeholder filling / Stella field inference
             filled DOCX

Now (new local opt-in execution profile):
  same canonical .mdoc, mirrored to open-agreements
                |
                v  compile all fields, conditions, repeat arrays
        complete typed contract + rendering profile
                |                         |
                v                         v
  source/runtime verification       validate user answers
                |                         |
                v                         v
       verified-only catalog       evaluate branches / arrays
                                          |
                                          v
                                  render styled filled DOCX
```

The CLI's new `--declarative` path works from both the source checkout and a
packed, isolated installation. Legacy filling remains the default. A verified
catalogue does not yet imply a live browsing endpoint or a Stella connection.
Generic execution can consume source updates within supported syntax without
per-template adapter edits, but mirror lag, source changes and new unsupported
constructs still require explicit handling. NVCA/YC licensed external downloads
remain on their existing source-fetch/recipe path, outside this originals profile.

Package-isolation testing caught `docx` incorrectly classified as a development
dependency. It is now a runtime dependency. Runtime discovery uses packaged
`dist/core` JavaScript when repository `src/core` is absent; a published package
does not require a repository lockfile or TypeScript sources.

### Regression follow-through

Refreshing main added the venture-financing due-diligence request list, bringing
the actual original inventory to 82. Discovery tests now compare against an
independently enumerated filesystem inventory rather than hard-coding 81.

The first combined regression run reported 109 failures: 72 compatibility-hash
guard rejections, two downstream missing-case assertions after that guard
prevented receipt generation, one obsolete inventory count, and 34 timeouts
across eight legacy integration files. A separate Vitest reporting RPC also
timed out. These are recorded, not presented as a green full-suite result.
The log is `/private/tmp/oa-suite-final.log`; classification parsed each numbered
Vitest failure block and reconciled its totals to the final summary.

`git diff e2724e64 -- src/core/engine.ts` confirmed the CLI integration added only
an explicit opt-in branch and its import/type, leaving legacy signature rules
unchanged. The expected SHA was deliberately re-pinned from
`38facbeab04d647641ed42dcd501a12fbc0ea8e21261af600becb3de9465a329` to
`18c1d701c915e1451a63d998058d3f91411623fac87240a71329b4d3e6d20c21`;
the fail-closed guard remains. Eight focused suites exercised 80 passing tests
and one skipped test. Their only remaining failure was the complete-corpus
inventory scan exceeding the default five seconds. That scan passed in 10.03s
with an explicit finite 30-second budget using the existing coverage multiplier.
The two missing-case assertions pass again without changes to their assertions.

This runtime change invalidated earlier promotion receipts. The new sweep and
verified-only export completed with **82/82 originals, 1,078 cases passed, zero
blocked**, superseding the older 81-original checkpoints. The full regression
retry remains a separate gate; original receipts do not imply the full suite is
green. Normal legacy integration timeouts have not been broadened.

Matched NVCA IRA diagnostics used Node v26.8.1 and one worker without editing
the existing tests. An isolated `origin/main` baseline at `131a015c` passed all
nine tests with the default five-second budget (30.18s total). With an explicit
diagnostic 20-second budget, the pilot passed 9/9 (35.43s total), and the same
baseline passed 9/9 (57.24s total), including a 17.62s case. This shows timing
variability also affects unchanged baseline code; host contention is an
inference, not a proven cause. The diagnostic budget is not a claim that the
normal whole-suite gate is green. Reproducible command:

```sh
npx vitest run integration-tests/nvca-ira-drafting-choice-coverage.test.ts --maxWorkers=1 --minWorkers=1 --testTimeout=20000
```

Logs: `/private/tmp/oa-main-nvca-default-20260917.log`,
`/private/tmp/oa-pilot-nvca-20sec-20260917.log`, and
`/private/tmp/oa-main-nvca-20sec-20260917.log`. The isolated baseline worktree
remains at `/private/tmp/oa-main-nvca-baseline-20260917` for inspection.

The second full run used one worker and unchanged normal legacy budgets:
158 files passed, two failed, four skipped; 1,957 tests passed, ten failed,
eight skipped (839.00s). All ten failures were five-second timeouts: eight
NVCA IRA drafting-choice cases and two checklist idempotent-patch cases.
No compatibility-hash, inventory or assertion failures remained. Evidence:
`/private/tmp/oa-suite-final-retry.log`. A separate focused diagnostic uses
`--testTimeout=20000`; it does not edit or replace the normal suite gate.
That focused diagnostic passed all 25 tests in both affected suites (28.73s),
including all ten cases that timed out in the whole run. Log:
`/private/tmp/oa-timeout-focused-final-20260917.log`.
An immediate focused rerun with the original five-second budgets also passed
all 25 tests (25.37s): `/private/tmp/oa-timeout-default-recheck-20260917.log`.
These reruns cover every failed case, but the previous whole-run result remains
a timeout-bearing run rather than being retroactively labelled a clean pass.

**Final whole-suite gate:** a third complete run with the original normal
budgets and one worker passed **160 files, 1,967 tests**, with four files/eight
tests skipped and zero failures (1,975 discovered tests). Command:
`caffeinate -i npm run test:run -- --maxWorkers=1 --minWorkers=1`.
Evidence: `/private/tmp/oa-suite-final-normal-20260917.log`. The earlier failed
logs remain part of the record; no legacy timeout configuration was modified.

`scripts/audit-original-contract-renders.mjs` provides a reproducible baseline
render audit. It requires a matching verified-only catalogue and current
source/runtime-bound receipts, then checks extracted canonical titles, footer
credit/license and page-bounded word geometry. It records potential box-overlap
signals separately from visual inspection. Run with the trusted installed
LibreOffice version explicitly pinned, for example:

```sh
OA_SOFFICE_PIN_VERSION=26.2.5.2 node scripts/audit-original-contract-renders.mjs
```

Final receipt-gated audit: **82/82 PDFs, 429 pages, zero missing titles or
footers, zero out-of-page word boxes, zero automated near-complete box-overlap
signals**. Evidence is ignored, reproducible output under
`.cache/original-contracts/render-audit-20260917/audit.json`, with per-template
PDFs and raw extraction/geometry. The audit records the LibreOffice binary hash
and explicit 26.2.5.2 version pin; the repository's default pin was not changed.
The first comparison incorrectly treated PDF-extracted wrapped compounds such
as `Alabama-\nspecific` as different footer text. Joining the wrapped
continuation while retaining the visible hyphen fixed that check; no document
content was altered to accommodate the comparison.

Visual sampling is separate: all six pages of the supplied privacy/board
filled previews, and the audit's privacy first page and Hawaii covenant first
page, were inspected locally. No clipping or overlapping content was observed
in those samples. The long Hawaii footer wraps legibly over two lines. These
samples and automated bounds do not certify every page's visual layout or
Microsoft Word behavior. The local new-format previews are in
`/Users/stevenobiajulu/Downloads/openagreements-declarative-review-2026-09-17/`.

## Footer fix shipped; migration publication handoff

The user-authorized footer issue
[#2726](https://github.com/UseJunior/legal-explainer/issues/2726) was closed by
[#2727](https://github.com/UseJunior/legal-explainer/pull/2727), merge
`d34adc76cdb4343f644e48192ed56ecee8e00f71`. The dedicated change touches only:

- `content/agreements/openagreements-privacy-policy.mdoc`
- `content/agreements/openagreements-board-consent-safe.mdoc`
- Their two `content/oa-mirror-manifest/agreements/<slug>.json` manifests.

Long drafting provenance moved from rendered `attribution_text` into source
comments; attribution is now `Licensed under CC BY 4.0.` Credit, version and
license remain. The website renderer already independently used the short
“Free to use under” footer. The correction fixes canonical/public JSON metadata
and the new renderer's metadata-driven footer, not previously long website
footer text. Operative text was unchanged.

[Post-merge proof](https://github.com/UseJunior/legal-explainer/pull/2727#issuecomment-5710712338):
fresh validation passed all 33 tasks/5,828 tests (six skipped), plus the mutation
guard probe; fresh build passed all 15 tasks with zero cache hits; projection
check passed. Production deployment `dpl_FU8dY9PHFE2CYWKsEmqQPLbFjq44` is READY
at the exact merge SHA with the `openagreements.org` alias. Both live metadata
endpoints and real DOCX download paths passed footer assertions. Live DOCXs were
rendered using explicitly pinned LibreOffice 26.2.5.2; first-page PNGs were
inspected/opened locally. These footer-scoped fills leave unprovided terms and
signers blank and do not claim delivery readiness. Evidence/logs remain under
`/Users/stevenobiajulu/Downloads/footer-2726-postmerge-20260917/` and
`/private/tmp/automerge-smoke-2727-*-20260917.log`.

**Corrected 2026-09-17:** the initial proof comment's manually reconstructed
completion excerpt listed several unrelated skill paths. The comment was
corrected in place with a dated explanation; all 26 excerpt artifact paths were
then asserted against the retained actual log. The underlying check counts,
verdicts and rendered evidence did not change. Captured excerpts should be
copied/generated and mechanically checked, not reconstructed from context.

Only the two clean footer worktrees and merged footer branch were removed;
primary/unrelated checkouts and this migration branch remain untouched.

The **original-form migration is complete locally**, including fresh verified
receipts, PDF audit and passing normal full regression. It is not published:
the new CLI flag needs a release; the verified catalogue is not hosted or wired
to Stella/MCP. The local board v1.3 source correction still needs its canonical
legal-explainer PR/merge before publishing that mirrored source. Production
board remains v1.2, with the known first-page gap and effective-date signature
mapping. Next handoff: land that separate source correction, then review/open
the migration PR and coordinate catalogue/release/Stella rollout. This report
does not authorize those additional public actions or claim they occurred.

### 2026-09-17 pre-ship refresh (in progress)

Steven subsequently authorized proceeding and required an Astra-medium,
non-Fast review before shipping. That review executed the installed-package
CLI fill and source/renderer tests; its retained analysis is
`/Users/stevenobiajulu/Downloads/oa-pre-ship-astra-review-20260917-1305-analysis.md`.
The canonical board correction remains separate and unpublished pending its
full pre-push gates. Neither primary checkout was changed.

Fresh originals verification passed 82/82 templates and 1,078 cases; the fresh
receipt-bound PDF audit passed 82 documents/429 pages, with zero missing titles,
missing footers or automated overlap signals. Logs are
`/private/tmp/oa-fresh-originals-20260917-1315.log` and
`/private/tmp/oa-render-preship-20260917.log`. This does not certify every page
in Word or legal suitability for a particular transaction.

**Corrected 2026-09-17:** the historical full-regression pass above does not
certify today's integrated checkout. Today's first full run failed nine legacy
five-second timeouts; an unchanged focused retry still failed three NVCA
timeouts. Those failures remain recorded, not reclassified as passes.
Logs: `/private/tmp/oa-full-tests-20260917-1315.log` and
`/private/tmp/oa-legacy-timeouts-retry-20260917.log`.

Preflight caught ten new test files lacking mandatory Allure wrappers. The
wrapper correction passed 113 tests (one deliberately skipped), but emitted
missing-context warnings. Astra independently found a preexisting dependency
mismatch: Allure resolved runner 4.1.3 while Vitest executed runner 3.2.4.
The static label gate cannot detect missing emitted labels or attachments.
Exact-pinning Vitest and its direct runner to the already-executing 3.2.4
deduplicates that peer dependency without changing test assertions or budgets.
Build, lint and the static label gate pass; a changed renderer suite and an
unchanged selector suite pass 79 tests without those context warnings. Logs:
`/private/tmp/oa-allure-dependency-align-20260917.log` and
`/private/tmp/oa-allure-runtime-proof-20260917.log`. Review must additionally
inspect actual emitted Allure JSON. The intermediate full run was deliberately
interrupted before dependency installation; its exit 130 is not a pass.
Final aligned full regression is still pending in
`/private/tmp/oa-final-aligned-full-tests-20260917.log`; shipping remains held.

**Completed 2026-09-17:** the final aligned full run exited 0: 1,968 tests
passed, eight skipped, 160 passing files/four skipped, 443.42 seconds, with
unchanged normal budgets and one worker. This final result supersedes the
pending state, not the retained failed runs. DOCX structure also passed all
191 files with zero findings, and isolated-package runtime checks passed;
log `/private/tmp/oa-docx-structure-preship-20260917.log`.
Astra's final addendum independently verified emitted labels and nested
assertion attachments and passed the reviewed wrapper/dependency patch.
Canonical board correction PR #2733 is open with merge-method automerge armed;
its fresh local validation passed 5,843 tests/six skipped and all 33 tasks,
and fresh build passed all 15 tasks (zero cache hits). No migration release,
hosted catalogue, Stella rollout or successful production board deployment is
claimed here; those boundaries remain distinct.

**Corrected 2026-09-17:** the pre-alignment receipts/render audit above cannot
certify the final lockfile: `RUNTIME_FILES` includes `package-lock.json`.
Verification receipts and the verified-only catalogue were regenerated after
dependency alignment (82/82 passed); a distinct audit is running in
`.cache/original-contracts/render-audit-20260917-final-aligned`. The earlier
audit remains historical. Preserve receipt/runtime binding even when the
dependency edit only affects test reporting.

Migration PR #865 is open, with no automerge armed before canonical board
PR #2733 and mirror synchronization. Its initial CodeQL scan found two
double-decoding helpers: ampersand decoding followed by angle-entity decoding
could transform literal `&amp;lt;` twice. Commit `da44fb91` replaces both with
one shared, single-pass XML decoder; four regression cases plus six mutation
tests passed, and Astra independently reviewed/executed that correction before
push. CodeQL must pass on the corrected head; no security gate is waived.
Unknown/numeric references are left unchanged, not newly advertised as decoded.
