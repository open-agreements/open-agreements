# Tasks: Agreement Signing Integration

## Phase 0: OpenSpec + CI

- [ ] 0.1 Create `openspec/changes/add-agreement-signing/` with proposal, design, spec, tasks
- [ ] 0.2 Update `scripts/validate_openspec_coverage.mjs` to treat `.skip()` as covered
- [ ] 0.3 Validate: `openspec validate add-agreement-signing --strict`

## Phase 1: Foundation

- [ ] 1.1 Create `packages/signing/` workspace package with `package.json`, `tsconfig.json`
- [ ] 1.2 Implement `SigningProvider` interface in `packages/signing/src/provider.ts`
- [ ] 1.3 Implement `DocumentRef` and `ArtifactRef` types
- [ ] 1.4 Implement Google Cloud Storage helpers in `packages/signing/src/storage.ts`
- [ ] 1.5 Implement Firestore helpers for connection records and audit log
- [ ] 1.6 Set up Google Cloud project/bucket/Firestore collection (via gcloud CLI)

## Phase 2: Signing Config + Fill Integration

- [ ] 2.1 Define `signing.yaml` schema (Zod validation)
- [ ] 2.2 Add `{sig_party_1}`, `{sig_party_2}`, `{date_party_1}`, `{date_party_2}` to bonterms-mutual-nda `template.docx`
- [ ] 2.3 Create `content/templates/bonterms-mutual-nda/signing.yaml`
- [ ] 2.4 Modify fill pipeline to read `signing.yaml` and populate signature tags
- [ ] 2.5 Add validation: fail closed if `signing.yaml` references tags missing from DOCX
- [ ] 2.6 Unit tests for OA-SIG-001 through OA-SIG-006

## Phase 3: DocuSign Adapter

- [ ] 3.1 Implement `DocuSignProvider` in `packages/signing/src/docusign.ts`
- [ ] 3.2 Implement OAuth with PKCE: `getAuthUrl`, `handleCallback`
- [ ] 3.3 Implement `/userinfo` call for account discovery (accountId, baseUri)
- [ ] 3.4 Implement `createDraft` using DocuSign create-envelope API with `anchorString` tabs
- [ ] 3.5 Implement embedded sender view URL generation (`POST /views/sender`)
- [ ] 3.6 Implement `send`, `getStatus`, `fetchArtifact`, `disconnect`
- [ ] 3.7 Create OAuth routes: `api/auth/docusign/connect.ts`, `api/auth/docusign/callback.ts`
- [ ] 3.8 Unit tests for OA-SIG-007 through OA-SIG-009
- [ ] 3.9 Integration tests (mocked HTTP) for OA-SIG-010 through OA-SIG-013

## Phase 4: Webhooks

- [ ] 4.1 Create webhook endpoint: `api/signing/webhook.ts`
- [ ] 4.2 Implement HMAC-SHA256 verification
- [ ] 4.3 Implement per-envelope `eventNotification` on envelope creation
- [ ] 4.4 Implement local status table updates on webhook events
- [ ] 4.5 Implement polling fallback for `getStatus`
- [ ] 4.6 Unit tests for OA-SIG-014 through OA-SIG-016

## Phase 5: MCP Tools

- [ ] 5.1 Implement `connect_signing_provider` tool
- [ ] 5.2 Implement `disconnect_signing_provider` tool
- [ ] 5.3 Implement `upload_signing_document` tool
- [ ] 5.4 Implement `send_for_signature` tool (draft-only default)
- [ ] 5.5 Implement `check_signature_status` tool
- [ ] 5.6 Implement `get_signed_document` tool
- [ ] 5.7 Unit tests for OA-SIG-017 through OA-SIG-020
- [ ] 5.8 `npm run check:spec-coverage` green

## Phase 6: Manual End-to-End Verification

- [ ] 6.1 Steven provides DocuSign sandbox credentials
- [ ] 6.2 Fill bonterms-mutual-nda → verify `{sig_party_1}` replaced with `/sn1/`
- [ ] 6.3 OAuth: connect to sandbox → verify connection in Firestore
- [ ] 6.4 send_for_signature → verify draft envelope in DocuSign
- [ ] 6.5 Visual verification: "Sign Here" tabs appear at anchor locations
- [ ] 6.6 Sign in sandbox → verify webhook fires → status updated
- [ ] 6.7 get_signed_document → verify signed PDF downloadable
- [ ] 6.8 Edited DOCX flow: download → edit → upload → send → sign
- [ ] 6.9 Disconnect → verify subsequent calls fail with NO_SIGNING_PROVIDER
- [ ] 6.10 Audit log: verify envelope creation logged

## Phase 7: Extend Templates

- [ ] 7.1 Add `signing.yaml` + signature tags to common-paper-mutual-nda
- [ ] 7.2 Add `signing.yaml` + signature tags to yc-safe-valuation-cap
- [ ] 7.3 Add `signing.yaml` + signature tags to openagreements-employment-offer-letter
