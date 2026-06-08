# Change: Confirmation cover notice, clean clause omission, and applicable confirm clauses

## Why
The `statutory_compliance_representation` / `confirm=` mechanism (issue #408, PRs #412/#413)
renders an in-body yellow `[CONFIRM before signing: …]` bracket when a compliance fact is
unconfirmed. Three gaps surfaced in real use of the Florida restrictive-covenant template:

1. **No page-one signal.** A time-pressed drafter who reads only the Cover Terms can miss an
   in-body CONFIRM bracket buried in the Standard Terms and send the agreement out with an
   unverified statutory representation still bracketed. The open item must also be visible on
   page one.
2. **`[Intentionally Omitted.]` misleads.** Excluded conditional clauses currently render a
   numbered heading plus `[Intentionally Omitted.]` (chosen to preserve static numbering). For
   employment terms this *implies* a clause (garden leave, non-compete) was expected and
   invites the counterparty to negotiate for it. Excluded clauses should be fully absent, with
   the document renumbering cleanly.
3. **A confirm clause cannot be scoped.** `confirm=` and `when=` are mutually exclusive, so the
   Florida CHOICE Act counsel-notice recital (a `confirm=` clause) renders for *non*-covered
   employees too. Once clean omission removes its sibling covered-employee clauses, that leaves
   a lone "(Covered Employee)" recital plus a page-one notice on a non-covered agreement.

## What Changes
- **Applicable confirm clauses (authoring).** Allow `confirm=` to combine with `when=<field>`
  (still forbidding `confirm=` + `omitted=`). The confirm clause — body and its `{IF !<field>}`
  CONFIRM bracket — applies only when the `when=` gate is true and is fully absent otherwise.
- **Clean clause omission (authoring).** A `when=<field>` clause with NO `omitted=` renders
  fully absent (heading + body gated together, dropped when false); `when=<field> omitted="…"`
  retains today's placeholder behavior (back-compat).
- **Confirmation cover notice (engine).** When a template has ≥1 `confirm` clause, the cover
  page carries a yellow notice gated on a derived `any_confirmation_pending` boolean, listing
  each still-unconfirmed *applicable* item (a per-clause `<id>_confirm_pending` derived
  boolean). The notice is plain text (no literal `[CONFIRM before signing:`), so it cannot
  satisfy or spoof the in-body bracket validator.
- **Clause renumbering (engine).** After conditional resolution at fill time, clause headings
  are renumbered sequentially so fully-omitted clauses leave no numbering gap. Cross-references
  are name-based (`[[clause:<id>]]` resolves to heading text), so renumbering breaks none.
- **Reserved derived tags (validation).** `any_confirmation_pending` and `<id>_confirm_pending`
  are recognized control identifiers, not flagged as unknown DOCX placeholders.
- **Single-source link (Florida).** Repoint the `choice_act_advance_notice_confirmed`
  `authority_url` to the OpenAgreements reference card
  (`https://openagreements.org/legal/non-compete/florida`), which curates current primary-law
  links. Per #413 this is a one-place edit in `metadata.yaml`.

## Impact
- Affected specs: authoring, engine, validation
- Affected code: `scripts/template_renderer/canonical-source.mjs`,
  `scripts/template_renderer/schema.mjs`,
  `scripts/template_renderer/layouts/cover-standard-signature-v1.mjs`,
  `src/core/fill-pipeline.ts`, `src/core/unified-pipeline.ts`,
  `src/core/validation/template.ts`,
  `content/templates/openagreements-restrictive-covenant-florida/{template.md,metadata.yaml,README.md}`,
  `skills/open-agreements/SKILL.md`, `docs/adding-templates.md`
- Regenerated: the Florida `template.docx`, `.template.generated.json`, `data/templates-snapshot.json`
