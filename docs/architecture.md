---
title: Architecture
description: Follow legal content and an agreement from source to consumer output.
order: 1
section: Internals
---

# Follow content and documents through OpenAgreements

OpenAgreements has two primary publication paths and optional workflow tools.
They share a repository but do not share authority.

```text
external primary law → cited explanation → stable requirement → checker result
                                               ↑                    ↓
                                examples / templates / notes      human decision

standard form → metadata + declared fields → validated renderer → DOCX draft
                                                        ↓
                               agent or workspace routes human review
```

## Publish legal content from cited sources

Practice guides under `practice-guides/` explain rules and cite primary law.
Surveys project comparable questions across jurisdictions. Checklists express
review requirements one item at a time. JSON and CSV twins are publication
formats, not independent sources of truth; their corresponding content model
owns the substantive text.

Primary law stays in the public systems that serve as its record. OpenAgreements
stores addressable citations and the explanation or requirement derived from
them; it does not claim to become the system of record for statutes, regulations,
or opinions.

## Keep requirements as thin hubs

Each legal requirement has a stable, meaningful slug and the minimum data needed
to act as a machine-checkable handle. Practice-note paragraphs, drafting notes,
template clauses, example phrasings, and checkers are spokes that reference that
slug. The requirement record does not copy their substantive explanations or
point back out to every consumer.

This is an SSOT invariant: the substance stays beside its evidence, while the
slug connects downstream representations. A change in meaning supersedes a slug
instead of silently renaming it. The full rationale and evidence thresholds live
in the manifesto’s [One requirement, many spokes](https://openagreements.org/manifesto.md#one-requirement-many-spokes)
section; they are not repeated here.

## Produce a DOCX from a standard form

1. Catalog discovery reads template or field-selector metadata.
2. A CLI, MCP client, or library caller supplies field values.
3. Metadata validation enforces field shape and license constraints.
4. A bundled template is rendered locally, or a field-selector obtains its
   official source and runs the declared clean, patch, fill, and verify stages.
5. The renderer writes a new DOCX. The source artifact is not mutated in place.
6. A person reviews the resulting legal and business terms.

The template or downloaded official form is authoritative before filling.
Metadata is authoritative for supported fields and source/license declarations.
The generated DOCX is authoritative only as the produced artifact; successful
rendering is not legal approval.

## Keep mutation boundaries narrow

- Legal-content generators may project canonical material into Markdown or
  machine-readable twins; contributors should change the owning source.
- The template engine may write only the requested output artifact.
- Field-selector stages may transform a working copy of an official document;
  proprietary source files must not be committed.
- Workspace tools may organize files and lifecycle status, but do not change
  agreement text unless a separate document operation is invoked.

## Extend at declared interfaces

- Add redistributable forms under `templates/` with metadata and validation.
- Add transformation instructions for non-redistributable forms as
  field-selectors.
- Integrate template discovery and filling through
  `@open-agreements/contract-templates-mcp`.
- Integrate folder planning and lifecycle status through
  `@open-agreements/contracts-workspace-mcp`.
- Add agent-specific command generation through the adapter interface described
  in [Supported tools](supported-tools.md).

Repository directory details belong in [CONTRIBUTING.md](../CONTRIBUTING.md);
this page owns the system relationships and invariants.
