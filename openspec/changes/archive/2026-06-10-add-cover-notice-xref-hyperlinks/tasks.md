# Tasks — Cover-notice cross-reference + hyperlinks

## 1. Renderer (authoring)
- [x] 1.1 Wrap each `confirm=` clause heading in an `oa_xref_<hash>` bookmark
      (`clauseBookmarkName`, `clauseHeadingParagraph`).
- [x] 1.2 Rebuild the cover bullet as `• <Section N internal-link> — <heading> — for more details
      see <external-link>`, emitting the `<<xref:<bookmark>>>` sentinel and an `ExternalHyperlink`
      for the URL; keep the per-bullet `{IF <gate>}{IF !<confirm>}` gating and the no-`[CONFIRM
      before signing:` constraint (locked in by OA-TMP-075).

## 2. Engine (post-fill)
- [x] 2.1 In `renumberClauseHeadings`, map each heading's `oa_xref_*` bookmark to its resolved
      number and rewrite `<<xref:…>>` sentinels to the live "Section N" (OA-TMP-074).
- [x] 2.2 `humanizeDocx` renders any stray sentinel as `Section [#]` for the unfilled catalog
      preview (defense-in-depth).

## 3. Validation / no regression
- [x] 3.1 The `<<xref:…>>` sentinel is not flagged as an unknown placeholder; `validateTemplate` on
      Florida stays clean (OA-TMP-075).
- [x] 3.2 `checkStatutoryComplianceReps` and `any_confirmation_pending` gating unchanged (in-body
      bracket stays plain text).

## 4. Artifacts
- [x] 4.1 Regenerate the Florida `template.docx` (only template with confirm clauses); snapshot and
      preview PNGs unchanged (the conditional bullet is dropped from the unfilled preview).

## 5. Tests
- [x] 5.1 `OA-TMP-074` post-fill sentinel → "Section N", and number tracks renumbering when an
      earlier clause is omitted (`integration-tests/fill-pipeline.test.ts`).
- [x] 5.2 `OA-TMP-074` end-to-end on the Florida fill: bullet "Section N" matches the renumbered
      heading; internal `w:anchor` hyperlink + external hyperlink relationship present.
- [x] 5.3 `OA-TMP-075` unfilled Florida template emits the heading bookmark, escaped sentinel, and
      external hyperlink; sentinel does not trip unknown-placeholder validation
      (`integration-tests/template-validation.test.ts`).
