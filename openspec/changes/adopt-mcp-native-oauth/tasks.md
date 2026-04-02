# Tasks: adopt-mcp-native-oauth

## Phase 0: Spike — Selective 401 Client Behavior
- [x] Build minimal test server that returns 200 for `tools/list` and 401 + `WWW-Authenticate` for a specific `tools/call`
- [x] Test with Claude Code: does it handle mid-session 401 and initiate OAuth?
- [ ] Test with Claude Desktop/Cowork: same test
- [ ] Test with Gemini CLI: same test
- [x] Decision gate: if clients handle mid-session 401 → proceed with single endpoint. If not → split into two MCP endpoints or require auth on entire endpoint.

## Phase 1: OAuth Server Foundation
- [ ] Generate RS256 signing key pair; add JWKS endpoint at `/api/auth/jwks` with `kid` from day one
- [ ] Add `/.well-known/oauth-protected-resource` (RFC 9728): `resource`, `authorization_servers`, `scopes_supported`, `bearer_methods_supported`
- [ ] Add `/.well-known/oauth-authorization-server` (RFC 8414): `issuer`, all endpoints, `grant_types_supported`, `response_types_supported`, `code_challenge_methods_supported`, `token_endpoint_auth_methods_supported: ["none"]`, `revocation_endpoint_auth_methods_supported: ["none"]`
- [ ] Add `POST /api/auth/register` DCR endpoint (RFC 7591): store client in Firestore `oauth_clients` with exact `redirect_uris`, 90-day inactivity TTL
- [ ] Add branded consent page at `GET /api/auth/authorize`: validate `resource`, `client_id`, `redirect_uri` (exact match), `code_challenge`, `state`, `scope`; render client name + permissions; store consent in `oauth_consents`
- [ ] Add `POST /api/auth/token`: validate `resource`, exchange auth code for JWT access token (`iss`, `aud`, `sub`, `scope`, `exp`) + opaque refresh token; store refresh token in `oauth_refresh_tokens` with `family_id`
- [ ] Add `POST /api/auth/revoke`: revoke OA tokens AND delete stored DocuSign connection from `signing_connections` (unlink/switch account)
- [ ] Implement auth code issuance: store in `oauth_codes` with `resource`, `redirect_uri`, `code_challenge`, 60-second expiry, single-use flag
- [ ] Implement refresh token rotation: on use, invalidate old token, issue new token in same family; on reuse of invalidated token, revoke entire family
- [ ] Implement upstream DocuSign token refresh: when stored DS access token expires, use DS refresh token to get new one, update Firestore

## Phase 2: HTTP Transport Auth Middleware
- [ ] Add auth middleware that parses JSON-RPC body to identify request type and tool name
- [ ] Return HTTP 401 + `WWW-Authenticate: Bearer resource_metadata="..."` for signing `tools/call` without valid Bearer token
- [ ] Return HTTP 403 + `error="insufficient_scope"` for valid token without `signing` scope
- [ ] Pass through 200 for `initialize`, `tools/list`, `resources/*`, and template tool calls
- [ ] Validate JWT: check signature (RS256), `aud` matches protected resource URI, `exp` not expired, extract `sub`
- [ ] CORS: add `Authorization` to `Access-Control-Allow-Headers`, add `WWW-Authenticate` to `Access-Control-Expose-Headers`

## Phase 3: Tool Schema Changes (Remote MCP)
- [ ] Remove `connect_signing_provider` from remote MCP tool list
- [ ] Remove `disconnect_signing_provider` from remote MCP tool list
- [ ] Remove `api_key` parameter from `send_for_signature` schema (remote)
- [ ] Remove `api_key` parameter from `check_signature_status` schema (remote)
- [ ] Update signing tool handlers: receive `sub` from auth middleware context, use for connection lookup
- [ ] Add envelope ownership: store `owner_sub` on envelope creation, check match in `check_signature_status` before returning status/artifacts

## Phase 4: stdio Auth Path
- [ ] Add `getConnectionByConnectionId(id)` as first-class Firestore lookup (not just rename of `getConnectionForKey`)
- [ ] Rename `api_key` to `connection_id` in stdio signing tool schemas
- [ ] Auto-generate `connection_id` (UUID) server-side in `connect_signing_provider`
- [ ] Return `connection_id` in `connect_signing_provider` response
- [ ] Handle pending auth session: `connection_id` is returned before DocuSign callback completes; store pending state in Firestore
- [ ] Update stdio tool descriptions: no mention of "API key"

## Phase 5: Canonical URL + Config
- [ ] Update `OA_BASE_URL` default from `.ai` to `.org` in `api/mcp.ts`
- [ ] Update defaults in `api/auth/docusign/connect.ts`
- [ ] Update defaults in `api/auth/docusign/callback.ts`
- [ ] Update defaults in `packages/contract-templates-mcp/src/core/signing-tools.ts`
- [ ] Verify `mcp.json` URL is `.org`
- [ ] Verify `.org` and `.ai` both resolve to the same endpoint

## Phase 6: Testing
- [ ] Test: DCR registration → authorize → token exchange → JWT contains correct `aud`/`sub`/`scope`
- [ ] Test: auth code single-use — second exchange fails
- [ ] Test: auth code expiry — exchange after 10 minutes fails
- [ ] Test: `resource` param required on authorize and token endpoints
- [ ] Test: state/CSRF validation on authorize callback
- [ ] Test: consent persistence — returning client skips consent page
- [ ] Test: refresh token rotation — old token invalidated after use
- [ ] Test: refresh token reuse detection — reuse of old token revokes entire family
- [ ] Test: upstream DocuSign token refresh — expired DS token auto-refreshed
- [ ] Test: remote disconnect via `/api/auth/revoke` — OA tokens AND DocuSign connection removed
- [ ] Test: expired JWT → 401 → refresh → retry succeeds
- [ ] Test: signing tool with wrong `sub` → envelope ownership denied
- [ ] Test: cross-user envelope access denied in `check_signature_status`
- [ ] Test: stdio path with `connect_signing_provider` + `connection_id` still works
- [ ] Test: template tools work without auth
- [ ] Test: `initialize` and `tools/list` work without auth
- [ ] Test: CORS preflight includes `Authorization` in allowed headers
- [ ] Test with Claude Code: `claude mcp add --transport http open-agreements https://openagreements.org/api/mcp`
- [ ] Test with Gemini CLI: add to config, verify OAuth discovery + signing flow
- [ ] Test: branded consent page renders correctly with client name and permissions
- [ ] Run `openspec validate adopt-mcp-native-oauth --strict`
