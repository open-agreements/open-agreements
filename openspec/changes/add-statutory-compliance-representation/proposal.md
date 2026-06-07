# Change: Statutory compliance representation mechanism

## Why
Some agreement clauses recite, in the past tense, a real-world compliance fact that
must be true for the covenant to be enforceable (e.g. Florida's 2025 CHOICE Act
recital that the employer "advised the employee, in writing, of the right to seek
counsel" and "provided ≥7 days' notice", Fla. Stat. § 542.45). If a filling LLM/user
asserts that without confirming it actually happened, the document makes a false legal
representation — worse than omitting it. The Florida template shipped an interim safe
default (PR #407) that silently omitted the recital when unconfirmed; issue #408 decided
on a reusable mechanism that keeps the open item **visible** instead of dropping it.

## What Changes
- Add a narrow metadata field category `statutory_compliance_representation: true`
  (with a required `authority_url` and `confirm_note`) marking a boolean field whose
  `true` value asserts a statutory precondition to enforceability. Deliberately NOT a
  general `compliance_representation` category — reserved for the few reps that gate
  enforceability so ordinary reps are not forced through per-rep confirmation.
- Add a renderer `confirm=<field>` clause directive (distinct from `when=`): the clause
  body always renders, and when `<field>` is false the layout appends a
  yellow-highlighted `[CONFIRM before signing: <note>; see <authority_url>]` bracket
  (never a silent omit, never future-tense). When `<field>` is true the clause renders
  clean. Per issue #413, `metadata.yaml` is the single source of truth: the directive
  names only the field, and the canonical compiler resolves `confirm_note`/`authority_url`
  from that field's `metadata.yaml` entry (reading the sibling metadata). Restating either
  in the directive is a compile error.
- Strengthen the template validator: a `statutory_compliance_representation` field MUST
  be boolean, default `'false'`, declare an http(s) `authority_url` and a non-empty
  `confirm_note`, and be rendered as a `{IF !<field>}` + `[CONFIRM before signing: …]`
  bracket whose URL and note match the field's `authority_url`/`confirm_note`. Because
  these now have one authoring source, the equality check guards the committed rendered
  artifact (a stale, un-regenerated `template.docx`) and hand-authored JSON templates
  rather than two hand-edited files.
- The `get_template` confirmation warning rides in the field's own `description`
  (no separate `requiresConfirmation` array — everything a user fills requires
  confirmation, so a dedicated array would wrongly imply the others do not). The
  description already passes through `get_template` unchanged, so no MCP code change.
- Migrate the Florida restrictive-covenant template's interim
  `choice_act_advance_notice_confirmed` field + `choice-act-counsel-notice` clause onto
  the mechanism. Clause id is unchanged (legal-context overlay deeplink stays stable).

Explicitly rejected (per #408): future-tense fallback, `fill_template` soft-block,
compliance-checklist appendix, printed attestation fields, severable rider, two-variant
output.

## Impact
- Affected specs: authoring, validation
- Affected code: `scripts/template_renderer/canonical-source.mjs`,
  `scripts/template_renderer/schema.mjs`,
  `scripts/template_renderer/layouts/cover-standard-signature-v1.mjs`,
  `scripts/lib/template-utils.mjs` (shared `loadMetadataFromDir`),
  `src/core/metadata.ts`, `src/core/validation/template.ts`,
  `content/templates/openagreements-restrictive-covenant-florida/{template.md,metadata.yaml}`
