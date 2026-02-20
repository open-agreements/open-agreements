## Context

Safe-Docx has mature core edit tools, but comment authoring — the most-requested missing helper — requires new OOXML primitives. Additionally, `smart_edit` can't find text fragmented across format-identical runs without prior normalization. This change adds `add_comment` as a new MCP tool and enhances `smart_edit` with an optional `normalize_first` flag.

## Goals / Non-Goals

- Goals:
  - Add comment authoring (root comments + threaded replies) as a first-class MCP tool.
  - Enhance `smart_edit` to handle text fragmented across format-identical runs via `normalize_first`.
  - Preserve existing Safe-Docx safety invariants (stable anchors, deterministic edits, path policy constraints).
- Non-Goals:
  - Full Office-suite parity beyond DOCX.
  - Standalone MCP tools for merge_runs, simplify_redlines, or validate_document.
  - PDF conversion.

## Decisions

- Decision: Add `add_comment` as a new MCP tool with root and reply modes.
  - Rationale: Comment authoring is the most-requested missing capability. Detection is simple: if `parent_comment_id` is provided, use reply mode; otherwise use root comment mode with `target_paragraph_id`.

- Decision: Drop `convert_to_pdf` entirely.
  - Rationale: LibreOffice dependency is too heavy for a local MCP package. Host OS compatibility issues and socket-restricted runtimes make this unreliable.

- Decision: Keep `merge_runs`, `simplify_redlines`, `validate_document` as internal primitives, not MCP tools.
  - Rationale: These operations are already exercised through normalize-on-open (merge_runs + simplify_redlines) and validate-before-download (validate_document). Exposing them as standalone MCP tools would add API surface complexity without clear user benefit — callers rarely need to invoke these independently.

- Decision: Absorb `replace_text` into `smart_edit` via `normalize_first` option.
  - Rationale: `smart_edit` already covers formatting-preserving replacement. The only missing capability was handling text fragmented across runs, which `normalize_first` addresses. A separate `replace_text` tool would duplicate existing functionality.

- Decision: Package comment XML templates as inline strings, not external skeleton files.
  - Rationale: Comment insertion must work on files that do not yet contain comment parts; bootstrapping must be deterministic and self-contained. Inline templates avoid file-path resolution complexity.

- Decision: Keep DocxDocument.zip private — no public accessor.
  - Rationale: All comment operations route through DocxDocument methods (addComment, addCommentReply). This preserves encapsulation and the dirty/cache-invalidation contract.

- Decision: Create `mergeRunsOnly()` as distinct from `normalize()`.
  - Rationale: `normalize()` calls both `mergeRuns` and `simplifyRedlines`. The `normalize_first` option on `smart_edit` should only merge runs without touching redline wrappers, avoiding unintended side effects on tracked changes.

## Risks / Trade-offs

- OOXML comment mutations can unintentionally alter unrelated XML.
  - Mitigation: Scope helpers to targeted nodes, add regression fixtures, and verify round-trip in unit tests.
- New tool increases API surface complexity.
  - Mitigation: Keep schema narrow, document strict defaults, and reuse existing session/path policies.

## Migration Plan

1. Land docx-primitives comment module with unit coverage.
2. Expose `add_comment` MCP tool behind explicit schema in Safe-Docx server.
3. Add `normalize_first` option to `smart_edit` schema.
4. Add integration tests with OpenSpec traceability.
5. Roll out with no breaking changes to existing tool contracts.

## Open Questions

- (Resolved) Should `replace_text` be a distinct tool or extend `smart_edit`? → Absorbed into `smart_edit` via `normalize_first`.
- (Resolved) Should `convert_to_pdf` require explicit output path? → Dropped entirely.
