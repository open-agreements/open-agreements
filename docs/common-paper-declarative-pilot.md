# Common Paper Mutual NDA — local compiler pilot, 2026-09-12

## Outcome

`src/core/selection-contract.ts` generates a data-only contract directly from the
existing metadata, DOCX bindings and `selections.json`. It includes 18 input fields,
16 source bindings, two radio groups and 12 signature display/blank-normalization
rules. There is no handwritten per-template contract or AI field-acceptance step.
The original Common Paper source documents and operative language were not edited.

This is a bounded `oa-radio-signature-pilot-v1` profile, not a universal conversion
claim. It supports default/equality radio alternatives and the existing
`party_1`/`party_2` entity-versus-individual signature convention. Inputs are typed
strings/dates/enums; existing metadata supplies defaults and field descriptions.
Missing priority fields retain the existing pipeline's warning/blank behavior.
Individual signers suppress entity-only title/company displays. Unlike the legacy
console-only warning, the pilot also returns ignored-value warnings to its caller.

## Verification

Run from this worktree:

```sh
node node_modules/vitest/vitest.mjs run src/core/selection-contract.test.ts --configLoader runner
node node_modules/typescript/bin/tsc --noEmit
node node_modules/eslint/bin/eslint.js src/core/selection-contract.ts src/core/selection-contract.test.ts
git diff --check
```

20 focused tests pass: compilation; all 16 combinations of fixed/terminated MNDA
term, fixed/perpetual confidentiality, and entity/individual for each party; blank
signature/default parity; invalid/tampered input rejection; and source drift,
missing-marker and unsupported-stage rejection. Every decompressed DOCX ZIP entry
matches the legacy engine for all 16 combinations plus the blank-signature case.
This includes the document XML and formatting/resources, not just extracted text.
ZIP container timestamps/compression are intentionally outside the comparison.
Independent assertions also check branch retention and company suppression.
TypeScript and focused lint pass. A Buffer/ArrayBuffer type mismatch found by the
first typecheck was corrected using an explicit ArrayBuffer copy.

Tests regenerate `.cache/common-paper-declarative/fill-contract.json` and 32
synthetic DOCX comparison files (ignored). Sample outputs opened with macOS `open`:

- `fixed-fixed-entity-entity.docx`: fixed terms, both company signatures.
- `terminated-perpetual-individual-individual.docx`: indefinite alternatives,
  individual signatures with title/company displays blank.

Review in Word: only the selected term alternatives remain; company/title data
appears only for entities; the cover-page tables and signature blocks retain their
layout. Opening was successful; no independent visual certification or PDF-export
test was performed. Source hashes and input-rejection behavior are test evidence,
not visually verifiable properties.

## Limits and next integration work

- No Stella UI/catalog changes, deployment, public PR or push. Existing source
  rights metadata is retained; only bundled CC0/CC-BY derivative-permitted sources
  are accepted. NVCA and no-derivatives profiles remain outside this pilot.
- The runtime still uses OpenAgreements' generic selection/fill pipeline and the
  original DOCX. This is a declarative adapter, **not a DOCX-free legal source** or
  a standalone portable Stella runtime. No arbitrary expression execution is added.
- Source hashes cover metadata, selections and DOCX. Runtime recompilation rejects
  changed sources/manifests. The compiler pins the reviewed legacy engine hash to
  force compatibility review after engine changes; that conservative pilot gate
  is not yet the long-term versioned profile/update protocol.
- More complex preprocessing, array/IF DOCX commands, other signature conventions,
  and extra source artifacts fail closed here. The profile does not replace or
  restore the earlier catalog-wide compiler's conditions/arrays implementation.
- Generated contracts say `compiled-unverified`; this case's test evidence does
  not promote every future source revision automatically. A catalog promotion gate
  and source-revision-specific verification record remain needed.

## Worktree recovery note

The previous `/private/tmp/oa-catalog-compiler-20260912` worktree was absent on
2026-09-12, while Git still registered it. Its uncommitted/untracked compiler
sources were not present in its branch. Historical test claims in the prior report
are historical evidence, not proof that those files remain available. Cause of
directory loss is unknown. The prevention is durable worktrees plus local Git
checkpoints, rather than relying on temporary uncommitted implementation files.
This focused successor lives at
`/Users/stevenobiajulu/Projects/oa-common-paper-declarative-20260912`, branch
`pilot/common-paper-declarative-20260912`, based on `7f96c6d5`.
