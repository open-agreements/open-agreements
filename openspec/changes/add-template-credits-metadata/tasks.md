## 1. Schema

- [x] 1.1 Add `TemplateCreditRoleEnum` (`drafter` | `drafting_editor` | `reviewer` | `maintainer`) in `src/core/metadata.ts`.
- [x] 1.2 Add `TemplateCreditSchema` (`name`, `role`, optional `profile_url`) as a module-local Zod schema.
- [x] 1.3 Extend `TemplateMetadataBaseSchema` with `credits: z.array(TemplateCreditSchema).default([])` and `derived_from: z.string().optional()`.
- [x] 1.4 Confirm `ExternalMetadataSchema` inherits both fields via its existing `.extend(...)` call; no code change needed but verify by inspection.

## 2. CLI JSON projection

- [x] 2.1 In `src/commands/list.ts::runListJson`, add `credits: meta.credits ?? []` and `derived_from: meta.derived_from` to the internal-template block.
- [x] 2.2 Add the same two fields to the external-template block.
- [x] 2.3 Leave the recipe branch and the human-readable `listAgreementsWithOptions` branch unchanged.

## 3. Template metadata YAML population

- [x] 3.1 Append `credits` (Joey Tsang, `drafting_editor`, LinkedIn profile) and `derived_from` to `content/templates/openagreements-board-consent-safe/metadata.yaml`.
- [x] 3.2 Append the analogous block to `content/templates/openagreements-stockholder-consent-safe/metadata.yaml`.

## 4. Snapshot regeneration

- [x] 4.1 Run `node scripts/export-templates-snapshot.mjs` to regenerate `data/templates-snapshot.json`.
- [x] 4.2 Run `node scripts/export-templates-snapshot.mjs --check` and verify it exits 0.
- [x] 4.3 Spot-check: both SAFE entries carry populated `credits` + `derived_from`; all other internal and external entries carry `credits: []` and no `derived_from`; recipes unaffected.

## 5. Documentation and policy

- [x] 5.1 Extend `docs/adding-templates.md` YAML example with optional `credits` / `derived_from` blocks and roles comment.
- [x] 5.2 Add `### Template credits` subsection to `CONTRIBUTING.md` under `## Ways to Contribute`, after `### Add a Template` (material contribution + consent + honest role labels; no pen-holder line, no merge-not-credit bullet).

## 6. Tests

- [x] 6.1 Add contract assertions in `src/core/metadata.test.ts`: valid credits parse; invalid role rejected; missing credits defaults to `[]`; `derived_from` optional string.
- [x] 6.2 Update `integration-tests/list-command.inprocess.test.ts` local `TemplateMeta` harness type to include the new fields.
- [x] 6.3 Extend projection assertions there: SAFE templates have populated `credits` + `derived_from`; at least one other internal template has `credits: []` and no `derived_from`.

## 7. Verification

- [x] 7.1 `npm run build`, `npm run lint`, `node bin/open-agreements.js validate`, `npm run test:run` all pass. (Pre-existing `packages/signing/tests/gcloud-storage.test.ts` failures are environment-related, unrelated to this change.)
- [x] 7.2 SAFE integration tests still pass (`contract-ir-board-consent`, `contract-ir-stockholder-consent`, `consent-variable-signer-rendering`).
- [x] 7.3 Snapshot freshness check (`--check`) exits 0 after regeneration.
