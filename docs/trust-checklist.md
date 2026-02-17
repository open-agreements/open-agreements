# Trust Checklist

This checklist tracks Sprint 1 trust-boundary messaging only.

Out of scope for this checklist:

- conformance harness
- cross-app compatibility matrix (Word/LibreOffice/GDocs/Pages)
- release runbooks
- broader security implementation sprints
- redline MCP transport/auth hardening in the sister repo (`../junior-AI-email-bot`)

## Quick Decision

- If your document is sensitive, use fully local package execution (`npx`, global install, or local stdio MCP package from this repo).
- If you prioritize convenience, use the hosted remote MCP connector (`https://openagreements.ai/api/mcp`).
- No single mode is globally recommended; choose based on document sensitivity and internal policy.

## Data-Flow Modes (Trust Boundary Artifact)

| Mode | Where processing runs | What leaves device | Logging/retention surface | Recommended use cases | Not recommended use cases |
| --- | --- | --- | --- | --- | --- |
| Hosted remote MCP connector (`https://openagreements.ai/api/mcp`) | Hosted service endpoint on `openagreements.ai` | Agreement request/response content sent to the hosted endpoint as part of connector use | Hosted service and client/provider logs outside this repo's local execution path; verify policy before sensitive use | Quick evaluation, first-time setup, convenience in Claude | High-sensitivity documents when policy requires local-only processing |
| Fully local package execution (`open-agreements`, `@open-agreements/contracts-workspace-mcp`) | User-controlled machine/process | Agreement filling runs locally; no hosted connector hop. Normal package/source downloads you initiate (for example `npx` install or recipe source fetch) still use their own network paths | Local machine artifacts and any local tooling/shell logs configured by the user | Sensitive workflows, internal review paths that require local processing control | Teams that prioritize fastest hosted setup over local runtime control |

## Cross-Repo Scope

- This repo owns trust messaging for the OpenAgreements template connector (`api/mcp.ts`) and local package execution modes.
- Redline MCP transport hardening belongs to `../junior-AI-email-bot` (fail-closed OAuth startup in beta/production, approved host allowlist, explicit OAuth discovery/probe responses).

## Cross-Repo Status

| ID | Status | Requirement | Evidence paths |
| --- | --- | --- | --- |
| XREP-01 | Documented | Trust ownership between OpenAgreements template connector and Junior redline MCP is explicit | `docs/trust-checklist.md`; `api/mcp.ts`; `../junior-AI-email-bot/docs/mcp-redline-workflow.md`; `../junior-AI-email-bot/docs/safe-docx/trust-checklist.md` |

## Sprint 1 Status

| ID | Status | Requirement | Evidence paths |
| --- | --- | --- | --- |
| BND-01 | Complete | Local vs hosted modes are unambiguous | `README.md`; `site/index.html`; `docs/trust-checklist.md` |
| BND-02 | Complete | Local-only claims are scoped and non-contradictory | `README.md`; `site/index.html`; `docs/trust-checklist.md` |
| BND-03 | Complete | Reviewer can answer "where does data go?" in under 60 seconds | `docs/trust-checklist.md`; `site/index.html`; `README.md` |
