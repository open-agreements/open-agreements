## 1. New Local Drafting MCP Package
- [x] 1.1 Add `@open-agreements/contract-templates-mcp` package scaffold (bin, TS config, exports, README).
- [x] 1.2 Implement stdio JSON-RPC server (`initialize`, `tools/list`, `tools/call`, `ping`).
- [x] 1.3 Implement tools: `list_templates`, `get_template`, `fill_template`.
- [x] 1.4 Add package tests for tool contracts and error handling.

## 2. Gemini Extension Contract
- [x] 2.1 Update `gemini-extension.json` with strict required fields.
- [x] 2.2 Configure two local MCP server entries with no `cwd` override.
- [x] 2.3 Add automated manifest contract validation script and CI job.

## 3. Release and Runtime Hardening
- [x] 3.1 Upgrade release workflow to Node 22 + npm 11.5.1 trusted publishing compatibility.
- [x] 3.2 Convert release to multi-package publish suite with duplicate-version guards.
- [x] 3.3 Add isolated package-runtime smoke script.
- [x] 3.4 Run isolated runtime smoke in CI and release preflight.

## 4. Docs and Versioning
- [x] 4.1 Bump publishable package/manifests to `0.2.0`.
- [x] 4.2 Update README with local template MCP package usage.
- [x] 4.3 Document required manual local Gemini extension gate in release/changelog process docs.
