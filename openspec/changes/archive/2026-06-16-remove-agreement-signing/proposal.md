# Change: Remove the agreement-signing capability (DocuSign signing feature)

## Why

The DocuSign electronic-signature feature was a premature, commercial "last-mile" bet that does not fit OpenAgreements' positioning as a neutral, trust-first, free reference corpus. It carried an OAuth authorization server, encrypted token storage (Firestore), artifact storage (GCS), webhook ingestion, and two MCP tools (`send_for_signature`, `check_signature_status`) — a large, security-sensitive surface for a feature that was never adopted.

The companion deploy repo (`openagreements-org-deploy`) has already removed the live MCP signing tools and the OAuth server (PR #7), so the production `openagreements.org/api/mcp` server now advertises only the four free tools. This change removes the corresponding capability, package, core plumbing, and specs from the monorepo so the two repos match and no orphaned signing code remains.

The detailed signing requirements were never archived into the baseline specs — they lived in the still-active `add-agreement-signing` change, with `signing` and `provider-docusign` left as reserved capability stubs. This change retires that proposal and removes the stubs.

## What Changes

- **REMOVED** capability `signing` (the reserved stub).
- **REMOVED** capability `provider-docusign` (the reserved stub).
- **RETIRED** the never-archived `add-agreement-signing` change proposal (the detailed signing requirements are abandoned, not rebased).
- **RECONCILED** the completed-but-unarchived `restructure-specs-modular` change so it no longer re-introduces `signing` / `provider-docusign` (its two reserved-stub spec deltas and the proposal/tasks line items that created them are dropped).
- **PRESERVED**: all other capabilities (`engine`, `recipes`, `cli`, `mcp-contract-templates`, `closing-checklist`, `distribution`, `authoring`, `validation`, `ip-license`, `quality-gates`, `mcp-contracts-workspace`) are untouched. The core fill pipeline keeps working for every template.

## Impact

- **Affected specs:** `signing` (removed), `provider-docusign` (removed). `restructure-specs-modular` change reconciled to match.
- **Affected code:**
  - Deletes: `packages/signing/` (workspace package: adapter interface, DocuSign implementation, OAuth/storage, tests); `src/core/signing-config.ts`; `content/templates/bonterms-mutual-nda/signing.yaml`.
  - Modifies: `src/core/engine.ts` and `src/core/fill-pipeline.ts` (drop the `signing.yaml` load + `{sig_*}` anchor-default injection — the only consumers of `signing-config`); `content/templates/bonterms-mutual-nda/template.docx` (remove the invisible `{sig_party_1}` / `{sig_party_2}` anchor tags so fills don't orphan them); root `package.json` `workspaces` (drop `packages/signing`) + `package-lock.json`; `scripts/bump_version.mjs` (drop `packages/signing/package.json`); `integration-tests/modular-spec-stubs.test.ts` + `integration-tests/helpers/allure-test.ts` (drop the `Agreement Signing` epic + `OA-SIG-000` / `OA-DSG-000` stub tests); `integration-tests/OPENSPEC_TRACEABILITY.md` and `openspec/id-mapping.json` (drop the `signing` / `provider-docusign` rows + `SIG` / `DSG` namespaces); `README.md` + localized READMEs + `README.template.md`, `skills/agreements/open-agreements/SKILL.md`, `site/trust/system-card.md` (scrub the two signing MCP tools + DocuSign mentions).
  - Keeps: `js-yaml` (still used by core/scripts/tests); all other packages and content.
- **CI:** `openspec validate --all --strict`, `npm run check:spec-coverage`, `open-agreements validate`, and the full vitest suite must stay green. A bonterms-mutual-nda end-to-end fill must produce a DOCX with no leftover `{sig_` tokens.

## Key Decisions

### Decision 1: Remove core signing plumbing too, not just the package
`src/core/signing-config.ts` and the `engine.ts` `{sig_*}` anchor injection are the only remaining consumers of the signing model. Leaving them as dormant code with no governing spec would be inconsistent. Since only `bonterms-mutual-nda` carried a `signing.yaml` + `{sig_*}` tags, removing the plumbing affects exactly one template, and its DOCX tags are removed in the same change.

### Decision 2: Retire `add-agreement-signing` rather than archive it
The proposal was never implemented into baseline specs (the requirements lived only in the change package as reserved stubs). It is abandoned, so its change directory is deleted rather than archived as a delivered capability.
