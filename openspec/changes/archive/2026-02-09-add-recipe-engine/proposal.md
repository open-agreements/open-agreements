# Change: Add recipe engine and fix template-tier bugs

## Why
The template tier only supports CC BY 4.0 documents hosted directly in the repo.
Many valuable standard-form documents (NVCA financing docs, AIPLA patent licenses)
cannot be redistributed. A recipe engine enables OpenAgreements to work with these
by hosting only transformation instructions — never copyrighted content.

Additionally, a peer review identified bugs in the existing template tier that
should be fixed before building on top of it: the template validator never produces
errors (only warnings), output validation scans raw ZIP bytes instead of extracted
XML, the CI license check breaks on multi-commit PRs, and template rendering runs
with sandboxing disabled despite plans to accept contributed templates.

## What Changes

### Recipe engine (new)
- New dependency: @xmldom/xmldom (DOM-compatible XML parser for OOXML editing)
- Recipe engine core: downloader, cleaner, patcher, verifier (`src/core/recipe/`)
- Recipe CLI subcommands: `recipe run` / `recipe clean` / `recipe patch`, `scan`
- Recipe metadata Zod schema + validation
- Recipe directory structure under `recipes/`
- First recipe: nvca-voting-agreement (ported from validated Python prototype)
- Scaffold directories for 6 additional NVCA financing document recipes
- Updated `list` and `validate` commands to include recipes
- Recipe authoring guide (`docs/adding-recipes.md`)

### Template-tier fixes (existing bugs)
- **Enable sandboxing** in template engine (remove `noSandbox: true`) — required
  for safe handling of contributed templates in open-source context
- **Fix template validator severity**: required field mismatches become errors, not
  warnings (the `errors` array is never pushed to, so `valid` is always `true`)
- **Fix output.ts**: use AdmZip to extract `word/document.xml` before scanning
  heading styles (currently scans raw ZIP bytes, which is unreliable)
- **Fix CI license check**: use PR base SHA for diff, not `HEAD~1` (breaks on
  multi-commit PRs)
- **Strengthen metadata schema**: enum fields require `options`, defaults validate
  against declared type
- **Warn on unknown fill keys**: typos in `--set party_1_nme=value` silently pass today
- **Fix extractDocxText joins**: operate per-paragraph to avoid false tag matches
  across `<w:t>` element boundaries
- Remove unused `jszip` and `fast-xml-parser` dependencies
- Add minimal test suite (vitest)

## Impact
- Affected specs: open-agreements (ADDED requirements — no existing spec to modify)
- New dependency: @xmldom/xmldom
- Removed dependencies: jszip, fast-xml-parser
- New directories: `src/core/recipe/`, `recipes/`, `tests/`
- Security: sandboxing enabled for contributed template safety
