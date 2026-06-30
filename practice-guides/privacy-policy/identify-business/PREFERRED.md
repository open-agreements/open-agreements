---
type: Requirement Preferred Phrasing
title: Identify business — preferred phrasing
description: >-
  The canonical clause text the OpenAgreements privacy-policy template emits for
  REQ-privacy-law.privacy-policy.identify-business (Layer 3 preferred phrasing),
  authored in design.md.
resource: 'https://openagreements.org/practice-guides/privacy/us#what-the-policy-must-say'
tags:
  - privacy-policy
  - identify-business
  - preferred-phrasing
---

# Identify business — preferred phrasing

Preferred phrasing for [REQ-privacy-law.privacy-policy.identify-business](https://openagreements.org/practice-guides/privacy/us#what-the-policy-must-say). This is the ONE canonical clause the OpenAgreements privacy-policy template emits (Layer 3) — authored in design.md and rendered verbatim into template clause `who-we-are`. `{field}` placeholders are filled from the generator's inputs; `[[Defined Term]]` markers are defined once in the policy glossary. Unlike the corpus-mined `PHRASING.md` gallery alongside it, this is prescriptive, not descriptive.

## Preferred phrasing

> **Who We Are.** This Privacy Policy explains how {business_legal_name} collects, uses, and shares your [[Personal Data]]. If you have questions about this policy or your privacy rights, contact us at {business_contact_email} or {business_postal_address}.

- gate: `always`
- template_clause: `openagreements-privacy-policy/standard_terms#who-we-are`
- fields: `business_legal_name`, `business_contact_email`, `business_postal_address`
