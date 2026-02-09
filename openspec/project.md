# Project Context

## Purpose
OpenAgreements is an open-source TypeScript CLI and library for filling standard legal agreement DOCX templates with variable substitution. It supports two tiers:

1. **Templates** (CC BY 4.0): Hosted DOCX templates with `{tag}` placeholders, ready to fill
2. **Recipes** (non-redistributable): Transformation instructions that clean and patch a user-supplied DOCX into a fillable template (no copyrighted content in the repo)

## Tech Stack
- TypeScript (Node.js >=20, ESM)
- Commander.js (CLI framework)
- docx-templates (DOCX rendering, MIT, configurable delimiters)
- @xmldom/xmldom (recipe DOCX XML editing — DOM-compatible, preserves namespaces)
- AdmZip (DOCX zip handling — used by both template validation and recipe engine)
- Zod (schema validation)
- Vitest (testing)
- AdmZip (DOCX content extraction for validation)

## Project Conventions

### Code Style
- ESM modules (`"type": "module"` in package.json)
- Strict TypeScript (`strict: true`)
- Snake_case for template field names (matches legal document conventions)
- Kebab-case for template/recipe directory names
- Exports use `.js` extension in imports (Node16 module resolution)

### Architecture Patterns
- **Directory-per-template/recipe**: Each template or recipe is self-contained
- **ToolCommandAdapter interface**: Agent-agnostic skill generation — implement once, support many coding agents
- **Validation pipeline**: Metadata → template fields → license compliance → output structure → CI
- **OpenSpec-inspired**: CLI structure mirrors OpenSpec patterns (Commander.js, Zod, npm distribution)

### Testing Strategy
- Unit tests with Vitest for core modules (engine, metadata, validation)
- Integration tests: fill a template end-to-end, verify output DOCX content
- CI runs `open-agreements validate` on every PR

### Git Workflow
- `main` branch is the default
- Feature branches for new templates, recipes, or capabilities
- Conventional commits (`feat:`, `fix:`, `docs:`, `chore:`)
- Develop as if public from day one — no secrets or internal references in commits

## Domain Context
- Standard legal agreements (NDAs, cloud terms, service agreements) use bracketed placeholders like `[Company Name]` in their source DOCX files
- Word splits text into XML "runs" unpredictably, so `[Company Name]` may span multiple `<w:r>` elements — the recipe engine handles this with cross-run replacement
- Template sources have varying licenses — only CC BY 4.0 and CC0 allow derivative works
- NVCA model documents are freely downloadable but not redistributable — hence the recipe approach

## Important Constraints
- **License compliance**: Never host CC BY-ND content or create derivatives of non-derivative-licensed templates
- **No copyrighted content in recipes**: Recipe directories must never contain `.docx` files (enforced by CI)
- **Attribution required**: CC BY 4.0 templates must include attribution text in output
- **Smart quotes**: Real legal DOCX files use Unicode curly quotes — replacement maps must handle both smart and straight variants
- **XML escaping**: Context values with `&`, `<`, `>` must be XML-escaped before template rendering

## External Dependencies
- [Common Paper](https://commonpaper.com) — CC BY 4.0 agreement templates
- [Bonterms](https://bonterms.com) — CC BY 4.0 agreement templates
- [NVCA](https://nvca.org) — Model financing documents (recipe-based, not redistributable)
- [docx-templates](https://www.npmjs.com/package/docx-templates) — MIT DOCX rendering engine
