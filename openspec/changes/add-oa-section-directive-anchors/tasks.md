## 1. OpenSpec
- [x] 1.1 Add proposal, design notes, and spec deltas for directive-based
      section anchors and SAFE consent recital support.
- [x] 1.2 Validate `add-oa-section-directive-anchors` with
      `npx openspec validate add-oa-section-directive-anchors --strict`.

## 2. Compiler and renderer
- [x] 2.1 Add `oa:section` parsing with directive-first resolution and legacy
      title fallback for required body sections.
- [x] 2.2 Extend the validated contract spec and traditional consent renderer
      to support an optional `recitals` section.

## 3. Templates and tests
- [x] 3.1 Add section directives to all canonical templates.
- [x] 3.2 Restructure the SAFE board and stockholder consents into `Recitals`
      and `Resolutions` sections without changing their substantive content.
- [x] 3.3 Add or update integration tests for directive-only section anchors
      and SAFE consent rendering/fill behavior.
- [x] 3.4 Update the canonical Markdown authoring skill for `oa:section`
      directives and `recitals`.

## 4. Verification
- [x] 4.1 Run `npm run build`.
- [x] 4.2 Run `npm test`.
- [x] 4.3 Run `npm run generate:templates`.
- [x] 4.4 Confirm generated DOCX diffs are limited to the SAFE consent
      templates.
