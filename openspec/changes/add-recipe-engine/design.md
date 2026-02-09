## Context

OpenAgreements has a working template tier (3 CC BY 4.0 templates, CLI, docx-templates
engine, Zod validation). The recipe tier was spec'd in project.md but not yet built.
A Python prototype (`foam-notes/scripts/test_nvca_recipe.py`) validated the core
algorithm against the real NVCA Voting Agreement DOCX. This change ports the recipe
engine to TypeScript and fixes template-tier bugs found in peer review.

The repo is being open-sourced and will accept contributed templates, which changes
security assumptions.

## Goals / Non-Goals

- Goals: working recipe pipeline, safe template handling, correct validation
- Non-Goals: tracked changes support, header/footer processing, content controls,
  textbox extraction, recipe versioning (all deferred — documented as known limitations)

## Decisions

### @xmldom/xmldom for XML editing
- **Decision**: Use @xmldom/xmldom instead of fast-xml-parser for recipe DOCX XML manipulation
- **Why**: DOM-compatible API (getElementsByTagName, setAttribute, etc.) preserves
  node order, namespaces, and attributes during round-trip serialization. fast-xml-parser
  converts to/from JS objects, risking OOXML structure corruption on round-trip
- **Alternatives**: fast-xml-parser (lossy round-trip), lxml via Python (wrong language),
  cheerio (HTML-focused, not XML-safe)

### Enable sandboxing in docx-templates
- **Decision**: Remove `noSandbox: true` from `fillTemplate()` — use default sandbox
- **Why**: The repo will be open-sourced and accept contributed templates. With
  `noSandbox: true`, a malicious template can execute arbitrary JavaScript via
  docx-templates' expression evaluator. The sandbox uses Node.js `vm.createContext()`
  to isolate template execution from require(), filesystem, process, and global scope
- **Compatibility**: Verified — simple `{field_name}` substitution works identically
  with sandbox enabled. Only complex expressions (which we don't use) are restricted
- **Limitations**: Node.js VM is not a full security boundary (per docx-templates docs).
  Combined with human review of contributed templates, it provides defense-in-depth
- **Alternatives**: Keep `noSandbox: true` with review-only (insufficient for open-source),
  custom sandbox (over-engineered)

### Async pipeline with file-to-file stage I/O
- **Decision**: Each recipe stage reads from a file path and writes to a file path.
  The orchestrator uses a temp directory for intermediates
- **Why**: Download is inherently async; fillTemplate is already async; file I/O is
  natural for CLI subcommands (`recipe clean`, `recipe patch`). Temp dir cleaned up
  unless `--keep-intermediate`
- **Alternatives**: In-memory buffer passing (less debuggable, can't expose stages as
  CLI subcommands)

### Each stage as a CLI subcommand
- **Decision**: `recipe run` (full pipeline), `recipe clean`, `recipe patch`, plus
  standalone `scan`. Individual stages exposed for debugging and recipe authoring
- **Why**: Recipe authoring requires running stages independently to inspect intermediate
  output. The scan command bootstraps new recipes by discovering placeholders

### Declarative clean.json
- **Decision**: `removeFootnotes` (bool), `removeParagraphPatterns` (regex array).
  Each recipe has its own clean.json
- **Why**: Self-documenting, extensible to non-NVCA sources. No code changes needed
  for new cleaning rules. Regex patterns match the Python prototype's approach

### Fully self-contained recipes
- **Decision**: No shared base replacement maps. Each recipe has a complete
  `replacements.json`. Less DRY but independently understandable
- **Why**: Recipes target different source documents with different placeholder
  conventions. Sharing creates coupling and confusion. A recipe directory should be
  readable without cross-referencing other recipes

### Template validator: required fields as errors
- **Decision**: If a required metadata field has no corresponding `{tag}` placeholder
  in the DOCX, that's an error (not a warning). Optional fields missing = warning
- **Why**: The current code initializes `errors[]` but never pushes to it, so `valid`
  is always `true`. Required fields missing from the template means fill will silently
  skip them — that's a bug, not a cosmetic issue

### CI license check: PR base SHA
- **Decision**: Use `${{ github.event.pull_request.base.sha }}` for PR events,
  `HEAD~1` only for push events to main
- **Why**: `HEAD~1` only catches the last commit. A 3-commit PR where the first commit
  modifies a non-derivative template would pass incorrectly

### DOCX text extraction: per-paragraph joining
- **Decision**: Concatenate `<w:t>` text within each `<w:p>` paragraph, then check
  per-paragraph. Do not join across paragraph boundaries without a separator
- **Why**: Joining all `<w:t>` content without separators can create false `{tag}`
  matches when `{` ends one element and `tag}` starts the next

### Remove jszip and fast-xml-parser
- **Decision**: Remove both unused dependencies. Use AdmZip (already used by template
  validation) for zip operations and @xmldom/xmldom for XML editing
- **Why**: project.md listed "PizZip + fast-xml-parser" but the implementation uses
  AdmZip and neither PizZip nor fast-xml-parser. jszip is in package.json but imported
  nowhere. Clean up the drift

## Risks / Trade-offs

- **Node.js VM sandbox is not bulletproof**: Documented by docx-templates maintainers.
  Mitigated by requiring human review of contributed templates
- **@xmldom/xmldom adds a dependency**: Necessary for safe XML round-tripping. Small
  footprint, well-maintained, standard DOM API
- **Recipe downloads depend on external URLs**: NVCA could move or remove source files.
  Mitigated by `source_version` field and verifier checking expected content
- **Known limitations deferred**: tracked changes, headers/footers, content controls,
  textboxes, recipe versioning. These are real edge cases in legal DOCX files but
  not present in the NVCA Voting Agreement (our first recipe)

## Open Questions
- None — all decisions resolved during peer review and sandboxing analysis
