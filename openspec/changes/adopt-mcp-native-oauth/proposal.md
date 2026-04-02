# Proposal: Adopt MCP-Native OAuth for Signing Integration

## Change ID
`adopt-mcp-native-oauth`

## Summary

Replace the custom `open_agreements_api_key`-based signing authentication on the remote MCP server with MCP-spec OAuth. OA becomes an OAuth authorization server that issues JWT access tokens, manages DocuSign credentials server-side, and lets MCP clients (Claude, Gemini CLI, Codex, VS Code Copilot, Cursor) handle the auth flow natively. The stdio package retains the existing `connect_signing_provider` tool with a renamed `connection_id`.

## Why

The current signing flow requires the AI to pass an `open_agreements_api_key` on every signing tool call. This key is an OA-internal session identifier — not a user-facing credential — but Claude interprets the tool schema literally and asks the user for it, derailing the demo flow. The root cause is architectural: we're reimplementing OAuth at the tool layer when every major MCP client already handles it at the transport layer.

MCP OAuth is now supported across Claude (Code + Desktop), Gemini CLI, Codex CLI, VS Code Copilot, and Cursor. DocuSign's own Claude connector uses this exact pattern. No external users are on the remote MCP signing flow yet, so this is the clean-break moment.

## Architecture

### Key Concepts (kept separate throughout)

- **Protected resource**: `https://openagreements.org/api/mcp` — the MCP endpoint clients access
- **Authorization server issuer**: `https://openagreements.org` — the OAuth issuer identity
- **Resource binding**: every authorization code, access token, and refresh token is bound to the protected resource URI and validated on every request

### OA as MCP Authorization Server

OA advertises itself (not DocuSign) as the authorization server. MCP clients discover OA's OAuth endpoints, register via DCR, and receive OA-issued JWT tokens. OA stores DocuSign tokens in Firestore server-side — clients never see them.

```
Client adds openagreements.org/api/mcp
  → calls signing tool → gets HTTP 401
  → discovers OA as auth server via /.well-known/oauth-protected-resource
  → DCR registers client at /api/auth/register
  → browser opens /api/auth/authorize (branded OA consent page)
    with resource=https://openagreements.org/api/mcp
  → OA proxies to DocuSign consent → user authorizes
  → DocuSign returns code to OA callback
  → OA exchanges code for DocuSign tokens, stores in Firestore
  → OA issues JWT access token (1hr, aud-bound) + Firestore refresh token to client
  → client passes JWT on subsequent requests
  → OA validates JWT signature + aud claim, extracts sub, looks up DocuSign tokens
```

### Token Model

- **Access token**: Signed JWT (RS256), 1hr TTL. Contains `iss` (OA issuer), `aud` (protected resource URI), `sub` (OA session/user ID), `scope` (`signing`), `exp`, `iat`. Self-validating — no DB hit per request. MCP `resource` binding enforced via `aud` claim.
- **Refresh token**: Opaque random string, stored in Firestore with token family ID. Used for silent re-auth without browser popup. Rotated on each use (old token invalidated). Reuse detection: if an already-used refresh token is presented, revoke the entire token family.
- **DocuSign tokens**: Stored in Firestore, keyed by OA session ID. Never exposed to clients. Refreshed server-side when DocuSign access token expires.

### JWT Details

- Algorithm: RS256 (maximum client compatibility)
- JWKS endpoint at `/api/auth/jwks` — include `kid` (Key ID) in JWT header from day one, even with a single key, to enable future key rotation without breaking clients
- Claims: `iss` (OA issuer), `aud` (protected resource URI), `sub` (OA session ID), `scope`, `exp` (1hr), `iat`, `kid`

### Authorization Data Model (Firestore)

| Collection | Key | Contents |
|------------|-----|----------|
| `oauth_clients` | `client_id` | `redirect_uris`, `client_name`, `grant_types`, `created_at`, `last_used_at` (90-day TTL on inactivity) |
| `oauth_consents` | `client_id:sub` | `scope`, `granted_at`, client name/redirect at time of consent |
| `oauth_codes` | `code` | `client_id`, `sub`, `resource`, `redirect_uri`, `code_challenge`, `expires_at` (60s), `used` flag |
| `oauth_refresh_tokens` | `token_hash` | `client_id`, `sub`, `resource`, `family_id`, `used` flag, `expires_at` |
| `signing_connections` | `sub` (session ID) | `connectionId`, `provider`, `accountId`, `baseUri`, encrypted DocuSign tokens |
| `envelope_status` | `envelope_id` | `owner_sub`, `status`, `signers`, `created_at` |

