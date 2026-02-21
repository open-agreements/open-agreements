# Change: Update Hosted Download Link Resilience

## Why

The current hosted download link uses a long stateless signed token that embeds
template values directly in the URL. In practice, copy/paste and client
rewriting can corrupt these long tokens, and the download endpoint currently
returns a single generic error string that does not distinguish malformed vs
expired links. This causes avoidable support/debug friction.

## What Changes

- Phase 1 (quick wins):
  - Add `HEAD` support to `/api/download` so clients can probe links without
    forcing a full download.
  - Return machine-readable error codes that distinguish malformed identifier,
    invalid signature, expired link, and missing parameter cases.
- Phase 2 (robust fix):
  - Replace payload-in-URL stateless tokens with opaque `download_id`
    identifiers backed by a TTL store.
  - Update MCP fill/download responses to include the new `download_id` and
    id-based `download_url`.
  - Remove token-based download links from the hosted API contract.

## Impact

- Affected specs: `open-agreements`
- Affected code:
  - `api/mcp.ts`
  - `api/download.ts`
  - `api/_shared.ts`
  - new download-link storage module(s) and integration tests
- Runtime behavior:
  - Download URLs become shorter and less copy-fragile.
  - Error responses become diagnosable and machine-actionable.
  - Download endpoint supports both `GET` and `HEAD`.
