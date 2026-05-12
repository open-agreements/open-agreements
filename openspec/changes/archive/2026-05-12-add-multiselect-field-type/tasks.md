## 1. OpenSpec

- [x] 1.1 Add `proposal.md`, `tasks.md`, and `specs/open-agreements/spec.md`
      for `add-multiselect-field-type`
- [x] 1.2 Validate the change with
      `npx openspec validate add-multiselect-field-type --strict`

## 2. Metadata schema

- [x] 2.1 Add `multiselect` to `FieldTypeEnum`
- [x] 2.2 Add `derive_booleans?: boolean` to `FieldDefinition` and the
      Zod schema
- [x] 2.3 Enforce multiselect-specific `options`, identifier, uniqueness,
      `derive_booleans`, and `default` validation rules
- [x] 2.4 Reject derived `<option>_enabled` key collisions across
      template, external-template, and recipe metadata schemas

## 3. Fill pipeline

- [x] 3.1 Initialize omitted multiselect fields from parsed JSON defaults
      or `[]`
- [x] 3.2 Normalize multiselect runtime input and derive
      `<option>_enabled` booleans before priority checks and boolean
      coercion
- [x] 3.3 Treat empty priority arrays and empty priority multiselects as
      unfilled

## 4. Validation and reporting

- [x] 4.1 Skip missing-placeholder warnings for `derive_booleans`
      multiselects ONLY when at least one derived `<option>_enabled` key
      is actually referenced in the template; otherwise warn/error
      normally so genuinely-unused multiselects still surface
- [x] 4.2 Reject direct `{IF <multiselect_field>}` references
- [x] 4.3 Filter synthetic derived keys out of `fieldsUsed`
- [x] 4.4 Reject multiselect runtime input with non-string entries or
      unknown options (closed-allowlist enforcement)

## 5. CLI and downstream typing

- [x] 5.1 Widen fill/recipe value types from `Record<string, string>` (or
      `string | boolean`) to `Record<string, unknown>` across the D3a call
      chain
- [x] 5.2 Preserve existing CLI/list wire shape aside from the new
      `type: "multiselect"` enum value

## 6. Docs and tests

- [x] 6.1 Document multiselect authoring and derived boolean usage in
      `docs/adding-templates.md`
- [x] 6.2 Add schema tests in `src/core/metadata.test.ts`
- [x] 6.3 Add fill-pipeline multiselect tests in
      `integration-tests/fill-pipeline.test.ts`
- [x] 6.4 Add validator multiselect tests in
      `integration-tests/template-validation.test.ts`

## 7. Verification

- [x] 7.1 `npm run build`
- [x] 7.2 `npx vitest run src/core/metadata.test.ts integration-tests/fill-pipeline.test.ts integration-tests/template-validation.test.ts`
- [x] 7.3 `npm run test:run`
- [x] 7.4 `npm run lint`
- [x] 7.5 `npx openspec validate add-multiselect-field-type --strict`
- [x] 7.6 `node scripts/export-templates-snapshot.mjs --check`
- [x] 7.7 `node bin/open-agreements.js validate openagreements-restrictive-covenant-wyoming`
