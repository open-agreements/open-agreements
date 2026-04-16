## Context

The Contract IR spec calls for a pointer architecture:

- canonical Markdown content
- external schema registry in YAML
- external style registry in YAML

OpenAgreements already has deterministic DOCX generation via the `docx` npm
package, but its existing JSON spec renderer is tailored to cover-term and
signature-page layouts. The SAFE board consent needs a different structure:
title, note paragraph, introductory body text, centered underlined section
headings, resolution paragraphs with bold lead-ins, a signature page, and
placeholder exhibits.

## Goals / Non-Goals

- Goals:
  - prove a canonical Markdown authoring surface for one real legal template
  - validate external schema/style pointers and sparse Contract IR tags
  - render the same normalized model to DOCX and Markdown
  - keep the implementation small enough to backport one template honestly
- Non-Goals:
  - migrate all templates to Contract IR
  - generalize every possible Markdown or Word layout feature
  - replace the existing employment JSON renderer
  - migrate the stockholder consent in this first pass unless the board consent
    implementation makes that trivial later

## Decisions

- Decision: keep the Contract IR subset paragraph-oriented.
  - Why: the target template mostly needs block paragraphs with a few inline
    style spans and variable placeholders. A paragraph-first model is enough to
    render this form faithfully without inventing a larger AST.

- Decision: store schema and style definitions beside the template directory.
  - Why: the proof-of-concept should visibly demonstrate the pointer
    architecture while remaining self-contained and easy to diff.

- Decision: implement a dedicated board-consent renderer rather than forcing
  the existing cover-term layout to absorb unrelated semantics.
  - Why: the SAFE board consent document structure is materially different from
    the current employment-template layout.

- Decision: generate `template.docx` and `template.md` as checked-in artifacts.
  - Why: this matches existing repo patterns for deterministic generated
    templates and keeps downstream catalog/readability behavior intact.

## Risks / Trade-offs

- The parser could overfit this one template and be awkward to extend.
  - Mitigation: validate a small but explicit normalized model with named block
    styles instead of hardcoding paragraph positions.

- The rendered DOCX may not match the Joey source document closely enough in
  spacing or emphasis.
  - Mitigation: add fidelity smoke checks for headings, resolution lead-ins,
    signature structure, and text coverage against the current source.

- Adding another generation script could create drift if artifacts are not
  rebuilt consistently.
  - Mitigation: wire generation through a deterministic script and cover the
    new template in targeted integration tests.
