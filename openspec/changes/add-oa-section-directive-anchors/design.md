## Context

Canonical Markdown currently identifies operative and signature body sections by
literal H2 titles. That works only when authors use the exact English strings
`Standard Terms` and `Signatures`, even when the natural section heading is
different and even when frontmatter already advertises a different rendered
heading.

The SAFE board and stockholder consents expose the mismatch most clearly:
their operative section is substantively a set of resolutions, and their
WHEREAS clauses are better modeled as recitals than as part of the same clause
block.

## Goals

- Let canonical sources choose meaningful H2 titles without losing structural
  section semantics.
- Keep the authoring mechanism consistent with existing body directives such as
  `oa:clause`, `oa:signature-mode`, and `oa:signer`.
- Support recital authoring in the primary compiler and renderer path now,
  rather than deferring it to a follow-up schema change.
- Preserve backward compatibility for existing canonical templates during the
  migration window.

## Non-Goals

- Remove the legacy `Standard Terms` / `Signatures` title fallback in this PR.
- Change the separate dev-website rendering path in this repo change.
- Redesign non-consent layouts or rename frontmatter section keys.

## Decisions

### Decision: body directives own section semantics

Canonical section semantics move to explicit HTML directives:

```html
<!-- oa:section type=recitals -->
## Recitals

<!-- oa:section type=standard_terms -->
## Resolutions

<!-- oa:section type=signature -->
## Signatures
```

The compiler binds each directive to the H2 that immediately follows it and
maps the resulting content into the normalized section model. This keeps
structure in the body, where other canonical structural markup already lives.

### Decision: `recitals` ships in the same change

The new directive enum includes `recitals` immediately. SAFE consents need it
right away to separate WHEREAS clauses from RESOLVED clauses cleanly, and
adding the parser anchor without the section type would force a second spec and
schema migration almost immediately.

### Decision: migrate in two phases, implement the first two now

This change implements:
1. Directive support plus backward-compatible title fallback.
2. Directive authoring updates across all current canonical templates.

A later follow-up will remove the title fallback after the repo no longer
depends on it.

## Risks / Trade-offs

- Supporting both directives and legacy titles temporarily adds branching to the
  compiler. The implementation should keep precedence simple: directive wins,
  otherwise fall back to the legacy title.
- Adding `recitals` expands the validated contract spec and the
  `traditional-consent-v1` renderer surface. That is acceptable because the new
  section is optional and only used by the SAFE consent templates in this
  change.

## Migration Plan

1. Add directive parsing and optional `recitals` support in the compiler,
   schema, and renderer.
2. Update all canonical templates to author `oa:section` directives.
3. Regenerate canonical artifacts and verify only the SAFE consent DOCX outputs
   change.
4. Remove legacy title fallback in a future change once all canonical sources
   are directive-anchored.
