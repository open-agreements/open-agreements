## ADDED Requirements

### Requirement: Signing Config Parsing and Validation
The fill pipeline SHALL parse per-template `signing.yaml` files defining signer roles, signature tag fields, and provider-specific anchor string mappings.

#### Scenario: [OA-SIG-001] signing.yaml parses valid signer roles and anchor mappings
- **WHEN** a template has a valid `signing.yaml` with signers, signatureFields, and providerAnchors
- **THEN** the parser returns structured signer roles with correct field references
- **AND** provider anchor lookup returns the expected anchor string for each provider

#### Scenario: [OA-SIG-002] signing.yaml rejects missing signatureField references
- **WHEN** `signing.yaml` references a `signatureField` that does not exist as a `{tag}` in the DOCX template
- **THEN** validation fails with an error identifying the missing tag

#### Scenario: [OA-SIG-003] provider anchor lookup returns correct strings per provider
- **WHEN** the adapter looks up anchor strings for `docusign`, `dropboxsign`, `adobesign`, or `pandadoc`
- **THEN** it returns the documented anchor format for that provider
- **AND** DocuSign returns `/sn1/`-style anchors
- **AND** Dropbox Sign returns `[sig|req|signer1]`-style tags
- **AND** Adobe Sign returns `{{name_es_:signer1:signature}}`-style tags
- **AND** PandaDoc returns `{{signature:role}}`-style tags

### Requirement: Signature Tag Fill Integration
The fill pipeline SHALL replace signature `{tag}` placeholders with provider-specific anchor strings during the same fill pass as business fields, using docx-templates native tag replacement.

#### Scenario: [OA-SIG-004] fill pipeline replaces sig tags with provider anchor strings
- **WHEN** a template with `{sig_party_1}` is filled with a DocuSign provider connected
- **THEN** the filled DOCX contains the literal text `/sn1/` where `{sig_party_1}` was
- **AND** business fields like `{party_1_name}` are filled with AI-provided values in the same pass

#### Scenario: [OA-SIG-005] fill pipeline leaves signature tags blank when no provider connected
- **WHEN** a template with `{sig_party_1}` is filled with no signing provider connected
- **THEN** the filled DOCX replaces `{sig_party_1}` with an empty string or placeholder
- **AND** the document is still valid and openable in Word

#### Scenario: [OA-SIG-006] fill pipeline fails closed when signing.yaml references tags missing from DOCX
- **WHEN** `signing.yaml` declares `signatureField: sig_party_1` but the DOCX template has no `{sig_party_1}` tag
- **THEN** the fill pipeline returns an error before producing output
- **AND** no partial DOCX is generated

### Requirement: OAuth Provider Connection
The signing package SHALL support OAuth 2.0 Authorization Code Grant with PKCE for connecting to the user's own signing provider account.

#### Scenario: [OA-SIG-007] getAuthUrl generates valid PKCE and state parameters
- **WHEN** `getAuthUrl` is called with a redirect URI
- **THEN** the returned URL contains `code_challenge`, `code_challenge_method=S256`, and a `state` parameter
- **AND** the state is cryptographically random

#### Scenario: [OA-SIG-008] handleCallback exchanges code for tokens and persists connection record
- **WHEN** the OAuth callback receives a valid authorization code and code verifier
- **THEN** the adapter exchanges the code for access and refresh tokens
- **AND** calls the provider's userinfo endpoint to resolve accountId and baseUri
- **AND** stores the connection record with encrypted tokens in Firestore

#### Scenario: [OA-SIG-009] disconnect revokes tokens and removes connection record
- **WHEN** `disconnect` is called with a valid connection ID
- **THEN** the adapter revokes the refresh token at the provider
- **AND** removes the connection record from Firestore

### Requirement: Draft Envelope Creation
The signing package SHALL create draft envelopes on the user's signing provider account, returning an embedded sender-view URL for human review before sending.

#### Scenario: [OA-SIG-010] createDraft sends DOCX to provider and returns reviewUrl
- **WHEN** `createDraft` is called with a valid documentRef and signer metadata
- **THEN** the adapter uploads the DOCX to the provider
- **AND** creates a draft envelope with anchor-based tab placement
- **AND** returns a `reviewUrl` pointing to the provider's embedded sender view
- **AND** returns the `providerEnvelopeId` for status tracking

#### Scenario: [OA-SIG-011] send transitions envelope from created to sent
- **WHEN** `send` is called with a valid draft ID
- **THEN** the envelope status transitions to `sent`
- **AND** recipients receive signing invitation emails

### Requirement: Envelope Status and Artifact Retrieval
The signing package SHALL track envelope status via webhooks (primary) and polling (fallback), and return signed documents as presigned download URLs rather than raw bytes.

#### Scenario: [OA-SIG-012] getStatus returns current signer statuses
- **WHEN** `getStatus` is called with a valid envelope ID
- **THEN** it returns the envelope status and per-signer status with timestamps

#### Scenario: [OA-SIG-013] fetchArtifact returns presigned download URL not raw bytes
- **WHEN** `fetchArtifact` is called for a completed envelope
- **THEN** the signed PDF is stored in Google Cloud Storage
- **AND** a presigned download URL with an expiration time is returned
- **AND** no raw PDF bytes are transmitted through Vercel function responses

### Requirement: Webhook Verification and Status Sync
The signing package SHALL verify incoming webhook payloads using HMAC-SHA256 and update local envelope status on verified events.

#### Scenario: [OA-SIG-014] verifyWebhook validates HMAC-SHA256 signature
- **WHEN** a webhook payload arrives with a valid `X-Docusign-Signature-1` header
- **THEN** HMAC verification passes
- **AND** the event is processed

#### Scenario: [OA-SIG-015] verifyWebhook rejects tampered payloads
- **WHEN** a webhook payload arrives with an invalid or missing HMAC signature
- **THEN** the endpoint returns 401
- **AND** no status update occurs

#### Scenario: [OA-SIG-016] handleWebhookEvent updates local status on envelope-completed
- **WHEN** a verified webhook event with status `envelope-completed` is received
- **THEN** the local envelope status is updated to `completed`
- **AND** the signed PDF is fetched from the provider and stored in Google Cloud Storage

### Requirement: MCP Tool Behavior
The signing MCP tools SHALL enforce safe defaults and provide clear error messages.

#### Scenario: [OA-SIG-017] send_for_signature defaults to draft never auto-sends
- **WHEN** `send_for_signature` is called without an explicit `send_immediately` flag
- **THEN** a draft envelope is created
- **AND** a review URL is returned
- **AND** no signing invitations are sent

#### Scenario: [OA-SIG-018] send_for_signature returns error when no provider connected
- **WHEN** `send_for_signature` is called and no signing provider connection exists for the user's API key
- **THEN** the tool returns a structured error with code `NO_SIGNING_PROVIDER`
- **AND** includes instructions to connect via `connect_signing_provider`

#### Scenario: [OA-SIG-019] upload_signing_document stores file with sha256 and returns documentRef
- **WHEN** a user uploads an edited DOCX via `upload_signing_document`
- **THEN** the file is stored in Google Cloud Storage
- **AND** a `documentRef` is returned with `sha256`, `filename`, `mimeType`, and `source: "uploaded"`

#### Scenario: [OA-SIG-020] get_signed_document returns artifactRef with expiring URL
- **WHEN** `get_signed_document` is called for a completed envelope
- **THEN** it returns an `artifactRef` with a presigned `downloadUrl` and `expiresAt` timestamp
- **AND** the URL is valid for download within the expiration window
