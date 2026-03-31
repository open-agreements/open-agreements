# Change: Add contract indexing and search

## Why
A short-staffed GC constantly asked "What contract do we have with X?" has no way to search their contract portfolio. Documents sit in Google Drive folders with no intelligence layer. AI agents using the workspace MCP can organize files but know nothing about what's inside them.

## What Changes
- **contracts-workspace**: Make lifecycle folders optional (not enforced), walk all non-ignored directories when collecting documents, filter by document extensions
- **contract-indexing** (new capability): 4 MCP tools for indexing, retrieving, listing unindexed, and searching contracts. Per-document `.contract.yaml` sidecar files. BM25 in-memory search via MiniSearch. Document type validation (15 canonical + custom). Orphan detection. Atomic sidecar writes.

## Impact
- Affected specs: contracts-workspace (minimal delta), contract-indexing (new)
- Affected code: `packages/contracts-workspace/src/core/`, `packages/contracts-workspace-mcp/src/core/`
- **Backward compatible** — lifecycle folders still work, all new fields optional
