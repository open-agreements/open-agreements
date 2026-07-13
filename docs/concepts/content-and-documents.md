---
title: Legal Content and Document Mechanics
description: Understand the three separate layers OpenAgreements keeps distinct.
order: 1
section: Concepts
---

# Keep legal content, document mechanics, and workflows separate

OpenAgreements contains related materials with different authority and
responsibilities. Keeping the layers separate prevents a document operation from
being mistaken for legal analysis.

## Legal-domain content explains a rule

Practice guides, surveys, and checklists describe legal requirements or review
questions. Their authority comes from cited primary sources, not from the
software that publishes them. Summaries and comparison cells remain secondary
material and require professional judgment.

The small mental model for conformance work is:

```text
primary law → cited explanation → stable requirement → document finding → human decision
```

Primary law remains outside OpenAgreements and is linked as authority. The cited
practice material owns the explanation of what the law is. A requirement is the
machine-checkable handle, not a second copy of that explanation. A checker can
surface satisfied, missing, conflicting, or judgment-dependent requirements;
the lawyer still owns the decision.

## Reserve “checklist” for substantive review requirements

In OpenAgreements documentation and public interfaces, an unqualified
**checklist** means the substantive legal-content primitive published in the
[contract reviewer checklist catalog](https://openagreements.org/checklists):
source-anchored requirements expressed with RFC 2119 terms such as MUST, SHOULD,
and MAY.

Procedural state for running a matter is a workflow, status, task list, or review
plan. Those tools may help someone apply a checklist, but they are not themselves
OpenAgreements checklists. This vocabulary boundary keeps legal-domain content
separate from product-specific workflow state without maintaining competing
definitions.

## Document mechanics produce an artifact

Templates, metadata, supplied values, validation, and DOCX rendering make a
reviewable file. The renderer applies fields; it does not determine whether a
term is enforceable, commercially appropriate, or complete for a transaction.

```text
source form → template metadata → field values → validation → reviewable DOCX
```

The source form and its license govern what OpenAgreements may redistribute or
modify. For non-redistributable forms, a field-selector can download an official
source and apply declared transformations locally without committing the source
DOCX to this repository.

## Product workflows decide what happens next

An agent, contract workspace, or downstream product can choose a template,
collect values, store lifecycle state, or route a draft for approval. Those
workflow decisions are outside the template renderer. OpenAgreements never
implies that a generated file has been approved, signed, or legally reviewed.

See [Architecture](../architecture.md) for component boundaries and
[Known limitations](../limitations.md) before integrating the output into a
larger system. The public [manifesto](https://openagreements.org/manifesto.md)
is the canonical explanation of the project’s standards thesis.
