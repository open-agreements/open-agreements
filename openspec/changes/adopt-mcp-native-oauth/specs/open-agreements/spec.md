## ADDED Requirements

### Requirement: Protected Resource Metadata
OA SHALL serve Protected Resource Metadata at `/.well-known/oauth-protected-resource` with `resource`, `authorization_servers`, `scopes_supported`, and `bearer_methods_supported` fields per RFC 9728.

#### Scenario: [OA-AUTH-001] MCP client discovers OA as auth server
- **WHEN** an MCP client fetches `GET /.well-known/oauth-protected-resource`
- **THEN** the response includes `resource` set to the MCP endpoint URI
- **AND** `authorization_servers` contains the OA issuer origin
- **AND** `scopes_supported` includes `signing`
- **AND** `bearer_methods_supported` includes `header`

### Requirement: Authorization Server Metadata
OA SHALL serve OAuth Authorization Server Metadata at `/.well-known/oauth-authorization-server` with `issuer`, all endpoint URIs, supported grant types, response types, code challenge methods, and `token_endpoint_auth_methods_supported: ["none"]` per RFC 8414.

#### Scenario: [OA-AUTH-002] MCP client discovers OAuth endpoints
- **WHEN** an MCP client fetches `GET /.well-known/oauth-authorization-server`
- **THEN** the response includes `issuer` matching the OA origin
- **AND** includes `authorization_endpoint`, `token_endpoint`, `registration_endpoint`, and `revocation_endpoint`
- **AND** `response_types_supported` includes `code`
- **AND** `code_challenge_methods_supported` includes `S256`
- **AND** `token_endpoint_auth_methods_supported` includes `none`

### Requirement: Dynamic Client Registration
OA SHALL support Dynamic Client Registration (RFC 7591) for MCP clients, storing exact redirect URIs and expiring registrations after 90 days of inactivity.

#### Scenario: [OA-AUTH-003] MCP client registers via DCR
- **WHEN** a client sends a POST to `/api/auth/register` with `redirect_uris`, `client_name`, and `grant_types`
- **THEN** OA returns a `client_id`
- **AND** stores the registration in Firestore with exact redirect URIs and a 90-day inactivity TTL

#### Scenario: [OA-AUTH-004] DCR rejects invalid redirect URI
- **WHEN** a client registers with a `redirect_uri` that is not `http://localhost:*` or a pre-approved HTTPS domain
- **THEN** OA returns an error and does not create a registration

### Requirement: Resource-Bound Authorization
OA SHALL require `resource` parameter on `/api/auth/authorize` and `/api/auth/token`, persist it on authorization codes, access tokens, and refresh tokens, and validate it on every authenticated MCP request.

#### Scenario: [OA-AUTH-005] Resource parameter required on authorize
- **WHEN** a client calls `/api/auth/authorize` without a `resource` parameter
- **THEN** OA returns an error and does not issue an authorization code

#### Scenario: [OA-AUTH-006] Resource parameter persisted on tokens
- **WHEN** a client exchanges an authorization code at `/api/auth/token` with `resource`
- **THEN** the issued JWT access token contains `aud` matching the `resource` value
- **AND** the refresh token record in Firestore contains the `resource` value

### Requirement: Branded Consent Page
OA SHALL display a branded consent page during the authorization flow showing the requesting client name, scopes, and redirect URI.

#### Scenario: [OA-AUTH-007] User sees consent page before DocuSign redirect
- **WHEN** a client redirects to `/api/auth/authorize` with valid `client_id`, `scope`, and `resource`
- **THEN** OA renders a branded page showing the client name and requested permissions
- **AND** the user must click "Allow" before being redirected to DocuSign's consent screen

#### Scenario: [OA-AUTH-008] Returning client with existing consent skips OA consent page
- **WHEN** a client redirects to `/api/auth/authorize` and a consent record exists for this `client_id:sub`
- **THEN** OA skips the consent page and redirects directly to DocuSign

### Requirement: JWT Access Tokens with Audience Binding
OA SHALL issue signed JWT access tokens (RS256, 1hr TTL) with `iss`, `aud`, `sub`, `scope`, `exp`, and `iat` claims. The `aud` claim SHALL match the protected resource URI.

#### Scenario: [OA-AUTH-009] Successful token exchange returns JWT
- **WHEN** a client exchanges a valid authorization code at `/api/auth/token` with matching `resource`
- **THEN** OA returns a signed JWT access token with `aud` matching the protected resource URI, 1-hour TTL
- **AND** an opaque refresh token stored in Firestore with a token family ID
- **AND** the DocuSign tokens are stored server-side and never exposed to the client

