# Change: Add `oa:section` directive anchors for canonical Markdown sections

## Why
Issue #284 identified that the canonical Markdown compiler hardcodes the body
H2 titles `## Standard Terms` and `## Signatures` as required parser anchors.
That coupling forces unnatural section names in template source, even when the
rendered document and frontmatter already use different labels such as
`Resolutions`.

## What Changes
- Add `<!-- oa:section type=... -->` body directives for canonical section
  anchoring, using `standard_terms`, `signature`, and `recitals` section
  types.
- Update the canonical compiler to prefer directive anchors while temporarily
  preserving title-based fallback for `Standard Terms` and `Signatures`.
- Re-author the five canonical templates to include `oa:section` directives.
- Split SAFE consent WHEREAS clauses into a new `recitals` section while
  keeping RESOLVED clauses in the operative section.
- Document the new authoring pattern in
  `skills/canonical-markdown-authoring/SKILL.md`.

## Impact
- Affected specs: `open-agreements`
- Affected code:
  - `scripts/template_renderer/canonical-source.mjs`
  - `scripts/template_renderer/schema.mjs`
  - `scripts/template_renderer/layouts/traditional-consent-v1.mjs`
  - `content/templates/openagreements-*/template.md`
  - `integration-tests/*canonical*.test.ts`
  - `skills/canonical-markdown-authoring/SKILL.md`
