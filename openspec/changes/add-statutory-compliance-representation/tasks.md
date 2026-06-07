## 1. Schema & renderer
- [x] 1.1 Add `statutory_compliance_representation` + `authority_url` to `FieldDefinition` and the zod schema with shape rules (boolean, default 'false', http(s) authority_url, authority_url scoped to the category)
- [x] 1.2 Add `confirm`/`confirm_note`/`authority_url` to the contract-spec `textClauseSchema` with mutual-exclusivity against `condition`/`omitted_body`
- [x] 1.3 Parse the `confirm=` directive in `canonical-source.mjs` with a strict field-name parser (no `always` sentinel) and thread the fields through `projectToContractSpec`
- [x] 1.4 Render the highlighted `[CONFIRM …]` bracket gated on `{IF !<field>}` in the layout
- [x] 1.5 (#413 SSOT) Add `confirm_note` as a `metadata.yaml` field property scoped to the category (zod: required non-empty on SCR fields, absent otherwise)
- [x] 1.6 (#413 SSOT) Resolve `confirm=<field>`'s `confirm_note`/`authority_url` from metadata via a field lookup: `compileCanonicalSourceFile` reads the sibling `metadata.yaml` (shared `loadMetadataFromDir`) and threads `{ fieldLookup }` into `compileCanonicalSourceString`; hard-error when the directive restates them or the field is missing/not-SCR/lacks note-or-url

## 2. Validation
- [x] 2.1 Require each `statutory_compliance_representation` field to render as `{IF !<field>}` + `[CONFIRM before signing: …]` with a URL matching the metadata `authority_url`
- [x] 2.2 (#413 SSOT) Add a symmetric `confirm_note` equality check; reframe the equality checks as metadata-vs-committed-artifact integrity (not author drift)

## 3. Florida migration
- [x] 3.1 Migrate `choice_act_advance_notice_confirmed` + `choice-act-counsel-notice` onto the mechanism (clause id unchanged); update the field description warning
- [x] 3.2 Regenerate `template.docx` + `.template.generated.json`; add the byte-identical preview-freshness manifest entry
- [x] 3.3 (#413 SSOT) Shrink the directive to `confirm=<field>`; move `confirm_note` onto the metadata field; regenerate (output byte-identical)

## 4. Tests
- [x] 4.1 `OA-TMP-061`/`OA-TMP-062` renderer confirm directive tests
- [x] 4.2 `OA-TMP-063` metadata field shape tests
- [x] 4.3 `OA-TMP-064` validator bracket + authority_url drift tests
- [x] 4.4 (#413 SSOT) `OA-TMP-065` `compileCanonicalSourceFile` sibling-metadata resolution + special-chars note; `OA-TMP-062` restate/missing-field/not-SCR/missing-note-or-url errors; `OA-TMP-063` `confirm_note` scoping; `OA-TMP-064` `confirm_note` drift

## 5. Docs
- [x] 5.1 Document the field category in `docs/adding-templates.md`
- [x] 5.2 (#413 SSOT) Document the single-source-of-truth rule (metadata.yaml = field metadata, template.md = clause prose) and the `confirm=<field>` directive shape in `docs/adding-templates.md`
