# LLM-Based Quality Gate — Checklist

Each `- [ ] <question>` line below becomes one independent Gemini call on every PR. The workflow parses this file at runtime; you can add, edit, or remove items here without touching workflow YAML.

Author guidance:
- Phrase items as **questions a careful reviewer would ask**, not abstract category labels.
- One question per line. The whole question must be on the same line.
- Reference concrete paths in the question when you can — the model uses them as search hints.
- Keep the list focused. The whole point of one-question-per-call is that each call stays simple and the model can focus.

## Active items

- [ ] **Code reuse**: Does this PR introduce a new helper, parser, formatter, or utility that re-implements logic already present in `src/utils/`, `src/core/`, `src/commands/`, or any `packages/*/src/`? Cite both the new code and the existing helper.
- [ ] **Template / canonical-source semantic fidelity**: If this PR modifies a `content/templates/*/template.md`, `content/templates/*/template.json`, or `content/templates/*/metadata.yaml`, are user-facing field semantics preserved? Specifically: are any required fields silently dropped or renamed, are placeholder tags removed without a corresponding metadata change, and does the change risk breaking downstream DOCX rendering or recipe playback in ways `validate.yml` would not catch?
- [ ] **Cross-file consistency on removals**: If this PR deletes a feature, option, function, or script (or a CLI flag, or a config key), are all references cleanly removed across the codebase? Look in `src/`, `packages/*/src/`, `api/`, `scripts/`, `integration-tests/`, and `docs/`. This catches the `templatesOnly` class of bug where the same removal had to be re-applied across PRs.
- [ ] **MCP contract consistency**: If this PR adds or modifies an MCP tool in `src/`, `packages/contracts-workspace-mcp/`, `packages/contract-templates-mcp/`, `packages/checklist-mcp/`, or `api/_*`, does the tool's input/output schema match the documented envelope shape (see `packages/contracts-workspace/` types and the shared envelope used by `signing/`)? Are errors normalized through the shared envelope rather than thrown raw? Are tool names, versions, and capabilities in sync between `gemini-extension.json`, `mcp.json`, the implementation file, and any tests under `integration-tests/`?
