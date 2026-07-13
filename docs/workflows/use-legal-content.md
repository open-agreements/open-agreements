---
title: Use Legal Guidance and Checklists
description: Choose a practice guide, survey, or checklist and trace it to its sources.
order: 1
section: Workflows
---

# Use legal guidance and checklists

OpenAgreements publishes three complementary legal-content types. Choose the
one that matches the decision you need to make.

## Answer a jurisdiction-specific question

Use a practice guide when you need an explanation of the law in one
jurisdiction. Every legal claim should cite primary authority. Follow the cited
statute, regulation, or opinion before relying on the conclusion.

Browse the [practice-guide catalog](../reference/catalog.md#find-primary-source-backed-legal-guidance)
or start at [`practice-guides/index.md`](../../practice-guides/index.md).

## Compare jurisdictions

Use a survey when the same question must be compared across states or countries.
The Markdown table is intended for reading; JSON and CSV twins support data
pipelines. A comparison cell is a summary, so follow its source before making a
legal decision.

Browse the [survey catalog](../reference/catalog.md#compare-law-across-jurisdictions).

## Review requirements one by one

Use a checklist when you need repeatable review steps. Requirements use RFC 2119
terms such as MUST, SHOULD, and MAY, carry applicability conditions, and point
back to supporting evidence. The AI applies the checklist; the lawyer owns the
call. A checklist makes the review inspectable, but does not itself establish
that an agreement complies with law.

The [concept guide](../concepts/content-and-documents.md#reserve-checklist-for-substantive-review-requirements)
owns the distinction between these substantive checklists and procedural
workflow state.

Browse the [checklist catalog](../reference/catalog.md#review-an-agreement-with-a-checklist).

## Use a machine-readable twin

Published web resources expose formats by content type:

| Content | Human-readable | Machine-readable |
| --- | --- | --- |
| Practice guide | HTML or Markdown | JSON |
| Survey | HTML | JSON or CSV |
| Checklist | HTML or Markdown | JSON; published collections may also expose requirements, checkers, examples, or `contract-api.json` |

For example, the Texas non-compete guide is available as JSON at
`https://openagreements.org/practice-guides/non-compete/us/texas.json`.

The repository copy is a publication and contribution surface. Follow the
contribution notice in each content family rather than assuming every generated
file is edited directly.
