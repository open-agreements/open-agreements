## 1. Authoring: applicable confirm clauses + clean omission
- [x] 1.1 Relax the confirm/when mutual-exclusion in `canonical-source.mjs` (allow `condition`, still forbid `omitted_body`) and the zod `schema.mjs` superRefine
- [x] 1.2 Renderer `clauseParagraphs`: add a branch for `condition` WITHOUT `omitted_body` → wrap heading+body in `{IF condition}` … `{END-IF}` (fully absent)
- [x] 1.3 Renderer `clauseParagraphs`: when a `confirm` clause also has `condition`, wrap the heading + body + `{IF !confirm}` bracket in `{IF condition}` … `{END-IF}`
- [x] 1.4 Verify docx-templates renders the nested `{IF gate}…{IF !confirm}…{END-IF}…{END-IF}` correctly

## 2. Engine: derived field, cover notice, renumbering
- [x] 2.1 `fill-pipeline.ts` `prepareFillData`: derive `any_confirmation_pending` (OR over applicable + unconfirmed `confirm=` clauses); `engine.ts` threads the confirm-clause list (id/confirm/condition) from the compiled `.template.generated.json`
- [x] 2.2 `unified-pipeline.ts`: add `any_confirmation_pending` to `syntheticFieldKeys` so it's excluded from "fields used"
- [x] 2.3 Renderer: `confirmationNoticeParagraphs` inserted after the cover title, gated on `{IF any_confirmation_pending}`, with one bullet per confirm clause gated by nested `{IF <gate>}{IF !<confirm>}` (yellow; plain text, no literal CONFIRM token)
- [x] 2.4 `renumberClauseHeadings(docx)` post-fill pass over clause-heading-styled paragraphs (concatenated text, leading `^\d+\.` rewrite, idempotent); wire into the post-fill steps

## 3. Validation
- [x] 3.1 Confirm `{IF any_confirmation_pending}` is tolerated by `validateTemplate` (the conditional path has no unknown-field check; locked in by OA-TMP-073)

## 4. Florida content + single-source link
- [x] 4.1 Repoint `choice_act_advance_notice_confirmed.authority_url` → `https://openagreements.org/legal/non-compete/florida` in `metadata.yaml`; align the field description
- [x] 4.2 Remove `omitted="[Intentionally Omitted.]"` from all conditional FL clauses
- [x] 4.3 Add `when=covered_employee` to the `choice-act-counsel-notice` confirm clause
- [x] 4.4 Update the FL `README.md` narrative (clean omission + reference-card link)
- [x] 4.5 Regenerate `template.docx`, `.template.generated.json`, `data/templates-snapshot.json`

## 5. Docs + skill
- [x] 5.1 `docs/adding-templates.md`: reference-card convention; `when=` (no `omitted=`) → fully absent + renumbering; `confirm=` + `when=` applicability
- [x] 5.2 `skills/open-agreements/SKILL.md`: concise statutory-compliance-representation / confirm= note

## 6. Tests
- [x] 6.1 `OA-TMP-066`/`OA-TMP-067` clean-omission renderer tests
- [x] 6.2 `OA-TMP-068`/`OA-TMP-069` confirm=+when= applicability + confirm=+omitted= rejection
- [x] 6.3 `OA-TMP-070`/`OA-TMP-071` derived fields + cover notice (fill-level)
- [x] 6.4 `OA-TMP-072` renumber-no-gap + idempotence
- [x] 6.5 `OA-TMP-073` reserved derived tags pass placeholder validation
- [x] 6.6 Empirical fills (non-covered → no banner/no recital; covered unconfirmed → banner+bracket; confirmed → clean) + visual Word check

## 7. Gate
- [x] 7.1 `validate`, `test:run`, `lint`, `check:spec-coverage`, `check:docx-structure`, `check:readme`, `openspec validate --strict`
- [x] 7.2 `generate:template-previews`; apply `freshness/skip` if the shared-renderer gate fans out
