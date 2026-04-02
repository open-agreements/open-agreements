## ADDED Requirements

### Requirement: Protected Resource Metadata
OA SHALL serve Protected Resource Metadata at `/.well-known/oauth-protected-resource` listing itself as the authorization server.

#### Scenario: [OA-AUTH-001] MCP client discovers OA as auth server
- **WHEN** an MCP client fetches `GET /.well-known/oauth-protected-resource`
- **THEN** the response includes `authorization_servers` containing the OA origin
- **AND** `scopes_supported` includes `signing`
- **AND** `bearer_methods_supported` includes `header`

### Requirement: Authorization Server Metadata
OA SHALL serve OAuth Authorization Server Metadata at `/.well-known/oauth-authorization-server` with DCR, authorize, and token endpoints.

#### Scenario: [OA-AUTH-002] MCP client discovers OAuth endpoints
- **WHEN** an MCP client fetches `GET /.well-known/oauth-authorization-server`
- **THEN** the response includes `authorization_endpoint`, `token_endpoint`, and `registration_endpoint`
- **AND** `response_types_supported` includes `code`
- **AND** `code_challenge_methods_supported` includes `S256`

### Requirement: Dynamic Client Registration
OA SHALL support Dynamic Client Registration (RFC 7591) for MCP clients.

#### Scenario: [OA-AUTH-003] Claude Code registers via DCR
- **WHEN** Claude Code sends a POST to `/api/auth/register` with `redirect_uris`, `client_name`, and `grant_types`
- **THEN** OA returns a `client_id`
- **AND** stores the registration in Firestore with a 90-day inactivity TTL

#### Scenario: [OA-AUTH-004] DCR rejects invalid redirect URI
- **WHEN** a client registers with a `redirect_uri` that is not `http://localhost:*` or a pre-approved HTTPS domain
- **THEN** OA returns an error and does not create a registration

### Requirement: Branded Consent Page
OA SHALL display a branded consent page during the authorization flow showing the requesting client name, scopes, and redirect URI.

#### Scenario: [OA-AUTH-005] User sees consent page before DocuSign redirect
- **WHEN** a client redirects to `/api/auth/authorize` with valid `client_id` and `scope`
- **THEN** OA renders a branded page showing the client name and requested permissions
- **AND** the user must click "Allow" before being redirected to DocuSign's consent screen

### Requirement: OA-Issued JWT Access Tokens
OA SHALL issue OA-scoped opaque access tokens and Firestore-backed refresh tokens after successful authorization.

#### Scenario: [OA-AUTH-006] Successful token exchange
- **WHEN** a client exchanges a valid authorization code at `/api/auth/token`
- **THEN** OA returns an opaque access token with 1-hour TTL, stored in Firestore and instantly revocable
- **AND** a refresh token stored in Firestore
- **AND** the DocuSign tokens are stored server-side and never exposed to the client

#### Scenario: [OA-AUTH-007] Refresh token rotation
- **WHEN** a client uses a refresh token to get a new access token
- **THEN** OA issues a new access token and a new refresh token
- **AND** the old refresh token is invalidated

### Requirement: HTTP 401 Challenge for Signing Tools
OA SHALL return HTTP 401 with `WWW-Authenticate` header when signing tools are called without a valid Bearer token on the HTTP transport.

#### Scenario: [OA-AUTH-008] Unauthenticated signing tool call triggers OAuth discovery
- **WHEN** a client calls `send_for_signature` via HTTP without a Bearer token
- **THEN** OA returns HTTP 401 with `WWW-Authenticate: Bearer resource_metadata="https://openagreements.org/.well-known/oauth-protected-resource"`
- **AND** the MCP client initiates the OAuth discovery flow

#### Scenario: [OA-AUTH-009] Template tools remain unauthenticated
- **WHEN** a client calls `list_templates` or `fill_template` via HTTP without a Bearer token
- **THEN** OA processes the request normally without returning 401

### Requirement: Transport-Specific Tool Exposure
The remote MCP server SHALL NOT expose `connect_signing_provider` or `disconnect_signing_provider` tools. These tools SHALL remain available in the stdio package only.

#### Scenario: [OA-AUTH-010] Remote MCP tool list excludes connection tools
- **WHEN** a client calls `tools/list` on the remote HTTP MCP server
- **THEN** the response does not include `connect_signing_provider` or `disconnect_signing_provider`
- **AND** `send_for_signature` and `check_signature_status` do not have `api_key` parameters

#### Scenario: [OA-AUTH-011] stdio package retains connection tools with connection_id
- **WHEN** a client calls `tools/list` on the stdio MCP server
- **THEN** the response includes `connect_signing_provider` with a server-generated `connection_id`
- **AND** `send_for_signature` accepts `connection_id` instead of `api_key`

## MODIFIED Requirements

### Requirement: Dual-Transport Signing Authentication
The signing tool handlers SHALL accept authentication via Bearer token (HTTP) or connection_id (stdio), depending on transport.

#### Scenario: [OA-AUTH-012] HTTP signing uses Bearer token
- **WHEN** `send_for_signature` is called via HTTP with a valid OA opaque Bearer token
- **THEN** OA validates the JWT, extracts the session ID, looks up stored DocuSign tokens in Firestore, and proceeds with envelope creation

#### Scenario: [OA-AUTH-013] stdio signing uses connection_id
- **WHEN** `send_for_signature` is called via stdio with a `connection_id`
- **THEN** OA looks up stored DocuSign tokens using the connection_id and proceeds with envelope creation
