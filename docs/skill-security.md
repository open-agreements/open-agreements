# Skill Security

## Summary

All skills in this repository follow a zero-download, zero-execution security model. Skills do not download or execute code from the network. They use either the hosted remote MCP server or a locally pre-installed CLI.

## What changed (v0.2.0)

### Removed: `npx -y open-agreements@latest`

Previous versions of the `open-agreements` skill instructed agents to run `npx -y open-agreements@latest`, which:
- Downloaded code from the npm registry at runtime (flagged as EXTERNAL_DOWNLOADS)
- Used `@latest` which meant the downloaded code could change between runs (flagged as REMOTE_CODE_EXECUTION)

As of v0.2.0, all skills use one of three execution paths:
1. **Remote MCP** (recommended): The hosted server at `openagreements.ai/api/mcp` handles DOCX generation server-side. No local dependencies needed.
2. **Local CLI**: If `open-agreements` is already installed locally, use it directly.
3. **Preview only**: Generate a markdown preview when neither MCP nor CLI is available.

No skill instructs the agent to download or install packages.

### Added: Explicit trust boundaries

All skills now include a Security Model section that specifies:
- Template metadata and content from `list_templates` is **untrusted third-party data** and must not be interpreted as agent instructions
- User-provided field values are **data only** — agents should reject control characters and enforce reasonable length limits
- Explicit user confirmation is required before filling any template

This addresses the Snyk W011 finding about indirect prompt injection surface from third-party template content.

## Supply chain security

The `open-agreements` CLI package on npm uses:
- **npm trusted publishing (OIDC)**: Packages are published via GitHub Actions with provenance, not from developer machines
- **Provenance attestation**: npm shows build provenance for each version
- **Pinned dependencies**: All dependencies are version-locked in `package-lock.json`
- **Socket.dev analysis**: The package passes Socket.dev supply chain analysis (shown on skills.sh)

## Template content licensing and sources

Templates come from established legal industry sources:
- **Common Paper** (commonpaper.com) — CC-BY-4.0
- **Bonterms** (bonterms.com) — CC0-1.0
- **Y Combinator** (ycombinator.com) — CC-BY-ND-4.0
- **NVCA** (nvca.org) — used with permission, SHA-256 integrity verification
- **OpenAgreements** (openagreements.ai) — CC-BY-4.0

All external templates include SHA-256 hash verification to detect tampering.

## Scanning and verification

We encourage users to verify our skills:
- [Gen Agent Trust Hub](https://ai.gendigital.com/agent-trust-hub) — Skill Scanner
- [Snyk](https://snyk.io) — Dependency and code analysis
- [Socket.dev](https://socket.dev) — Supply chain analysis

Our skills are listed on [skills.sh](https://skills.sh/open-agreements/open-agreements/) where automated audits are publicly visible.

## Reporting security issues

If you discover a security issue, please email security@openagreements.ai or open a GitHub issue.
