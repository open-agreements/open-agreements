## 1. Vendoring (Decision Gate)
- [ ] 1.1 Choose vendoring strategy (copy)
- [ ] 1.2 Copy `junior-AI-email-bot/packages/docx-comparison` → `open-agreements/packages/docx-comparison`
- [ ] 1.3 Preserve upstream license notices in `packages/docx-comparison/` (MIT)
- [ ] 1.4 Add `VENDORED_FROM.md` with upstream repo URL + commit SHA + notes on local modifications

## 1.5 Prune Vendored Copy (Required Before Initial Commit)
- [ ] 1.5.1 Delete `packages/docx-comparison/allure-results/`
- [ ] 1.5.2 Delete `packages/docx-comparison/allure-report/`
- [ ] 1.5.3 Delete `packages/docx-comparison/debug-output/`
- [ ] 1.5.4 Delete package-root `packages/docx-comparison/debug-*.mjs` scripts (14 files)
- [ ] 1.5.5 Delete `packages/docx-comparison/run-ilpa-comparison.mjs` and `packages/docx-comparison/ILPA-comparison-result.docx`
- [ ] 1.5.6 Delete `packages/docx-comparison/test/outputs/`
- [ ] 1.5.7 Delete `packages/docx-comparison/node_modules/`
- [ ] 1.5.8 Delete `packages/docx-comparison/dist/` (must be rebuilt)
- [ ] 1.5.9 Delete `packages/docx-comparison/.git/` if present

## 2. Slim To Pure TypeScript Only
- [ ] 2.1 Remove `packages/docx-comparison/src/baselines/wmlcomparer/` (DotnetCli + DocxodusWasm)
- [ ] 2.2 Remove or gate the `wmlcomparer` branch in the public engine union types (`packages/docx-comparison/src/index.ts`, `packages/docx-comparison/src/core-types.ts`)
- [ ] 2.3 Ensure no runtime imports reference removed baselines
- [ ] 2.4 Confirm `compareDocuments(..., { engine: 'atomizer' | 'diffmatch' })` works end-to-end

## 3. Package It For Distribution
- [ ] 3.1 Keep comparer as an independently publishable package under `packages/docx-comparison/` (no npm workspaces in v1)
- [ ] 3.2 Set comparer `package.json` name to `@open-agreements/docx-comparison` and verify `exports`, `main`, `types` point to `dist/`
- [ ] 3.3 Add `prepack`/`prepublishOnly` script to build the comparer (`tsc`) before publishing
- [ ] 3.4 Ensure comparer uses a `files` allowlist so npm tarball only includes `dist/` (and required metadata)
- [ ] 3.5 Verify phantom dependencies do not leak: OpenAgreements MUST NOT import `jszip`, `fast-xml-parser`, or `diff-match-patch` without declaring them

## 4. OpenAgreements Integration Wrapper
- [ ] 4.1 Add `src/redline/redlineAgainstForm.ts` adapter that calls comparer `compareDocuments(form, agreement, { engine: 'atomizer', author })`
- [ ] 4.2 Export `redlineAgainstForm` from `src/index.ts`

## 5. CLI (Non-Breaking Addition)
- [ ] 5.1 Add `src/commands/redline.ts`
- [ ] 5.2 Register `redline` in `src/cli/index.ts`
- [ ] 5.3 Implement defaults: `--out` defaults to `<agreement>.redlined.docx`; `--author` defaults to `OpenAgreements`
- [ ] 5.4 Validate UX: clear errors for missing paths; exit code 1 on error

## 6. Tests + Fixtures
- [ ] 6.1 Add fixtures: `no-change`, `simple-replacement`, `clause-deleted-or-moved`
- [ ] 6.2 Unit test: output contains track-changes markup (`w:ins` / `w:del`) when expected
- [ ] 6.3 Unit test: invalid inputs throw `InvalidDocxError` (empty buffer, non-DOCX buffer, corrupt DOCX)
- [ ] 6.4 Integration test: run `redlineAgainstForm` on fixtures and verify output is semantically correct (no byte-equality assertions)

## 6.5 CI Pipeline Changes
- [ ] 6.5.1 Update `.github/workflows/validate.yml` to run `npm test` for OpenAgreements
- [ ] 6.5.2 Add a workflow step to run comparer tests (at minimum `npm --prefix packages/docx-comparison test`)
- [ ] 6.5.3 Ensure the workflow builds OpenAgreements and the comparer (or verifies both are buildable)
- [ ] 6.5.4 Document manual publish sequence in `packages/docx-comparison/README.md` or a `PUBLISHING.md`

## 7. Publish
- [ ] 7.1 Publish `@open-agreements/docx-comparison` (public)
- [ ] 7.2 After publishing comparer: update `open-agreements/package.json` to depend on `@open-agreements/docx-comparison@^0.1.0` (registry version), ensure it is not `workspace:*` or `file:`
- [ ] 7.3 Publish OpenAgreements (root package) after dependency points to the registry
- [ ] 7.4 Smoke test: in a clean temp directory, `npx -y open-agreements@<version> redline --form … --agreement …` works

## 8. Verification
- [ ] 8.1 `npm test` passes
- [ ] 8.2 `npm run build` passes
- [ ] 8.3 `openspec validate add-docx-comparison-redline --strict` passes