### Consent UX

Branded OA consent page at `/api/auth/authorize`:
- Shows: "OpenAgreements will send documents for signature via your DocuSign account"
- Shows: requesting client name, scopes, redirect URI (from DCR registration)
- User clicks "Allow" → redirected to DocuSign login/consent
- After DocuSign authorization, redirected back to OA callback, then to client's redirect URI with OA authorization code
- Consent stored per `client_id:sub` — returning users with existing consent skip the OA page

### Two Auth Paths

| Transport | Auth Method | connect_signing_provider tool |
|-----------|------------|-------------------------------|
| **HTTP (remote)** | MCP-native OAuth (401 → discovery → DCR → JWT) | Not exposed |
| **stdio (local)** | Tool-based (`connect_signing_provider` returns browser URL) | Retained |

Auth resolution happens at the transport edge:
- HTTP: middleware extracts JWT from `Authorization: Bearer` header, validates signature + `aud` + `exp`, extracts `sub`, passes to handler
- stdio: handler receives `connection_id` from tool args, passes to handler

Both paths converge at the same `getConnection(sub_or_connection_id)` lookup.

### Server-Side Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /.well-known/oauth-protected-resource` | RFC 9728 — `resource`, `authorization_servers`, `scopes_supported`, `bearer_methods_supported` |
| `GET /.well-known/oauth-authorization-server` | RFC 8414 — `issuer`, `authorization_endpoint`, `token_endpoint`, `registration_endpoint`, `revocation_endpoint`, `grant_types_supported`, `response_types_supported`, `code_challenge_methods_supported`, `token_endpoint_auth_methods_supported: ["none"]`, `revocation_endpoint_auth_methods_supported: ["none"]` |
| `POST /api/auth/register` | RFC 7591 — DCR for MCP clients. Stores exact `redirect_uris`. |
| `GET /api/auth/authorize` | Branded consent page. Requires `resource`, `client_id`, `redirect_uri`, `code_challenge`, `state`, `scope`. |
| `POST /api/auth/token` | Token exchange. Requires `resource`. Returns JWT access token + opaque refresh token. |
| `POST /api/auth/revoke` | Revokes OA tokens AND detaches stored DocuSign connection (unlink/switch account). |
| `GET /api/auth/docusign/callback` | Receives DocuSign auth code, stores DS tokens, redirects to client. |

### Redirect URI Strategy

In the proxy model, DocuSign only needs OA's callback URI (`https://openagreements.org/api/auth/docusign/callback`). Client redirect URIs are registered with OA via DCR, not with DocuSign. For HTTPS redirect URIs, OA stores and exact-matches them. For loopback redirect URIs (`http://localhost:*` or `http://127.0.0.1:*`), OA matches scheme, host, and path but ignores port per RFC 8252 §7.3 — CLI clients use random ephemeral ports on each run.

### Selective 401 Handling

The MCP endpoint (`/api/mcp`) is a single HTTP URL. Auth middleware minimally parses the JSON-RPC body:

| Request type | Token present? | Response |
|-------------|---------------|----------|
| `initialize`, `tools/list`, `resources/*` | Any | 200 (no auth needed) |
| `tools/call` for `list_templates`, `get_template`, `fill_template` | Any | 200 (no auth needed) |
| `tools/call` for `send_for_signature`, `check_signature_status` | Missing/invalid | 401 + `WWW-Authenticate: Bearer resource_metadata="..."` |
| `tools/call` for signing tools | Valid token, wrong scope | 403 + `error="insufficient_scope"` |
| `tools/call` for signing tools | Valid token, correct scope | 200 (proceed) |

### Tool Schema Changes (Remote MCP Only)

**Remove from remote MCP:**
- `connect_signing_provider` — replaced by MCP-native auth
- `disconnect_signing_provider` — replaced by `/api/auth/revoke` (which also detaches DocuSign connection)

**Modify:**
- `send_for_signature` — remove `api_key`. Server extracts session from JWT `sub` claim.
- `check_signature_status` — remove `api_key`. Same. **Envelope ownership enforced**: handler checks `envelope_status.owner_sub` matches the caller's `sub` before returning status or artifacts.

**Keep unchanged:**
- `list_templates`, `get_template`, `fill_template` — no auth required
- All signing tools in stdio package — retain `connect_signing_provider` with `connection_id` (server-generated, first-class Firestore lookup path)

### HTTP Transport Changes

