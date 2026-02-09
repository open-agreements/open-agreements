# Project Context

## Purpose
OpenAgreements is an open-source TypeScript CLI and library for filling standard legal agreement DOCX templates with variable substitution. It supports three tiers:

1. **Internal templates** (CC BY 4.0): Hosted DOCX templates with `{tag}` placeholders under `templates/`, shipped in the npm package
2. **External templates** (CC BY-ND 4.0): Vendored unchanged under `external/`, shipped in the npm package. CC BY-ND allows redistribution of unmodified copies.
3. **Recipes** (not redistributable): Transformation instructions only under `recipes/`. Source DOCX downloaded at runtime from publisher URL (e.g., nvca.org). No copyrighted content in the repo.

## Tech Stack
- TypeScript (Node.js >=20, ESM)
- Commander.js (CLI framework)
- docx-templates (DOCX rendering, MIT, configurable delimiters)
- @xmldom/xmldom (recipe DOCX XML editing — DOM-compatible, preserves namespaces)
- AdmZip (DOCX zip handling — used by both template validation and recipe engine)
- Zod (schema validation)
- Vitest (testing)

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
- NVCA model documents are freely downloadable but not redistributable — hence the recipe approach (download at runtime, never vendor)
- YC SAFEs are CC BY-ND 4.0 which permits redistribution of unmodified copies — hence vendoring unchanged in `external/`

## Important Constraints
- **License compliance**: Never host CC BY-ND content or create derivatives of non-derivative-licensed templates
- **No copyrighted content in recipes**: Recipe directories must never contain `.docx` files (enforced by CI)
- **Attribution required**: CC BY 4.0 templates must include attribution text in output
- **Smart quotes**: Real legal DOCX files use Unicode curly quotes (`U+2018`/`U+2019` single, `U+201C`/`U+201D` double) — replacement keys in JSON must use Unicode escapes (`\u2019` etc.) to match. The `scan` tool reports these correctly; do not "fix" them to straight quotes.
- **HTML entities in scanner vs DOM**: The `scan` tool reports raw XML text (e.g., `&amp;`), but the patcher operates on DOM-parsed text where entities are decoded (e.g., `&`). Replacement keys must use the decoded form.
- **XML escaping**: Context values with `&`, `<`, `>` must be XML-escaped before template rendering

## Gotchas (Learned the Hard Way)

### Three-tier license distinction
CC BY-ND 4.0 allows redistribution of UNMODIFIED copies (YC SAFEs → `external/`).
NVCA documents are freely downloadable but NOT redistributable at all (→ `recipes/`).
These are different. Do not confuse "no derivatives" with "no redistribution."

### npm `files` allowlist must include all content directories
Every content directory (`templates/`, `external/`, `recipes/`, `skills/`) must be listed
in the `"files"` array in `package.json`. If you add a new content directory, add it to
`files` or it won't ship in the tarball. Verify with `npm publish --dry-run`.

### package.json needs `repository`, `homepage`, `bugs`
Without these, the npm package page has no links to GitHub. Set them before first publish.

### Use `fileURLToPath()` not `new URL().pathname` for file paths
`new URL().pathname` produces `/C:/path` on Windows which breaks `fs` operations.
Always use `fileURLToPath(import.meta.url)` from `node:url`.

### `sourceName()` returns `string | null` — callers must handle null
JSON output gets `null` (correct for machine consumption).
Table output must coalesce with `?? '—'` for display.

### Template field warnings in CSA are expected
The CSA template has many optional computed fields (for IF/ENDIF conditionals) that exist
in `metadata.yaml` but not as raw `{tag}` placeholders in the DOCX. The validator correctly
reports these as warnings, not errors.

### Replacement keys must match actual document text
Do NOT guess placeholder labels. Always run `scan` or extract text from the DOCX to get
exact bracket patterns. Common mistakes: signature-page labels differ from body text,
case mismatches, different underscore counts, date patterns split across separate bracket
groups. See `docs/adding-recipes.md` Step 4 for full details.

### Surgical patcher preserves formatting on context-based keys
When a replacement key includes surrounding context text for disambiguation (e.g.,
`"among [____________], a Delaware"` → `"among {company_name}, a Delaware"`), the patcher
automatically computes common prefix/suffix and only modifies the differing middle portion
in the XML. This preserves run-level formatting (bold, italic, font) on the context text.
No special syntax needed — fully backwards compatible.

