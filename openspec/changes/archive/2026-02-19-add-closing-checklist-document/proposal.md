# Change: Add closing checklist document type

## Why

OpenAgreements currently handles only template fill workflows — NDAs, SAFEs,
employment docs, and cloud services agreements. Deal closings involve a separate
category of work: tracking action items, open issues, document statuses, and
working group members across parties. Adding a closing checklist document type
expands OpenAgreements into legal operations tooling while reusing the existing
.docx rendering and MCP infrastructure.

## What Changes

- Add `ClosingChecklistSchema` (Zod) with enums for item status, issue status,
  escalation tier, and document status, plus structured arrays for working group,
  documents, action items, and open issues.
- Add `create_closing_checklist` MCP tool that validates input, renders a .docx
  via docx-templates, and returns a download URL.
- Add `open-agreements checklist create` and `checklist render` CLI commands.
- Add closing-checklist template (template.docx + metadata.yaml) under
  `content/templates/closing-checklist/`.
- Add Zod runtime validation to existing `fill_template` and `list_templates`
  MCP handlers (Phase 0 cleanup).

## Scope Boundaries

### In scope
- Bilateral issue positions (our_position / their_position)
- .docx and Markdown rendering
- MCP and CLI interfaces
- Zod validation for all MCP tool handlers

### Out of scope
- Multi-party issue positions (can be added later)
- Server-side state or update merging
- Schema versioning (too early for v1)

## Impact
- Affected specs: open-agreements
- Affected code:
  - `src/core/checklist/` (new module: schemas, rendering)
  - `src/commands/checklist.ts` (new CLI command)
  - `api/mcp.ts` (new tool + Zod validation for existing tools)
  - `api/_shared.ts` (new handler)
  - `content/templates/closing-checklist/` (new template)
  - `src/index.ts` (exports)
  - `src/cli/index.ts` (command registration)
- Compatibility: additive/non-breaking
