# Change: Add Agreement Signing Integration

## Why

After open-agreements fills a legal template and produces a professional DOCX, there is no way to send it for electronic signature without leaving the AI conversation. The user has to manually download the DOCX, upload it to DocuSign, configure recipients, place signature tabs, and send. This "last mile" gap means the AI-assisted contract drafting workflow stops at document generation.

We want the flow to be: user talks to Claude → AI fills the template → user clicks one link to review and send for signature. The user authenticates with their own DocuSign account (we don't bear the cost).

## What Changes

- **NEW**: `packages/signing/` — workspace package with provider-neutral signing adapter interface
- **NEW**: DocuSign adapter implementing OAuth 2.0 (PKCE), envelope creation, embedded sender view, webhook ingestion, and signed PDF retrieval
- **NEW**: Per-template `signing.yaml` defining signer roles, signature `{tag}` fields, and provider-specific anchor strings
- **NEW**: Signature `{tag}` placeholders in DOCX templates (e.g., `{sig_party_1}`) filled by the signing adapter during the fill step — same mechanism as business field tags
- **NEW**: MCP tools: `connect_signing_provider`, `disconnect_signing_provider`, `upload_signing_document`, `send_for_signature`, `check_signature_status`, `get_signed_document`
- **NEW**: Google Cloud Firestore for encrypted OAuth token storage and audit logging
- **NEW**: Google Cloud Storage for filled DOCX and signed PDF artifact storage
- **NEW**: Webhook endpoint for DocuSign Connect status events with HMAC-SHA256 verification
- **MODIFIED**: Fill pipeline reads `signing.yaml` and populates signature tags with provider-specific anchors during fill
- **PRESERVED**: Core fill pipeline works without signing infrastructure — hard package boundary

## Impact

- Affected specs: new `agreement-signing` capability
- Affected code:
  - New: `packages/signing/` (adapter interface + DocuSign implementation)
  - New: `api/auth/docusign/` (OAuth routes)
  - New: `api/signing/webhook.ts` (webhook endpoint)
  - New: `content/templates/*/signing.yaml` (per-template signing config)
  - Modified: `content/templates/*/template.docx` (add `{sig_*}` tags)
  - Modified: `src/core/fill-pipeline.ts` (read signing.yaml, fill sig tags)
  - Modified: `packages/contract-templates-mcp/` (new signing tools)
  - Modified: `scripts/validate_openspec_coverage.mjs` (allow `.skip()` as covered)
- No changes to: core validation, metadata schemas, CLI commands, existing MCP tools

## Key Design Decisions

### Decision 1: Signature tags use the same `{tag}` mechanism as business fields
Signature fields like `{sig_party_1}` are placed in the DOCX template alongside business fields like `{party_1_name}`. At fill time, docx-templates replaces all tags in one pass — business fields with AI-provided values, signature fields with provider-specific anchor strings. No separate placement strategy or invisible sentinel text needed.

### Decision 2: User authenticates with their own signing provider account
OAuth 2.0 Authorization Code Grant with PKCE. We never store user passwords. Refresh tokens are AES-256 encrypted in Firestore. User identity is keyed by an `open_agreements_api_key` in their MCP config.

### Decision 3: Default to draft envelope, never auto-send
`send_for_signature` always creates a draft and returns a DocuSign sender-view URL. The user reviews recipients, tabs, and cover email in DocuSign before sending. Immediate send is only available as an explicit override.

### Decision 4: Provider-neutral adapter with DocuSign first
The `SigningProvider` interface supports `connect`, `createDraft`, `send`, `getStatus`, `fetchArtifact`, `disconnect`. The DocuSign adapter is the first implementation. Anchor tag formats for Dropbox Sign, Adobe Sign, and PandaDoc are documented in `signing.yaml` but no adapters are built yet.

### Decision 5: Webhooks as primary status mechanism
DocuSign Connect per-envelope webhooks (`eventNotification`) are registered at envelope creation. Status changes are stored locally. Polling is fallback only.
