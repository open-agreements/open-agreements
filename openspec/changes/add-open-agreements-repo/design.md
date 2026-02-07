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
- **Recipe pre-processing: PizZip + fast-xml-parser** — Recipes need XML-level surgery (footnote removal, run modification) before the template engine can fill. PizZip (sync zip) handles DOCX-as-zip access. fast-xml-parser handles OOXML parsing.
- **Two-tier architecture** — Templates (CC BY 4.0, hosted directly) and Recipes (non-redistributable, transformation instructions only). Recipes never contain copyrighted content. This is analogous to how Linux distributions ship scripts to download and install proprietary firmware.
- **Architecture: OpenSpec-inspired** — Commander.js CLI, ToolCommandAdapter interface, Zod schemas. Mirrors the patterns in [OpenSpec](https://github.com/Fission-AI/OpenSpec) for consistency.
- **Template layout: directory-per-template** — Each template is self-contained (`template.docx` + `metadata.yaml` + `README.md`). Simplifies contribution, licensing, and validation.
- **Recipe layout: directory-per-recipe** — Each recipe contains `replacements.json` + `schema.json` + `metadata.yaml` + `clean.json` + `README.md`. No `.docx` files allowed (enforced by CI).
- **Delimiter: `{tag}` syntax** — `docx-templates` supports configurable delimiters. Single curly braces are intuitive for legal template authors and unlikely to conflict with DOCX content. Recipes patch source documents from `[bracketed]` placeholders to `{tag}` syntax.
- **Cross-run replacement algorithm** — Word splits text into XML "runs" unpredictably, so `[Company Name]` may span multiple `<w:r>` elements. The recipe patcher uses a char_map approach: concatenate all run texts, find matches, map character positions back to runs, and splice replacements. Keys sorted longest-first to prevent partial matches.
- **Data collection: AskUserQuestion** — Claude interviews users via multiple rounds of up to 4 questions, grouped by template section. No web forms or CLI prompts needed.
- **Validation: 5-level pipeline** — Template fields → recipe structure → license compliance → output structure → CI. Each level catches different classes of errors.

## Risks / Trade-offs
- `docx-templates` may not handle complex DOCX formatting (tables, nested lists) — Mitigation: standard agreements are mostly prose; test with actual templates early.
- Template versioning when upstream sources update — Mitigation: pin version in metadata.yaml, check upstream periodically.
- NVCA document structure may change between versions — Mitigation: pin `source_version` in recipe metadata, validate input DOCX structure before patching.
- Word run splitting is unpredictable across editing environments — Mitigation: cross-run char_map algorithm with fallback (merge runs then replace).
- Smart quotes and XML special characters — Mitigation: replacement maps include both Unicode and ASCII variants; context values are XML-escaped before rendering.

## Migration Plan
Not applicable — new repository with no existing code to migrate.

## Open Questions
- Preferred npm scope: `@usejunior/open-agreements` or `@openagreements/cli`?
- How many NVCA documents to support in v1: just the 5 core, or all 7 including optional?
