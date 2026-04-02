# Proposal: Adopt MCP-Native OAuth for Signing Integration

## Change ID
`adopt-mcp-native-oauth`

## Summary

Replace the custom `open_agreements_api_key`-based signing authentication on the remote MCP server with MCP-spec OAuth. OA becomes an OAuth authorization server that issues its own tokens, manages DocuSign credentials server-side, and lets MCP clients (Claude, Gemini CLI, Codex, VS Code Copilot, Cursor) handle the auth flow natively. The stdio package retains the existing `connect_signing_provider` tool.

## Why

The current signing flow requires the AI to pass an `open_agreements_api_key` on every signing tool call. This key is an OA-internal session identifier — not a user-facing credential — but Claude interprets the tool schema literally and asks the user for it, derailing the demo flow. The root cause is architectural: we're reimplementing OAuth at the tool layer when every major MCP client already handles it at the transport layer.

MCP OAuth is now supported across Claude (Code + Desktop), Gemini CLI, Codex CLI, VS Code Copilot, and Cursor. DocuSign's own Claude connector uses this exact pattern. No external users are on the remote MCP signing flow yet, so this is the clean-break moment.

## Architecture

### OA as MCP Authorization Server

OA advertises itself (not DocuSign) as the authorization server. MCP clients discover OA's OAuth endpoints, register via DCR, and receive OA-issued tokens. OA stores DocuSign tokens in Firestore server-side — clients never see them.

```
Client adds openagreements.org/api/mcp
  → calls signing tool → gets HTTP 401
  → discovers OA as auth server via /.well-known/oauth-protected-resource
  → DCR registers client at /api/auth/register
  → browser opens /api/auth/authorize (branded OA consent page)
  → OA proxies to DocuSign consent → user authorizes
  → DocuSign returns code to OA callback
  → OA exchanges code for DocuSign tokens, stores in Firestore
  → OA issues OA-scoped opaque access token (1hr) + refresh token to client
  → client passes OA token on subsequent requests
  → OA validates JWT, maps to stored DocuSign tokens, calls DocuSign API
```

### Token Model

- **Access token**: Opaque random string, stored in Firestore, 1hr TTL. Every request does a Firestore lookup (~0.3ms, negligible cost). Instantly revocable.
- **Refresh token**: Opaque, stored in Firestore, used to issue new access tokens. Rotated on each use.
- **DocuSign tokens**: Stored in Firestore, keyed by OA session ID. Never exposed to clients.

No JWT signing key management needed. MCP clients don't care about token format — they just pass Bearer tokens. Refreshed server-side when expired.

### Consent UX

Branded OA consent page at `/api/auth/authorize`:
- Shows: "OpenAgreements will send documents for signature via your DocuSign account"
- Shows: requesting client name, scopes, redirect URI (from DCR registration)
- User clicks "Allow" → redirected to DocuSign login/consent
- After DocuSign authorization, redirected back to OA callback, then to client's redirect URI with OA authorization code

### Two Auth Paths

| Transport | Auth Method | connect_signing_provider tool |
|-----------|------------|-------------------------------|
| **HTTP (remote)** | MCP-native OAuth (401 → discovery → DCR → opaque token) | Not exposed |
| **stdio (local)** | Tool-based (`connect_signing_provider` returns browser URL) | Retained |

Signing tool handlers detect the transport and use the appropriate auth:
- HTTP: extract OA token from `Authorization: Bearer` header, map to Firestore DocuSign tokens
- stdio: use `connection_id` from `connect_signing_provider` to look up Firestore tokens (rename from `api_key`)

### Server-Side Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /.well-known/oauth-protected-resource` | RFC 9728 — points to OA as auth server |
| `GET /.well-known/oauth-authorization-server` | RFC 8414 — OA's OAuth endpoints |
| `POST /api/auth/register` | RFC 7591 — DCR for MCP clients |
| `GET /api/auth/authorize` | Branded consent page → proxy to DocuSign |
| `POST /api/auth/token` | Token exchange (auth code → OA token + refresh) |
| `GET /api/auth/docusign/callback` | Existing — receives DocuSign auth code |

### Redirect URI Strategy

In the proxy model, DocuSign only needs OA's callback URI (`https://openagreements.org/api/auth/docusign/callback`). Client redirect URIs are registered with OA via DCR, not with DocuSign. OA stores exact redirect URIs from registration and exact-matches them during authorization — no wildcard matching.

### Tool Schema Changes (Remote MCP Only)

**Remove from remote MCP:**
- `connect_signing_provider` — replaced by MCP-native auth
- `disconnect_signing_provider` — client manages session; OA provides `/api/auth/revoke` endpoint

**Modify:**
- `send_for_signature` — remove `api_key`. Server extracts OA token from Bearer header.
- `check_signature_status` — remove `api_key`. Same.

**Keep unchanged:**
- `list_templates`, `get_template`, `fill_template` — no auth required
- All signing tools in stdio package — retain `connect_signing_provider` with renamed `connection_id`

### HTTP Transport Changes

- Return HTTP 401 with `WWW-Authenticate: Bearer resource_metadata="https://openagreements.org/.well-known/oauth-protected-resource"` when signing tools are called without valid Bearer token
- Add `Authorization` to CORS `Access-Control-Allow-Headers`
- Template tools (list/get/fill) continue to work without auth
- 401 is returned before JSON-RPC dispatch for signing tools

### Canonical URL

Standardize on `openagreements.org` as the canonical resource URI and issuer origin. Update all defaults in `api/mcp.ts`, `api/auth/docusign/connect.ts`, `api/auth/docusign/callback.ts` from `.ai` to `.org`.

## Security

- **Confused-deputy protection**: Per-client consent with exact redirect URI matching, consent bound to `client_id`
- **Token scope**: OA tokens scoped to `https://openagreements.org/api/mcp` only
- **PKCE**: Required for all authorization requests (already implemented for DocuSign)
- **Token rotation**: Refresh tokens rotated on each use
- **Firestore TTL**: DCR client registrations expire after 90 days of inactivity

## Risks

1. **Proxy auth complexity** — OA becomes a full OAuth AS. Mitigated by well-defined specs and DocuSign's own connector using this pattern.
2. **Codex token persistence bugs** — Codex may re-auth on restart. Server-side: not our problem. UX: refresh tokens make re-auth fast.
3. **Firestore latency per request** — Every authenticated request does a Firestore read (~0.3ms). Negligible at any realistic scale.

## Scope Boundaries

**In scope:** OA auth server (metadata, DCR, authorize, token, revoke), opaque token issuance/validation, branded consent page, HTTP 401/CORS middleware, signing tool schema changes (remote only), stdio `api_key` → `connection_id` rename, canonical URL standardization.

**Out of scope:** MCP App UI, embedded signing (`createRecipientView`), non-DocuSign providers, template tool auth, CIMD (future MCP spec — DCR first).

## References

- [MCP Authorization Spec (2025-11-25)](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization)
- [RFC 9728 — Protected Resource Metadata](https://www.rfc-editor.org/rfc/rfc9728)
- [RFC 7591 — Dynamic Client Registration](https://www.rfc-editor.org/rfc/rfc7591)
- [RFC 8414 — Authorization Server Metadata](https://www.rfc-editor.org/rfc/rfc8414)
- [DocuSign Claude MCP Connector Guide](https://www.docusign.com/blog/developers/claude-docusign-mcp-connector-guide)
- [MCP Security Best Practices](https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices)
- Current implementation: `packages/contract-templates-mcp/src/core/signing-tools.ts`
- Current OAuth: `api/auth/docusign/connect.ts`, `api/auth/docusign/callback.ts`
