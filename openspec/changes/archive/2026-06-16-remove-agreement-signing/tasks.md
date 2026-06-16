# Tasks: Remove the agreement-signing capability

## 1. OpenSpec governance
- [ ] 1.1 Author REMOVED deltas for `signing` and `provider-docusign` capabilities
- [ ] 1.2 Retire the never-archived `add-agreement-signing` change (delete its directory)
- [ ] 1.3 Reconcile `restructure-specs-modular`: delete its `specs/signing/` + `specs/provider-docusign/` deltas; drop `signing`/`provider-docusign` from `proposal.md` (12 → 10 capabilities) and tasks 2.6/2.7
- [ ] 1.4 `openspec archive remove-agreement-signing --yes` to apply the baseline spec removal
- [ ] 1.5 `openspec validate --all --strict` green

## 2. Spec-coverage chain
- [ ] 2.1 Remove `OA-SIG-000` / `OA-DSG-000` stub tests + the `Agreement Signing` epic from `integration-tests/modular-spec-stubs.test.ts`
- [ ] 2.2 Remove the `Agreement Signing` epic label union member from `integration-tests/helpers/allure-test.ts`
- [ ] 2.3 Remove the `signing` + `provider-docusign` sections from `integration-tests/OPENSPEC_TRACEABILITY.md`
- [ ] 2.4 Remove `SIG` / `DSG` namespaces + `OA-SIG-000` / `OA-DSG-000` entries from `openspec/id-mapping.json`
- [ ] 2.5 `npm run check:spec-coverage` green

## 3. Code + content
- [ ] 3.1 Delete `packages/signing/` and remove it from root `package.json` `workspaces`; update `package-lock.json`
- [ ] 3.2 Delete `src/core/signing-config.ts`
- [ ] 3.3 `src/core/engine.ts` + `src/core/fill-pipeline.ts`: remove the `signing.yaml` load and `{sig_*}` anchor-default injection (the only `signing-config` consumers)
- [ ] 3.4 Delete `content/templates/bonterms-mutual-nda/signing.yaml`
- [ ] 3.5 Remove the invisible `{sig_party_1}` / `{sig_party_2}` tags from `content/templates/bonterms-mutual-nda/template.docx`
- [ ] 3.6 `scripts/bump_version.mjs`: drop `packages/signing/package.json` from `VERSION_FILES`

## 4. Docs
- [ ] 4.1 Scrub the two signing MCP tools + DocuSign mentions from `README.md`, `README.template.md`, `README.{de,es,pt-br,zh}.md`, `skills/agreements/open-agreements/SKILL.md`, `site/trust/system-card.md`

## 5. Verification
- [ ] 5.1 `npm test` (vitest) green
- [ ] 5.2 `open-agreements validate` green
- [ ] 5.3 Bonterms end-to-end fill produces a DOCX with zero `{sig_` leftover tokens
