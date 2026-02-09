## Context
OpenAgreements generates DOCX agreements from templates/recipes/external sources. Users need a standard redline artifact (tracked changes) comparing the generated agreement to an approved form. A pure TypeScript comparison engine can produce a tracked-changes DOCX (`w:ins` / `w:del`) without shipping .NET or requiring Word automation.

The repo is preparing for npm publication and should keep distribution friction minimal.

## Goals / Non-Goals

### Goals
- Pure TypeScript DOCX comparison engine vendored into the OpenAgreements repo
- Publish comparer as a standalone npm package under an OpenAgreements scope
- Add `redlineAgainstForm()` library API and an optional `redline` CLI command
- No .NET dependencies

### Non-Goals
- PDF comparison or PDF output
- Perfect semantic diffs for all Word edge cases (textboxes, headers/footers, content controls)
- Inline tracked-change generation during template fill (deferred)

## Decisions

### Post-hoc comparison, not inline tracking
- **Decision**: Generate tracked changes by comparing (form DOCX) vs (prepared agreement DOCX).
- **Why**: Inline OOXML track-change generation during patching is substantially more complex and couples redline correctness to every transformation. A compare step is tier-agnostic and easier to reason about.

### Engine policy (default + wrapper)
- **Decision**: `atomizer` is the default engine.
- **Why**: Higher fidelity (atom-level, with move detection) is more appropriate for legal review.
- **Trade-off**: `diffmatch` is available as a faster/lower-fidelity alternative for callers who want it.
- **Wrapper policy**: `redlineAgainstForm()` always uses `atomizer` and does not expose engine selection. Users who want `diffmatch` call `@open-agreements/docx-comparison` directly.

### Vendoring strategy and source of truth
- **Decision**: Copy the comparer into `packages/docx-comparison/` and prune it aggressively before the initial commit.
- **Source of truth**: After publishing `@open-agreements/docx-comparison`, the copy in this repo is canonical.
- **Upstream relationship**: Upstream improvements (from `junior-AI-email-bot`) are cherry-picked manually as needed. `git subtree` is not planned for v1.

### Normalization (v1)
- **Decision**: Ship v1 without OOXML normalization.
- **Why**: A correct normalization pass (e.g., merging adjacent runs with identical formatting) is non-trivial and risks breaking OOXML fidelity. v1 will prioritize correctness of round-trip and track-change markup over minimizing diff noise.
- **Known limitation**: Word run fragmentation can cause spurious diffs when two paragraphs differ only by run boundaries. This is documented as expected noise for v1.
- **Testing policy**: Tests MUST compare semantically (parse output DOCX XML and assert presence/absence of `w:ins`/`w:del` and expected text), not by byte-identical buffer comparison.

### fast-xml-parser configuration constraints
- **Decision**: The comparer SHALL use fast-xml-parser in a configuration that preserves OOXML ordering and attributes.
- **Constraint**: OOXML parsing is string-key namespace usage (e.g., `w:p` is a literal tag name), not semantic namespace resolution. This is acceptable for DOCX round-trip but contributors must not change parser options in a way that breaks fidelity.
- **Required options**:
  - `preserveOrder: true`
  - `ignoreAttributes: false`
  - `removeNSPrefix: false`

## Risks / Trade-offs
- Diff noise from non-semantic OOXML differences (run fragmentation, metadata) may produce larger-than-expected redlines.
  - Mitigation: document as v1 limitation; evaluate minimal normalization in a future change if user pain is high.
- Comparison quality varies by document structure (tables, complex numbering).
  - Mitigation: fixtures that exercise realistic legal documents; document known limitations.

## Migration Plan
- Vendor comparer into `packages/docx-comparison/` (pruned).
- Publish comparer first.
- Update OpenAgreements to depend on the published comparer.
- Publish OpenAgreements.

## Open Questions
- Should `redline` be a top-level command or a subcommand (e.g., `open-agreements compare`)?
- Do we want a future v2 normalization pass (run merging) gated by extensive OOXML fidelity tests?
