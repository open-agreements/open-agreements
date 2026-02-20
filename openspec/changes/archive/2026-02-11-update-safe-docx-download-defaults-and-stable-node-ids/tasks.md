## 1. Spec Alignment

- [x] 1.1 Confirm overlap and merge plan with `add-typescript-mcp-server` for `mcp-server` capability ownership.
- [x] 1.2 Confirm compatibility expectations with `standardize-internal-paragraph-id-format` and `add-document-session-foundation`.

## 2. Node Identity

- [x] 2.1 Implement persisted intrinsic paragraph IDs as canonical identity for MCP sessions.
- [x] 2.2 Implement one-time ID backfill for paragraphs missing intrinsic IDs.
- [x] 2.3 Add tests proving unchanged paragraphs keep IDs when unrelated paragraphs are inserted.
- [x] 2.4 Add tests proving IDs are stable after open/read/download cycles in the same session.

## 3. Download Defaults and Overrides

- [x] 3.1 Update `download` contract so default behavior returns both `clean` and `redline` variants.
- [x] 3.2 Preserve explicit override path for one-variant downloads.
- [x] 3.3 Maintain compatibility behavior for any legacy download parameters.

## 4. Session Artifact Re-Download

- [x] 4.1 Add session artifact cache keyed by session ID and edit revision.
- [x] 4.2 Return cache-hit metadata in download responses.
- [x] 4.3 Invalidate prior revision artifacts when a new edit is committed.
- [x] 4.4 Add tests proving repeated downloads do not replay edits.

## 5. Anchor Stability and Transparency

- [x] 5.1 Ensure download generation does not mutate active anchor mappings.
- [x] 5.2 Add integration test verifying paragraph IDs before/after download are identical.
- [x] 5.3 Update tool descriptions/docs to clearly state default dual download and re-download semantics.
