# OpenAgreements-original declarative adapter migration

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
  API, or a live Stella catalog. The experimental runtime requires this checkout.

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
npx vite-node scripts/verify-original-contracts.ts
npx vitest run scripts/export-original-contracts.test.mjs
node scripts/export-original-contracts.mjs --verified-only
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

## Remaining boundary

This is a **local, verified adapter migration**, not a live Stella release. It
does not publish a GitHub catalog artifact, add a hosted API, connect Stella's
browsing/import UI, or automatically collect missing business facts. It uses
the current source checkout; GitHub mirror freshness remains a separate concern.
Unsupported new syntax fails closed rather than receiving an inherited verified
label. The new document-layout profile is explicit and is not a claim of
pixel-identical legacy DOCX output.

The canonical sources and published template binaries are unchanged. Source
legal review, source-specific stability graduation, and suitability advice are
separate from renderer verification. NVCA and YC forms are not reclassified as
redistributable originals or copied into this profile.
