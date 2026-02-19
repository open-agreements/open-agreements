---
title: Employment Source Policy
description: Trust and licensing classifications for employment-pack content onboarding.
order: 10
section: Reference
---

# Employment Source Policy

This document defines trust and licensing classifications for employment-pack
content onboarding.

## Classification Model

- `permissive`: Rights are compatible with in-repo inclusion and adaptation.
- `pointer-only`: Source can be referenced, but we do not vendor text by
  default in this repo.
- `restricted-no-automation`: Terms prohibit or materially restrict automated
  fetch, transformation, redistribution, or linking workflows.

## Source Registry (v1)

| Source | License signal | Terms classification | Distribution mode | Trust notes |
|-------|----------------|----------------------|-------------------|-------------|
| OpenAgreements authored employment templates | CC BY 4.0 | `permissive` | In-repo | First-party maintained, versioned, and auditable |
| Balanced Employee IP Agreement | CC0 1.0 | `permissive` | In-repo reference seed | Widely recognized developer-friendly IP baseline |
| Papertrail legal-docs employment forms | CC0 1.0 | `permissive` | In-repo or reference | Permissive reuse rights; validate fit per workflow |
| DocuSign template library employment materials | MIT | `pointer-only` | Reference-only in v1 | Trusted source, but not vendored in this initial pack |
| Cooley GO forms | Proprietary terms | `restricted-no-automation` | Excluded | Not onboarded for automated fetch/recipe/vendoring |

## Enforcement Notes

- `restricted-no-automation` sources are excluded from scripted ingestion,
  recipe auto-download, and in-repo vendoring.
- Reclassification requires explicit written permission aligned to intended
  automation and redistribution behavior.
- This policy is operational guidance and not legal advice.