### adm-zip data descriptor bug
Some DOCX files use streaming (bit 3) data descriptor flags. adm-zip's `updateFile()` /
`writeZip()` / `toBuffer()` handle these incorrectly, producing corrupt output. The patcher
works around this by rebuilding the zip from scratch using `addFile()` on a new `AdmZip()`
instance instead of mutating the original.

### Placeholders inside DOCX comments are not rendered
Some Common Paper documents embed bracketed placeholders inside Word comment blocks
(`w:comment` elements). These are not visible in the rendered document and should NOT be
listed as fields in `metadata.yaml`. The validator will correctly report them as missing.
Always verify placeholder locations by inspecting the rendered document, not just scanning
raw XML.

### Smart quotes require Unicode escapes in JSON replacement keys
Common Paper DOCX files use curly/smart quotes: single (`\u2018`/`\u2019`) and double
(`\u201c`/`\u201d`). When building `replacements.json` from `scan` output, use the exact
Unicode escapes — do not replace with straight ASCII quotes. Example:
`"Customer\u2019s receipt"` (correct) vs `"Customer's receipt"` (wrong — won't match).

### Scanner reports raw XML entities; patcher uses decoded text
The `scan` command reports text from raw XML, so `&amp;` appears literally. But `patchDocument()`
parses XML into a DOM where entities are decoded (`&amp;` → `&`). Replacement keys must use
the decoded form: `"name & date"` not `"name &amp; date"`.

### Currency values and double dollar signs
When a template has `$[amount]` (dollar sign before the placeholder), the patched template
becomes `${field_name}`. If a user provides `$1,000,000`, the output is `$$1,000,000`.
The `sanitizeCurrencyValues()` utility in `fill-utils.ts` auto-detects `${field}` patterns
in replacements and strips leading `$` from user values. The verifier also checks for
`$$` in output text (Check 5).

### Blank field placeholder behavior
Fields without a `default` key in metadata render as `_______` (7 underscores) when not
provided by the user — a visible indicator that the field needs filling. Fields with
`default: ""` (explicit empty string) render as empty — use this for optional fields that
should be invisible when absent (like `amended_restated`).

### NVCA brackets serve two purposes
NVCA documents use brackets for both fill-in fields (`[Company Name]`, `[____________]`)
and optional/alternative clauses (`[or consultant (excluding service solely as member of
the Board)]`). Only fill-in fields belong in `replacements.json`. Optional clauses should
be left as-is for the drafter to decide.

### Vendoring hygiene: prune before commit
If you vendor or copy a package into this repo, prune non-production artifacts before committing.
Do not commit generated reports, large fixture outputs, node_modules, or dist artifacts.
This avoids permanently bloating git history and slowing clones/CI.

### CI must run tests, not just validate
The command open-agreements validate is necessary but not sufficient. CI should also run npm test and npm run build
so regressions are caught even when validation still passes.

### Publishing guardrail: verify tarball contents
Always run npm pack or npm publish --dry-run and inspect the tarball. Confirm dist/, bin/, and all content
directories listed in package.json#files are present. Ensure runtime dependencies are declared explicitly and do not rely
on hoisting (phantom dependencies).

### Workspaces are an explicit choice
If we ever adopt npm workspaces/monorepo structure, set the repo root package to private: true and re-verify publishing
behavior for the root package. Workspaces change install/hoisting semantics and can mask missing dependency declarations.

### Do not use symlinks for vendored packages
Symlinks are brittle across platforms and typically do not survive npm packing/publishing. Prefer copy or subtree workflows.


## External Dependencies
- [Common Paper](https://commonpaper.com) — CC BY 4.0 agreement templates
- [Bonterms](https://bonterms.com) — Cover pages are CC0 1.0; standard terms (incorporated by reference, not redistributed) are CC BY 4.0
- [Y Combinator](https://www.ycombinator.com/documents) — CC BY-ND 4.0 SAFE templates (vendored unchanged)
- [NVCA](https://nvca.org) — Model financing documents (recipe-based, not redistributable)
- [docx-templates](https://www.npmjs.com/package/docx-templates) — MIT DOCX rendering engine
