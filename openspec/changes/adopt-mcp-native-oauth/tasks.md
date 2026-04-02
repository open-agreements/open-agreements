# Tasks: adopt-mcp-native-oauth

## Phase 1: OAuth Server Foundation
- [ ] Add `/.well-known/oauth-protected-resource` endpoint (RFC 9728)
- [ ] Add `/.well-known/oauth-authorization-server` endpoint (RFC 8414)
- [ ] Add `/api/auth/register` DCR endpoint (RFC 7591) with Firestore client storage
- [ ] Add branded consent page at `/api/auth/authorize`
- [ ] Add `/api/auth/token` endpoint (auth code → JWT + refresh token exchange)
- [ ] Add `/api/auth/revoke` endpoint for token revocation
- [ ] Implement opaque access token generation (random string, 1hr TTL, stored in Firestore)
- [ ] Implement token validation (Firestore lookup per request, instant revocation)
- [ ] Implement refresh token rotation with Firestore storage
- [ ] Add Firestore TTL policy for DCR registrations (90-day inactivity expiry)

## Phase 2: HTTP Transport Auth Middleware
- [ ] Add auth middleware that returns HTTP 401 + `WWW-Authenticate` for signing tools called without Bearer token
- [ ] Add `Authorization` to CORS `Access-Control-Allow-Headers`
- [ ] Route template tools (list/get/fill) to bypass auth middleware
- [ ] Map OA access token to Firestore DocuSign token lookup in signing tool handlers

## Phase 3: Tool Schema Changes (Remote MCP)
- [ ] Remove `connect_signing_provider` from remote MCP tool list
- [ ] Remove `disconnect_signing_provider` from remote MCP tool list
- [ ] Remove `api_key` parameter from `send_for_signature` schema (remote)
- [ ] Remove `api_key` parameter from `check_signature_status` schema (remote)
- [ ] Update signing tool handlers to extract Bearer token from request context

## Phase 4: stdio Auth Cleanup
- [ ] Rename `api_key` to `connection_id` in stdio signing tool schemas
- [ ] Auto-generate `connection_id` server-side in `connect_signing_provider` (stdio)
- [ ] Return `connection_id` in `connect_signing_provider` response
- [ ] Update stdio tool descriptions to not mention "API key"

## Phase 5: Canonical URL + Config
- [ ] Update `OA_BASE_URL` default from `.ai` to `.org` in `api/mcp.ts`
- [ ] Update defaults in `api/auth/docusign/connect.ts`
- [ ] Update defaults in `api/auth/docusign/callback.ts`
- [ ] Update `mcp.json` URL to `.org`
- [ ] Verify `.org` and `.ai` both resolve to the same endpoint

## Phase 6: Testing + Validation
- [ ] Integration test: DCR registration → authorize → token exchange → signing tool call
- [ ] Integration test: expired JWT → 401 → refresh → retry succeeds
- [ ] Integration test: stdio path with `connect_signing_provider` still works
- [ ] Integration test: template tools work without auth
- [ ] Test with Claude Code: `claude mcp add --transport http open-agreements https://openagreements.org/api/mcp`
- [ ] Test with Gemini CLI: add to config, verify OAuth discovery
- [ ] Manual test: branded consent page renders correctly
- [ ] Run `openspec validate adopt-mcp-native-oauth --strict`
