## Context

Current MCP editing behavior makes download semantics easy to misread:
- Users may believe they must run a second edit pass to obtain both clean and redline artifacts.
- Download responses do not clearly distinguish "fresh generation" vs "cache re-download".
- Node identifiers can appear unstable across sessions, which weakens trust in anchors.

This design aligns Safe Docx behavior with user expectations: defaults should do the useful thing (both outputs), re-download should be cheap and session-driven, and anchors should be deterministic and stable.

## Goals / Non-Goals

Goals:
- Default `download` behavior returns both `clean` and `redline` artifacts.
- Explicit overrides remain available for one-variant downloads.
- Users can re-download generated artifacts by `session_id` without replaying edits.
- Paragraph IDs are persisted intrinsic IDs and never index-based.
- Download operations do not mutate session anchor mappings.

Non-Goals:
- Introducing a batch edit API.
- Changing legal review report generation pipelines.
- Replacing bookmark-based addressing outside MCP editing flows.

## Decisions

- Decision: Use persisted intrinsic IDs as canonical paragraph/node identity.
- Why: Pure content-addressable identity cannot uniquely and stably disambiguate duplicate paragraphs. Persisted intrinsic IDs provide uniqueness and stability without index drift.
- Details:
  - Preserve existing `jr_para_*` IDs when present.
  - If missing, mint `jr_para_*` once and persist it as paragraph identity.
  - Duplicate-content paragraphs are disambiguated by distinct persisted IDs, not by content hash or occurrence index.
  - Existing paragraph IDs are preserved through in-place edits inside a session.
  - Content/context hashing MAY be used only as a recovery heuristic when intrinsic IDs are absent or damaged; it is not canonical identity.

- Decision: Make dual-variant download the default.
- Why: Clean + redline is the common workflow and should not require a second edit pass.
- Details:
  - `download` with no variant override returns both `clean` and `redline`.
  - Explicit variant override returns only requested variants.
  - "Redline" in this capability means tracked-changes DOCX output for Safe Docx local editing.

- Decision: Cache artifacts per `session_id` and edit revision.
- Why: Re-download should be cheap and should not re-run edit logic.
- Details:
  - Session state tracks an `edit_revision` counter/hash.
  - Download artifacts are cached by `(session_id, edit_revision, variant_set)`.
  - Repeat download for same key returns cached files.
  - Any new edit invalidates prior revision cache and creates a new cache entry.

- Decision: Make behavior explicit in contract metadata.
- Why: If defaults and cache semantics are implicit, users infer incorrect workflows.
- Details:
  - `open_document` exposes download defaults/capabilities in response metadata.
  - `download` response includes: returned variants, cache hit/miss, revision marker, and available variants.

## Risks / Trade-offs

- Risk: Legacy documents without preserved intrinsic IDs may require one-time ID backfill.
- Mitigation: Backfill IDs on open, persist immediately, and retain compatibility with existing `jr_para_*` bookmarks.

- Risk: Slightly more disk usage due to cached artifacts.
- Mitigation: TTL cleanup tied to session expiration and configurable max artifacts per session.

- Risk: Backward compatibility with existing callers that expect single-file downloads.
- Mitigation: Keep explicit override options and maintain compatibility mapping for legacy parameters.

## Migration Plan

1. Extend tool contract for variant defaults and metadata.
2. Implement persisted intrinsic node identity and one-time ID backfill where missing.
3. Add per-session artifact cache keyed by edit revision.
4. Ensure download path is read-only relative to active in-memory session mapping.
5. Add integration tests for default dual download, override behavior, and cache re-download.
6. Update tool documentation and examples.

## Open Questions

- Should the server expose a dedicated `list_download_artifacts` endpoint, or keep re-download entirely within `download`?
- Should variant override be represented as `variants: [..]` or an enum mode for stricter typing?
