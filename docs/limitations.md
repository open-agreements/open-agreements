---
title: Known Limitations
description: Capabilities and fidelity boundaries to evaluate before using an output.
order: 2
section: Internals
---

# Know the boundaries before relying on an output

## Generated agreements require review

OpenAgreements fills declared fields in standard forms. It does not select the
right form, negotiate terms, verify factual inputs, determine enforceability, or
provide legal advice. A successful command means the renderer produced an
artifact, not that the agreement is complete or ready to sign.

## Arbitrary agreement editing is out of scope

The main template workflow does not ingest an arbitrary agreement, infer its
structure, propose revisions, or export a redline. Field-selectors transform
specific supported source forms according to checked-in instructions; they are
not a general contract-editing engine.

## Fidelity depends on the workflow

Bundled DOCX templates are tested for their declared fields. Complex Word
features outside those fields may not be preserved by every transformation.
Field-selector sources can also change upstream; source hashes and structural
anchors detect known drift, but a newly published form may require updated
instructions before it can be filled safely.

## Content coverage is not universal

Practice guides and surveys cover only published topics and jurisdictions.
Legal rules change, and summaries may lag an authority. Check the cited primary
source and the content's update information before relying on it.

## Hosted and local execution have different trust boundaries

Local execution keeps processing on the machine running the command. Hosted MCP
requires sending inputs to a server. Some local field-selector workflows still
make network requests to download official source forms. See the
[trust-boundary status](trust-checklist.md) at the point where you choose an execution
mode.
