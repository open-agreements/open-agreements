## 1. Schema & renderer
- [x] 1.1 Add `statutory_compliance_representation` + `authority_url` to `FieldDefinition` and the zod schema with shape rules (boolean, default 'false', http(s) authority_url, authority_url scoped to the category)
- [x] 1.2 Add `confirm`/`confirm_note`/`authority_url` to the contract-spec `textClauseSchema` with mutual-exclusivity against `condition`/`omitted_body`
- [x] 1.3 Parse the `confirm=` directive in `canonical-source.mjs` with a strict field-name parser (no `always` sentinel) and thread the fields through `projectToContractSpec`
- [x] 1.4 Render the highlighted `[CONFIRM …]` bracket gated on `{IF !<field>}` in the layout

## 2. Validation
- [x] 2.1 Require each `statutory_compliance_representation` field to render as `{IF !<field>}` + `[CONFIRM before signing: …]` with a URL matching the metadata `authority_url`

## 3. Florida migration
- [x] 3.1 Migrate `choice_act_advance_notice_confirmed` + `choice-act-counsel-notice` onto the mechanism (clause id unchanged); update the field description warning
- [x] 3.2 Regenerate `template.docx` + `.template.generated.json`; add the byte-identical preview-freshness manifest entry

## 4. Tests
- [x] 4.1 `OA-TMP-061`/`OA-TMP-062` renderer confirm directive tests
- [x] 4.2 `OA-TMP-063` metadata field shape tests
- [x] 4.3 `OA-TMP-064` validator bracket + authority_url drift tests

## 5. Docs
- [x] 5.1 Document the field category in `docs/adding-templates.md`
