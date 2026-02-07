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
- [ ] 2.7 Create directory-per-recipe structure under `recipes/`
- [ ] 2.8 Add `recipe` and `scan` CLI commands

## 2b. Recipe Engine
- [ ] 2b.1 Implement DOCX cleaner (`src/core/recipe/cleaner.ts`): footnote removal + drafting note deletion via PizZip + fast-xml-parser
- [ ] 2b.2 Implement cross-run patcher (`src/core/recipe/patcher.ts`): char_map algorithm for replacing bracketed placeholders with template tags across split Word runs
- [ ] 2b.3 Implement post-fill verifier (`src/core/recipe/verifier.ts`): confirm values present, no leftover placeholders/tags
- [ ] 2b.4 Implement `scan` command: discover and classify bracketed placeholders in a user-supplied DOCX
- [ ] 2b.5 Add smart quote normalization and XML-escape layer for context values
- [ ] 2b.6 Add auto-download: fetch source DOCX from recipe `source_url` when `--input` not provided

## 3. Template Conversion
- [x] 3.1 Create Common Paper Mutual NDA as DOCX with `{tag}` placeholders + metadata.yaml
- [x] 3.2 Create Bonterms Mutual NDA as DOCX with `{tag}` placeholders + metadata.yaml
- [x] 3.3 Create Common Paper Cloud Service Agreement with same structure
- [x] 3.4 Verify rendered output is faithful to source text

## 3b. Recipe Authoring (NVCA Financing Documents)

Core documents (required for any NVCA financing):
- [ ] 3b.1 Create recipe: `nvca-certificate-of-incorporation`
- [ ] 3b.2 Create recipe: `nvca-stock-purchase-agreement`
- [ ] 3b.3 Create recipe: `nvca-investors-rights-agreement`
- [ ] 3b.4 Create recipe: `nvca-voting-agreement`
- [ ] 3b.5 Create recipe: `nvca-rofr-co-sale-agreement`

Optional documents:
- [ ] 3b.6 Create recipe: `nvca-management-rights-letter` (marked optional in metadata)
- [ ] 3b.7 Create recipe: `nvca-indemnification-agreement` (marked optional in metadata)

Validation:
- [ ] 3b.8 Test each recipe against its real NVCA DOCX (auto-downloaded from source_url)
- [ ] 3b.9 Verify no .docx files committed to any recipe directory
- [ ] 3b.10 Write recipe READMEs

## 4. Validation Pipeline
- [x] 4.1 Template validation: all metadata fields present, all DOCX placeholders matched to field list
- [ ] 4.2 Recipe validation: replacement map valid, schema covers all targets, no .docx files in recipe dirs
- [x] 4.3 License validation: CC BY-ND templates cannot have derivatives generated
- [x] 4.4 Output validation: rendered DOCX preserves section count and structure of source
- [x] 4.5 CI workflow: GitHub Actions runs validation on every PR (templates + recipes)

## 5. Skill and Documentation
- [x] 5.1 Generate Claude Code slash command (`.claude/commands/open-agreements.md`)
- [x] 5.2 Generate agent-agnostic skill file (`skills/open-agreements-fill/SKILL.md`)
- [x] 5.3 Write README with usage, architecture, template contribution guide
- [x] 5.4 Write docs: getting-started, adding-templates, licensing, supported-tools
- [ ] 5.5 Write docs: adding-recipes (recipe authoring guide)

## 6. Publishing
- [ ] 6.1 Publish npm package
- [ ] 6.2 Record demo: Claude Code filling an NDA via the skill
- [ ] 6.3 Record demo: Claude Code running NVCA recipe