- Return HTTP 401 with `WWW-Authenticate: Bearer resource_metadata="https://openagreements.org/.well-known/oauth-protected-resource"` for unauthenticated signing tool calls
- CORS: `Authorization` in `Access-Control-Allow-Headers`, `WWW-Authenticate` in `Access-Control-Expose-Headers`
- Template tools and `initialize`/`tools/list` continue without auth

### Canonical URL

Standardize on `openagreements.org` as the canonical resource URI and issuer origin. Files to update:
- `api/mcp.ts` (default base URL)
- `api/auth/docusign/connect.ts` (base URL)
- `api/auth/docusign/callback.ts` (redirect URIs)
- `packages/contract-templates-mcp/src/core/signing-tools.ts` (base URL)
- `mcp.json` (already `.org` — verify)

## Security

- **Resource binding**: `resource` param required on `/authorize` and `/token`. Persisted on auth codes, access tokens (JWT `aud`), and refresh tokens. Validated on every MCP request.
- **Confused-deputy protection**: Per-client consent with exact redirect URI matching, consent bound to `client_id`
- **Envelope ownership**: `check_signature_status` and artifact download require `owner_sub` match
- **PKCE**: Required for all authorization requests
- **Refresh token families**: Reuse detection revokes entire family on duplicate use
- **Firestore TTL**: DCR registrations expire after 90 days of inactivity; auth codes expire in 10 minutes

## DCR as Compatibility Tradeoff

The current MCP auth spec (2025-11-25) prefers Client ID Metadata Documents (CIMD) over DCR. We implement DCR as a deliberate compatibility tradeoff because:
- Codex CLI currently requires DCR
- Claude, Gemini CLI, VS Code Copilot, and Cursor all support DCR
- CIMD support can be added later without breaking DCR clients

Tested client matrix: Claude Code, Claude Desktop, Gemini CLI, Codex CLI, VS Code Copilot, Cursor.

## Risks

1. **Selective 401 mid-session (HIGH)** — MCP clients may only handle auth challenges at connection time, not on `tools/call` mid-session. If a client establishes a connection, lists tools, then gets a 401 on `send_for_signature`, it may throw a transport error instead of initiating OAuth. **Requires spike test (Phase 0) before building full auth server.** Fallback: two separate MCP endpoints (public templates + auth-required signing) or require auth on entire endpoint.
2. **Proxy auth complexity** — OA becomes a full OAuth AS. Mitigated by well-defined specs and DocuSign's own connector using this pattern.
3. **JWT signing key management** — Need to generate and rotate RS256 keys. Mitigated by standard `jose` library; JWKS endpoint with `kid` from day one.
4. **Codex token persistence bugs** — Codex may re-auth on restart. Refresh tokens make re-auth fast (no browser popup).
5. **CORS headers on 401 responses** — Web frameworks often strip CORS headers on error responses. Must explicitly set `Access-Control-Allow-Origin`, `Access-Control-Expose-Headers`, and `Access-Control-Allow-Headers` on 401/403 responses.

## Scope Boundaries

**In scope:** OA auth server (metadata, DCR, authorize, token, revoke), JWT access token issuance/validation, Firestore refresh tokens with family rotation, branded consent page, HTTP 401/403/CORS middleware, selective auth by tool name, envelope ownership enforcement, signing tool schema changes (remote only), stdio `api_key` → `connection_id` with first-class Firestore lookup, canonical URL standardization, upstream DocuSign token refresh.

**Out of scope:** MCP App UI, embedded signing (`createRecipientView`), non-DocuSign providers, template tool auth, CIMD (future — DCR first), in-memory token cache (unnecessary at current scale with JWT).

## References

- [MCP Authorization Spec (2025-11-25)](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization)
- [RFC 9728 — Protected Resource Metadata](https://www.rfc-editor.org/rfc/rfc9728)
- [RFC 7591 — Dynamic Client Registration](https://www.rfc-editor.org/rfc/rfc7591)
- [RFC 8414 — Authorization Server Metadata](https://www.rfc-editor.org/rfc/rfc8414)
- [RFC 6750 — Bearer Token Usage](https://www.rfc-editor.org/rfc/rfc6750)
- [DocuSign Claude MCP Connector Guide](https://www.docusign.com/blog/developers/claude-docusign-mcp-connector-guide)
- [MCP Security Best Practices](https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices)
- Current implementation: `packages/contract-templates-mcp/src/core/signing-tools.ts`
- Current OAuth: `api/auth/docusign/connect.ts`, `api/auth/docusign/callback.ts`
- Provider interface: `packages/signing/src/provider.ts`
- Storage: `packages/signing/src/gcloud-storage.ts`
