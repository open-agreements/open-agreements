## Context

Hosted OpenAgreements downloads are currently generated from a stateless signed
token that encodes `{template, values, expiry}` directly in the URL. This keeps
the server stateless, but produces long links that are easy to corrupt in chat
or manual copy paths. The endpoint also collapses multiple failure classes into
one generic "invalid or expired" error.

## Goals / Non-Goals

- Goals:
  - Reduce link corruption risk by using short opaque identifiers.
  - Improve operator and client diagnostics with explicit error codes.
  - Support safe link probing via `HEAD`.
- Non-Goals:
  - Change template filling business logic.
  - Introduce long-lived document storage.
  - Expand download link lifetime beyond current policy unless explicitly
    configured.

## Decisions

- Decision: Introduce a `DownloadArtifactStore` abstraction with TTL semantics.
  - Rationale: decouples API contract from storage vendor and supports local
    development fallbacks.
- Decision: Issue opaque `download_id` values and id-based URLs for new
  responses.
  - Rationale: shorter, less fragile links; values are no longer exposed in URL
    payload.
- Decision: Add machine-readable error codes for download failures.
  - Rationale: clients can decide retry/regenerate behavior deterministically.
- Decision: Support `HEAD` on `/api/download`.
  - Rationale: clients can validate link viability before attempting full
    document download.
- Decision: Remove token-based download links from the hosted contract without
  migration fallback.
  - Rationale: keeps implementation simpler and avoids maintaining dual
    validation paths.

## Risks / Trade-offs

- New state dependency:
  - Risk: storage outage can block download resolution.
  - Mitigation: explicit error code for store-unavailable and alerting.
- TTL eviction behavior:
  - Risk: early eviction can look like random link failures.
  - Mitigation: enforce explicit TTL and emit not-found vs expired codes.
- Migration complexity:
  - Risk: client code may still assume token-based links.
  - Mitigation: update docs and integration tests to assert the new `download_id` contract.

## Migration Plan

1. Add explicit error-code contract and `HEAD` behavior.
2. Add store abstraction and id-based issuance for new responses.
3. Roll clients to `download_id`/id-based URL.

## Open Questions

- Which backing store is the production default (Vercel KV/Upstash/other)?
- Should TTL remain 1 hour by default or become configurable per environment?
- Should not-found and expired map to different HTTP statuses (`404` vs `410`)?
