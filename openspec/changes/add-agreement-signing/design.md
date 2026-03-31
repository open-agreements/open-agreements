# Design: Agreement Signing Integration

## Context

OpenAgreements fills legal templates and produces professional DOCX files. The user currently has to manually upload to a signing provider (DocuSign, Dropbox Sign, etc.) to get the agreement signed. This integration closes that gap within the AI conversation.

### Stakeholders
- **End users**: Lawyers and business professionals drafting agreements via Claude/MCP
- **Signing providers**: DocuSign (primary), Dropbox Sign, Adobe Sign, PandaDoc (future)
- **UseJunior**: Hosts the MCP and orchestration layer on usejunior.com
- **OpenAgreements community**: Open-source contributors who may add provider adapters

## Goals / Non-Goals

### Goals
- End-to-end flow: Claude → fill template → send for signature → signed PDF
- User authenticates with their own signing provider account (we don't bear costs)
- Provider-neutral adapter interface (DocuSign first, others later)
- Signature tab placement via docx-templates `{tag}` mechanism (same as business fields)
- Draft-first workflow: user reviews in provider UI before sending
- Webhook-driven status updates with polling fallback
- SOC 2-aligned token handling

### Non-Goals
- Building adapters for Dropbox Sign, Adobe Sign, or PandaDoc now
- Embedded signing within our app (user signs in provider's UI)
- Template creation/editing within the signing flow
- Supporting non-DOCX document formats for signing
- Real-time collaborative editing before signing

## Architecture

### Package Boundary

```
open-agreements/
├── src/core/                     # CORE — works without signing
│   ├── fill-pipeline.ts          # Modified: reads signing.yaml, fills sig tags
│   ├── metadata.ts               # Unchanged
│   └── engine.ts                 # Unchanged
├── packages/signing/             # SIGNING — requires hosted infrastructure
│   ├── src/
│   │   ├── provider.ts           # SigningProvider interface
│   │   ├── docusign.ts           # DocuSign adapter
│   │   ├── storage.ts            # GCS + Firestore helpers
│   │   └── webhook.ts            # Webhook verification
│   └── package.json
├── content/templates/*/
│   ├── template.docx             # Modified: add {sig_*} tags
│   ├── metadata.yaml             # Unchanged
│   └── signing.yaml              # NEW: signer roles + anchor mappings
└── api/                          # Vercel serverless routes
    ├── auth/docusign/
    │   ├── connect.ts
    │   └── callback.ts
    └── signing/
        └── webhook.ts
```

The core fill pipeline has no dependency on the signing package. If `signing.yaml` exists and a provider is connected, signature tags are filled with anchors. If not, they are filled with blanks. The fill pipeline never imports from `packages/signing/`.

### Signature Tag Fill Flow

```
Template DOCX has:           signing.yaml has:            Fill result:
{party_1_name}               providerAnchors.docusign:    "Acme Corp"
{sig_party_1}                  sig_party_1: "/sn1/"       "/sn1/"
{date_party_1}                 date_party_1: "/ds1/"      "/ds1/"
```

docx-templates processes all tags in one pass. The fill pipeline merges business values (from AI) with signing values (from signing.yaml + provider config) before calling `createReport()`.

### DocuSign API Flow

```
1. OAuth: GET /oauth/auth → POST /oauth/token → GET /oauth/userinfo
2. Create: POST /envelopes (status: "created", eventNotification, document, tabs)
3. Review: POST /envelopes/{id}/views/sender → returns senderViewUrl
4. Status: webhook → POST our /api/signing/webhook (HMAC verified)
5. Artifact: GET /envelopes/{id}/documents/combined → store in GCS → return signed URL
```

### Provider Anchor Tag Reference

| Provider | Signature | Date | Initials | Docs |
|----------|-----------|------|----------|------|
| DocuSign | `/sn1/` | `/ds1/` | `/in1/` | [AutoPlace](https://developers.docusign.com/docs/esign-rest-api/esign101/concepts/tabs/auto-place/) |
| Dropbox Sign | `[sig\|req\|signer1]` | `[date\|req\|signer1]` | `[initial\|req\|signer1]` | [Text Tags](https://developers.hellosign.com/docs/text-tags/walkthrough/) |
| Adobe Sign | `{{sig_es_:signer1:signature}}` | `{{date_es_:signer1:date}}` | `{{init_es_:signer1:initials}}` | [Text Tags](https://helpx.adobe.com/sign/authoring/text-tags/basics-syntax.html) |
| PandaDoc | `{{signature:role}}` | `{{date:role}}` | N/A | [Field Tags](https://developers.pandadoc.com/docs/create-document-from-file) |

### Data Storage

**Google Cloud Firestore collections:**
- `signing_connections` — encrypted OAuth tokens, accountId, baseUri, scopes, api_key
- `signing_envelopes` — envelope status, signer statuses, timestamps, documentRef
- `signing_audit_log` — every envelope created (api_key, envelopeId, timestamp, recipients, action)

**Google Cloud Storage bucket:**
- `openagreements-signing-artifacts/` — filled DOCX files (24h TTL), signed PDFs (30d TTL)

### Security Model

- OAuth tokens encrypted with AES-256 (key in Azure Key Vault, same as existing pattern)
- PKCE + CSRF state on every OAuth flow
- Webhook HMAC-SHA256 verification via `X-Docusign-Signature-1`
- Scopes: `signature` + `extended` (minimum for envelope + refresh)
- Audit log: every envelope creation, status change, artifact retrieval
- User can disconnect anytime via `disconnect_signing_provider`
