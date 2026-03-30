# Change: Add contract analysis layer

## Why
AI agents using the contracts-workspace MCP can organize and index documents but have no way to store, retrieve, or query analysis results (classification, clause extractions, dates, parties). An understaffed GC needs to answer "What expires this quarter?" and "Which vendor contracts lack mutual indemnification?" without manually reviewing every file.

## What Changes
- Add 5 new MCP tools for storing, reading, querying, and suggesting renames based on contract analysis
- Add per-document `.analysis.yaml` sidecar files in `.contracts-workspace/analysis/documents/`
- Extend `contracts-index.yaml` with optional analysis summary and per-document classification fields
- Add `document_id` (stable 8-char hex) for rename/move reconciliation
- Add staleness tracking via `content_hash` comparison

## Impact
- Affected specs: contracts-workspace
- Affected code: `packages/contracts-workspace/src/core/`, `packages/contracts-workspace-mcp/src/core/tools.ts`
- **No breaking changes** — all new fields are optional, existing tools unchanged
