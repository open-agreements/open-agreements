## Context
An open-source tool for filling standard legal agreement templates. The tool is distributable via npm, usable from Claude Code as a skill, and extensible to other coding agents.

## Goals / Non-Goals
- Goals:
  - TypeScript CLI and library for DOCX template filling
  - Two-tier architecture: hosted templates + recipes for non-redistributable documents
  - Agent-agnostic skill architecture (Claude Code adapter for v1)
  - License compliance enforcement (CI + runtime validation)
  - npm distribution
- Non-Goals:
  - Server-side rendering or hosted API
  - PDF output (DOCX only for v1)
  - Template authoring GUI
  - Hosting copyrighted content (non-CC templates are supported via recipes, not by hosting the source DOCX)

## Decisions
- **Language: TypeScript** — Aligns with OpenSpec model and npm distribution. Python was considered but TS provides better type safety for template schemas and matches the existing OpenSpec architecture. A Python prototype validated the recipe approach before committing to TypeScript.
- **DOCX engine: `docx-templates`** — MIT licensed, 48K weekly npm downloads, TypeScript-native, configurable delimiters. Chosen over `easy-template-x` (lower adoption) and `docxtemplater` (proprietary license for advanced features). Used by both template and recipe tiers for the final fill step.
- **Recipe pre-processing: @xmldom/xmldom** — Recipes need XML-level surgery (footnote removal, run modification) before the template engine can fill. AdmZip handles DOCX-as-zip access. @xmldom/xmldom handles OOXML parsing.
- **Two-tier architecture** — Internal templates (CC BY 4.0, hosted directly with `{tag}` placeholders) and External templates (CC BY-ND 4.0, vendored unchanged under `external/` with `source_sha256` for integrity). Both use the same `fill` command. External templates produce transient derivatives that exist only on the user's machine. _Originally designed as "templates + recipes" where recipes contained transformation instructions for non-redistributable documents. Simplified to external templates (2026-02-08) after the YC SAFE external template pattern proved simpler._
- **Architecture: OpenSpec-inspired** — Commander.js CLI, ToolCommandAdapter interface, Zod schemas. Mirrors the patterns in [OpenSpec](https://github.com/Fission-AI/OpenSpec) for consistency.
- **Template layout: directory-per-template** — Each template is self-contained (`template.docx` + `metadata.yaml` + `README.md`). Simplifies contribution, licensing, and validation.
- **Recipe layout: directory-per-recipe** — Each recipe contains `replacements.json` + `schema.json` + `metadata.yaml` + `clean.json` + `README.md`. No `.docx` files allowed (enforced by CI).
- **Delimiter: `{tag}` syntax** — `docx-templates` supports configurable delimiters. Single curly braces are intuitive for legal template authors and unlikely to conflict with DOCX content. Recipes patch source documents from `[bracketed]` placeholders to `{tag}` syntax.
- **Cross-run replacement algorithm** — Word splits text into XML "runs" unpredictably, so `[Company Name]` may span multiple `<w:r>` elements. The recipe patcher uses a char_map approach: concatenate all run texts, find matches, map character positions back to runs, and splice replacements. Keys sorted longest-first to prevent partial matches.
- **Data collection: AskUserQuestion** — Claude interviews users via multiple rounds of up to 4 questions, grouped by template section. No web forms or CLI prompts needed.
- **Validation: 5-level pipeline** — Template fields → recipe structure → license compliance → output structure → CI. Each level catches different classes of errors.

- **npm packaging: `"files"` allowlist over `.npmignore`** — `"files"` is a positive allowlist that overrides `.gitignore` for npm, ensuring `dist/` is included in the tarball even though it's git-ignored. Safer than `.npmignore` which is a denylist and can accidentally include sensitive files.
- **`list --json` schema: distinct field names by type** — Templates emit `license` (SPDX enum), recipes emit `license_note` (human string). Intentionally different field names to prevent agents from confusing license types.
- **SKILL.md runtime detection: `command -v` over `which`** — `command -v` is POSIX-compliant and behaves consistently across platforms. `which` is not POSIX and has inconsistent behavior on different shells/OS.

## Risks / Trade-offs
- `docx-templates` may not handle complex DOCX formatting (tables, nested lists) — Mitigation: standard agreements are mostly prose; test with actual templates early.
- Template versioning when upstream sources update — Mitigation: pin version in metadata.yaml, check upstream periodically.
- NVCA document structure may change between versions — Mitigation: pin `source_version` in recipe metadata, validate input DOCX structure before patching.
- Word run splitting is unpredictable across editing environments — Mitigation: cross-run char_map algorithm with fallback (merge runs then replace).
- Smart quotes and XML special characters — Mitigation: replacement maps include both Unicode and ASCII variants; context values are XML-escaped before rendering.
- skills.sh indexing mechanism is unverified — relies on `npx skills add` telemetry, which is assumed but not confirmed.
- Smithery.ai is MCP-focused — Agent Skills support is uncertain per current docs.
- `.claude-plugin/plugin.json` schema has no authoritative primary source — best-effort based on observed examples.

## Migration Plan
Not applicable — new repository with no existing code to migrate.

- **Naming**: `open-agreements` (hyphenated) on npm, GitHub org, CLI binary, skill name. Marketing uses "Open Agreements" (no hyphen). Also create `@openagreements` npm org for future governance. Replaces prior `@usejunior/open-agreements` scoped name.
- **Skills.sh distribution**: Agent Skills spec-compliant skill, uses `npx -y open-agreements@<version>` for zero-install DOCX rendering. skills.sh indexes repos via install telemetry — seed the first install ourselves, then drive installs via README badge, demo, social posts.
- **Template discovery via CLI**: `list --json` provides machine-readable metadata so the skill discovers fields dynamically rather than maintaining a static duplicate.
- **GitHub topics for discoverability**: Add topics: `agent-skills`, `claude-code-skills`, `legal-templates`, `nda-template`, `contract-automation`, `docx`, `legal-tech`, `open-source-legal`.
- **Smithery.ai**: Additional skills directory (100K+ skills). Add Smithery badge to README.

## Open Questions
- ~~Preferred npm scope: `@usejunior/open-agreements` or `@openagreements/cli`?~~ Resolved: `open-agreements` (unscoped).
- ~~How many NVCA documents to support in v1: just the 5 core, or all 7 including optional?~~ Resolved: Recipe approach superseded by external templates. NVCA documents will be added as external templates in a future change.