### Requirement: Refresh Token Rotation with Reuse Detection
OA SHALL rotate refresh tokens on each use and detect reuse of invalidated tokens, revoking the entire token family on reuse.

#### Scenario: [OA-AUTH-010] Refresh token rotation
- **WHEN** a client uses a refresh token to get a new access token
- **THEN** OA issues a new access token and a new refresh token in the same family
- **AND** the old refresh token is marked as used

#### Scenario: [OA-AUTH-011] Reuse of invalidated refresh token revokes family
- **WHEN** a client presents a refresh token that has already been used
- **THEN** OA revokes all tokens in that token family
- **AND** returns an error requiring re-authentication

### Requirement: Selective HTTP 401 for Signing Tools
OA SHALL return HTTP 401 with `WWW-Authenticate` header when signing tools are called without a valid Bearer token, while allowing template tools and discovery requests without auth.

#### Scenario: [OA-AUTH-012] Unauthenticated signing tool call triggers OAuth discovery
- **WHEN** a client calls `send_for_signature` via HTTP without a Bearer token
- **THEN** OA returns HTTP 401 with `WWW-Authenticate: Bearer resource_metadata="https://openagreements.org/.well-known/oauth-protected-resource"`

#### Scenario: [OA-AUTH-013] Template tools remain unauthenticated
- **WHEN** a client calls `list_templates` or `fill_template` via HTTP without a Bearer token
- **THEN** OA processes the request normally without returning 401

#### Scenario: [OA-AUTH-014] Valid token with wrong scope returns 403
- **WHEN** a client calls `send_for_signature` with a valid JWT that lacks `signing` scope
- **THEN** OA returns HTTP 403 with `error="insufficient_scope"`

### Requirement: Transport-Specific Tool Exposure
The remote MCP server SHALL NOT expose `connect_signing_provider` or `disconnect_signing_provider` tools. These tools SHALL remain available in the stdio package only, with `connection_id` replacing `api_key`.

#### Scenario: [OA-AUTH-015] Remote MCP tool list excludes connection tools
- **WHEN** a client calls `tools/list` on the remote HTTP MCP server
- **THEN** the response does not include `connect_signing_provider` or `disconnect_signing_provider`
- **AND** `send_for_signature` and `check_signature_status` do not have `api_key` parameters

#### Scenario: [OA-AUTH-016] stdio package retains connection tools with connection_id
- **WHEN** a client calls `tools/list` on the stdio MCP server
- **THEN** the response includes `connect_signing_provider` with a server-generated `connection_id`
- **AND** `send_for_signature` accepts `connection_id` instead of `api_key`

### Requirement: Envelope Ownership Enforcement
The `check_signature_status` tool SHALL verify that the caller owns the envelope before returning status or artifacts.

#### Scenario: [OA-AUTH-017] Envelope owner can check status
- **WHEN** `check_signature_status` is called with an `envelope_id` and the caller's `sub` matches the envelope's `owner_sub`
- **THEN** OA returns the envelope status and artifacts

#### Scenario: [OA-AUTH-018] Non-owner cannot check status
- **WHEN** `check_signature_status` is called with an `envelope_id` and the caller's `sub` does NOT match the envelope's `owner_sub`
- **THEN** OA returns an error and does not disclose status or artifacts

### Requirement: Remote Disconnect with DocuSign Detach
The `/api/auth/revoke` endpoint SHALL revoke OA-issued tokens AND detach the stored DocuSign connection, allowing users to unlink or switch DocuSign accounts.

#### Scenario: [OA-AUTH-019] Revoke detaches DocuSign connection
- **WHEN** a client calls `POST /api/auth/revoke` with a valid token
- **THEN** OA revokes the access token and all refresh tokens in the family
- **AND** deletes the stored DocuSign connection from Firestore
- **AND** the user must re-authorize to use signing tools again

## MODIFIED Requirements

### Requirement: Dual-Transport Signing Authentication
The signing tool handlers SHALL accept authentication via JWT Bearer token (HTTP) or connection_id (stdio), with auth resolution at the transport edge.

#### Scenario: [OA-AUTH-020] HTTP signing uses JWT Bearer token
- **WHEN** `send_for_signature` is called via HTTP with a valid OA JWT Bearer token
- **THEN** OA validates the JWT signature, `aud`, and `exp`, extracts the `sub`, looks up stored DocuSign tokens in Firestore, and proceeds with envelope creation
- **AND** stores `owner_sub` on the created envelope

#### Scenario: [OA-AUTH-021] stdio signing uses connection_id
- **WHEN** `send_for_signature` is called via stdio with a `connection_id`
- **THEN** OA looks up stored DocuSign tokens via `getConnectionByConnectionId` and proceeds with envelope creation
