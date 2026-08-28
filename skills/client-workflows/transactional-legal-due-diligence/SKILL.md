---
name: transactional-legal-due-diligence
description: >-
  Plan, perform, and report buy-side legal due diligence for an acquisition from
  a virtual data room, diligence Q&A, management-session records, and authorized
  public searches. Use for legal diligence workplans, issue matrices, missing-
  document tracking, change-of-control review, and source-cited diligence reports.
license: Apache-2.0
metadata:
  author: open-agreements
  version: "0.1.0"
  compatibility: >-
    Works with any agent that can read the user's matter files. Public-record
    searches require user-authorized web or registry access.
catalog_group: Editing And Client Workflows
catalog_order: 40
---

# Transactional Legal Due Diligence

Build a reviewable, source-cited legal due diligence record for a proposed
acquisition. The skill organizes evidence and open items; counsel determines
scope, materiality, legal advice, and transaction response.

## Safety and authority

- Treat all matter documents as confidential. Do not upload, transmit, or quote
  them to an external service unless the user authorizes that destination.
- Do not characterize work product as privileged merely because a template says
  so. Preserve labels supplied by counsel and let counsel decide privilege.
- Do not run a public-record search, contact management, send a diligence request,
  or modify a tracker without authorization. A requested report does not itself
  authorize those external actions.
- Do not state that a search was run, a call occurred, or a document was reviewed
  unless the record proves it.
- Separate extracted fact, legal benchmark, analysis, commercial consequence,
  recommendation, and unresolved question. The reviewing lawyer owns the final
  legal and deal judgment.

## Start with the transaction, not a generic checklist

Before reviewing, establish from supplied evidence or ask for:

- buyer, target, seller, and the exact entities or assets in scope;
- proposed structure, signing and closing posture, and relevant jurisdictions;
- materiality thresholds and priority contracts, facilities, people, products,
  permits, and regulatory regimes;
- available repositories, index or folder map, Q&A tracker, management-session
  records, public-search results, and the report cutoff date;
- requested output, citation convention, risk taxonomy, and review owners.

Unknown items remain `Unknown` or `Not provided`. Never infer that a deal is a
stock purchase, asset purchase, or merger from the mere existence of diligence.

## Build the evidence ledger first

Create an internal ledger before drafting conclusions. Each reviewed item needs:

1. stable source identifier and repository path;
2. document title, parties, execution and effective dates, and version status;
3. pinpoint location for each extracted fact or clause;
4. relationship to amendments, exhibits, schedules, incorporated terms, and
   referenced-but-missing material;
5. reviewer status and the date through which the record is current.

Use addressable citations such as:

- `[Doc: Commercial / Customer-017.pdf, § 12.4]`
- `[Diligence Q&A: Item 42, response dated 2026-08-20]`
- `[Management Session: Operations (2026-08-21), 00:31:14]`
- `[Public Record: Delaware UCC, filing 2025-1234567]`
- `[DATA GAP: Schedule 3.14 referenced in SPA draft; not provided as of 2026-08-24]`

Adapt the syntax to the user's system, but keep source identities stable. A folder
name alone is not a pinpoint. A management assertion does not become documentary
evidence merely because it appears in a call transcript.

## Select and route review areas

Read [references/review-areas.md](references/review-areas.md). Select areas based
on the transaction structure, target operations, materiality thresholds, and the
actual corpus. Do not force every matter through every category.

Corporate/entity and transaction-structure review is the spine: reconcile what
exists, who owns it, what is being acquired, which approvals are required, and
which obligations survive or move. Route specialist issues to qualified review
instead of converting a general diligence report into unsupported tax,
environmental, benefits, antitrust, healthcare, or other specialist advice.

The review-area file is intentionally modular. New categories may be added there
without rewriting this workflow, provided each category states its trigger,
questions, expected evidence, outputs, and escalation boundary.

## Review in passes

### 1. Corpus integrity

- inventory documents and compare the repository to indices, request lists, and
  references inside documents;
- detect duplicates, drafts, unsigned copies, broken amendment chains, missing
  exhibits, and inconsistent entity names;
- log every material gap with the request channel and cutoff date when known.

### 2. Corporate and structural reconciliation

- reconcile legal names, entity types, jurisdictions, good-standing evidence,
  organizational documents, subsidiaries, capitalization, securities, options,
  warrants, and ownership records;
- distinguish seller-retained assets and services from target-owned assets;
- map required board, equityholder, lender, counterparty, regulatory, and other
  approvals to signing, closing, or post-closing action;
- compare the proposed structure against transfer, succession, assignment, and
  change-of-control mechanics found in the evidence.

### 3. Specialist and contract review

Apply only the activated review areas. For material agreements, distinguish an
assignment restriction from an express change-of-control provision; do not treat
silence as consent. Capture term, renewal, termination, exclusivity, minimums,
pricing protections, indemnity, liability limits, IP/data rights, audit rights,
governing law, dispute terms, and transaction-triggered notice or consent.

Trace amendments chronologically and state which provision controls. If the
complete agreement set is unavailable, qualify the conclusion and log the gap.

### 4. Reconciliation and follow-up

Cross-check representations across contracts, schedules, cap tables, management
responses, public records, financial or operational schedules supplied for legal
review, and specialist reports. Record contradictions; do not silently choose the
most convenient source. Convert unresolved issues into specific requests stating
what is missing and why it matters.

## Apply legal benchmarks carefully

- Verify current law from primary sources before stating a legal requirement.
- Record jurisdiction, effective date, applicability conditions, exceptions, and
  the source URL or citation.
- Do not apply a statute merely because a document mentions the same subject.
- Treat market practice as distinct from law and identify the basis for any market
  benchmark.
- For U.S. restrictive-covenant law, use the separately published
  `open-agreements/open-agreements@non-compete-contract-explainer` when available.
- When facts or jurisdiction are insufficient, state the dependency and route the
  point to counsel instead of manufacturing a conclusion.

## Classify findings without overstating them

For each finding, state:

- concise title and activated review area;
- evidence-backed fact and pinpoint citation;
- applicable contract mechanism or verified legal benchmark;
- why it matters to this transaction structure;
- status: confirmed, contradictory, incomplete, or pending specialist review;
- possible response category, framed as an option for counsel: structure,
  consent/notice, closing condition, covenant, purchase-price mechanism,
  indemnity/escrow, remediation, integration item, or acceptance;
- owner, next action, and timing if the user supplied them.

Do not assign dollar exposure, probability, severity, or insurance coverage
without a stated method and supporting evidence.

## Produce the report

Read [references/report-template.md](references/report-template.md). Adapt the
selected review-area modules rather than retaining empty boilerplate sections.
Every substantive report entry needs an evidence citation or an explicit data-gap
marker.

Before delivery, verify:

- entity and transaction descriptions match the evidence;
- every conclusion is traceable to the ledger;
- assignment and change-of-control concepts are not conflated;
- missing schedules, exhibits, amendments, and referenced agreements are logged;
- specialist limitations are visible where the report raises specialist issues;
- scope lists only repositories, sessions, searches, and dates actually reviewed;
- report language distinguishes fact, law, analysis, and proposed response;
- placeholders and unsupported generic statements have been removed.

## References

- [Review-area modules](references/review-areas.md)
- [Report template](references/report-template.md)
- [OpenAgreements legal due diligence practice guide](https://openagreements.org/practice-guides/legal-due-diligence/us)
