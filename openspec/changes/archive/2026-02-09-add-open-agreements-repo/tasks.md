## 1. Scope and License Audit
- [x] 1.1 Confirm Common Paper + Bonterms CC BY 4.0 templates (drop oneNDA family — all CC BY-ND)
- [x] 1.2 Select 3rd template (Common Paper CSA)
- [x] 1.3 Draft attribution wording per CC BY 4.0 requirements
- [x] 1.4 Identify NVCA financing document recipes — all 7 confirmed with verified download URLs (5 core + 2 optional)

## 2. Repository Foundation
- [x] 2.1 Initialize TypeScript project (tsconfig, eslint, vitest)
- [x] 2.2 Set up Commander.js CLI with `fill`, `validate`, `list` commands
- [x] 2.3 Implement `docx-templates` wrapper (`src/core/engine.ts`)
- [x] 2.4 Define Zod schemas for template metadata
- [x] 2.5 Define ToolCommandAdapter interface + Claude Code adapter
- [x] 2.6 Create directory-per-template structure under `templates/`
- [x] 2.7 Create directory-per-recipe structure under `recipes/`
- [x] 2.8 Add `recipe` and `scan` CLI commands

## 2b. Recipe Engine
- [x] 2b.1 Implement DOCX cleaner (`src/core/recipe/cleaner.ts`): footnote removal + drafting note deletion via AdmZip + @xmldom/xmldom
- [x] 2b.2 Implement cross-run patcher (`src/core/recipe/patcher.ts`): char_map algorithm for replacing bracketed placeholders with template tags across split Word runs
- [x] 2b.3 Implement post-fill verifier (`src/core/recipe/verifier.ts`): confirm values present, no leftover placeholders/tags
- [x] 2b.4 Implement `scan` command: discover and classify bracketed placeholders in a user-supplied DOCX
- [x] 2b.5 Add smart quote normalization and XML-escape layer for context values
- [x] 2b.6 Add auto-download: fetch source DOCX from recipe `source_url` when `--input` not provided

## 3. Template Conversion
- [x] 3.1 Create Common Paper Mutual NDA as DOCX with `{tag}` placeholders + metadata.yaml
- [x] 3.2 Create Bonterms Mutual NDA as DOCX with `{tag}` placeholders + metadata.yaml
- [x] 3.3 Create Common Paper Cloud Service Agreement with same structure
- [x] 3.3b Enhance CSA template with `{IF}...{END-IF}` conditionals for radio/checkbox sections, computed display fields for multi-option rows, boolean coercion in engine.ts, IF/END-IF whitelist in validation
- [x] 3.4 Verify rendered output is faithful to source text

## 3b. ~~Recipe Authoring (NVCA Financing Documents)~~ SUPERSEDED

> **Decision (2026-02-08):** Recipes replaced by external templates approach. NVCA documents will be vendored unchanged as external templates (like YC SAFEs) and patched on demand from GitHub repo copies. This simplifies the UX while still complying with CC BY-ND derivative restrictions. The recipe engine code (Phase 2b) remains in the codebase but no new recipes will be authored.

- [x] 3b.4 Create recipe: `nvca-voting-agreement` (proof-of-concept, validated the approach)
- [~] 3b.1 Create recipe: `nvca-certificate-of-incorporation` — SUPERSEDED by external template approach
- [~] 3b.2 Create recipe: `nvca-stock-purchase-agreement` — SUPERSEDED
- [~] 3b.3 Create recipe: `nvca-investors-rights-agreement` — SUPERSEDED
- [~] 3b.5 Create recipe: `nvca-rofr-co-sale-agreement` — SUPERSEDED
- [~] 3b.6 Create recipe: `nvca-management-rights-letter` — SUPERSEDED
- [~] 3b.7 Create recipe: `nvca-indemnification-agreement` — SUPERSEDED
- [~] 3b.8 Test each recipe against its real NVCA DOCX — SUPERSEDED
- [~] 3b.9 Verify no .docx files committed to any recipe directory — SUPERSEDED
- [~] 3b.10 Write recipe READMEs — SUPERSEDED

## 4. Validation Pipeline
- [x] 4.1 Template validation: all metadata fields present, all DOCX placeholders matched to field list
- [x] 4.2 Recipe validation: replacement map valid, schema covers all targets, no .docx files in recipe dirs
- [x] 4.3 License validation: CC BY-ND templates cannot have derivatives generated
- [x] 4.4 Output validation: rendered DOCX preserves section count and structure of source
- [x] 4.5 CI workflow: GitHub Actions runs validation on every PR (templates + recipes)

## 5. Skill and Documentation
- [x] 5.1 Generate Claude Code slash command (`.claude/commands/open-agreements.md`)
- [x] 5.2 Generate agent-agnostic skill file (`skills/open-agreements-fill/SKILL.md`)
- [x] 5.3 Write README with usage, architecture, template contribution guide
- [x] 5.4 Write docs: getting-started, adding-templates, licensing, supported-tools
- [x] 5.5 Write docs: adding-recipes (recipe authoring guide)
- [x] 5.6 Add `--json` flag to `list` command for machine-readable template discovery
- [x] 5.7 Rename skill directory: open-agreements-fill/ → open-agreements/
- [x] 5.8 Rewrite SKILL.md with Agent Skills spec frontmatter + npx execution path
- [ ] 5.9 Validate skill against Agent Skills spec

## 5b. Packaging and Distribution Readiness
- [x] 5b.1 Add "files" allowlist to package.json
- [x] 5b.2 Add "prepack" script
- [x] 5b.3 Move @types/adm-zip to devDependencies
- [x] 5b.4 Create packaging smoke test
- [x] 5b.5 Verify SKILL.md version matches package.json (both 0.1.0)

## 5c. List Command Improvements
- [x] 5c.1 Add source_url, attribution_text to template JSON
- [x] 5c.2 Add recipe-specific fields to JSON (license_note, source_version, optional, requires_source_docx, download_instructions)
- [x] 5c.3 Sort list --json by name
- [x] 5c.4 Add --json-strict flag
- [x] 5c.5 Add --templates-only / --recipes-only filters

## 5d. SKILL.md Improvements
- [x] 5d.1 Replace `which` with `command -v`
- [x] 5d.2 Add version check for global install
- [x] 5d.3 Remove static template table
- [x] 5d.4 Add recipe-specific UX flow

## 6. Publishing and Distribution
- [x] 6.4 Rename npm package from @usejunior/open-agreements to open-agreements (all refs)
- [ ] 6.5 Create @openagreements npm org
- [ ] 6.6 Enable npm 2FA, publish open-agreements@0.1.0
- [ ] 6.7 Create + push GitHub repo open-agreements/open-agreements
- [ ] 6.8 Add GitHub topics for discoverability
- [ ] 6.9 Seed skills.sh index: `npx skills add open-agreements/open-agreements`
- [x] 6.10 Add skills.sh + Smithery badges to README
- [ ] 6.11 Make repo public
- [ ] 6.1 Publish npm package
- [ ] 6.2 Record demo: Claude Code filling an NDA via the skill
- [ ] 6.12 Record demo: skill working via npx (zero pre-install DOCX generation)
