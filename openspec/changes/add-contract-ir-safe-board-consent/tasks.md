## 1. Contract IR vertical slice

- [x] 1.1 Add a narrow Contract IR parser that reads `content.md` frontmatter,
      loads external schema and style YAML files, and builds a normalized model
      for the SAFE board consent template.
- [x] 1.2 Validate unknown variables, unknown paragraph or inline styles, and
      malformed `{style=slug}` tags with actionable errors.
- [x] 1.3 Add a renderer that emits both DOCX and Markdown from the normalized
      Contract IR model.

## 2. SAFE board consent backport

- [x] 2.1 Add `content/templates/openagreements-board-consent-safe/` with canonical
      Contract IR authoring files, metadata, and generated artifacts.
- [x] 2.2 Preserve the SAFE board consent legal text, headings, resolution
      formatting, placeholders, and signature structure from the current Joey
      Tsang source template.

## 3. Verification

- [x] 3.1 Add focused tests for parsing, validation, and rendering behavior.
- [x] 3.2 Add fidelity smoke checks that compare generated output against the
      current SAFE board consent source text and required sections.
- [x] 3.3 Run targeted generation and test commands, then document supported
      gaps and whether the stockholder consent should be migrated next.
