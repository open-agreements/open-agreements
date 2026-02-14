## Context

Employment negotiation is a high-frequency workflow for startup teams and
individual professionals, but support must remain operationally useful while
avoiding legal-advice behavior. OpenAgreements already provides local-first
template filling and licensing-aware content tiers, making it a strong base for
an employment pack plus structured review outputs.

## Goals

- Add practical employment drafting assets for common startup hiring workflows.
- Provide deterministic, explainable review artifacts (negotiation memos).
- Make jurisdiction-sensitive risk signaling explicit without making legal
  recommendations.
- Preserve licensing compliance and source provenance for all included content.

## Non-Goals

- Acting as counsel or generating personalized legal advice.
- Guaranteeing enforceability or compliance outcomes.
- Replacing specialized counsel review for high-risk matters.
- Building full CLM negotiation pipelines in this change.

## Decisions

- Decision: Start with drafting + memo hybrid (not upload-anything autonomous
  legal review).
  - Why: aligns with existing template architecture and reduces UPL risk.

- Decision: Use a trust-first source priority for v1 employment templates.
  - Why: users trust recognizable, market-standard forms only when provenance
    and license rights are clear.
  - v1 priority order:
    1. Permissive in-repo sources (CC0, MIT, CC BY)
    2. Pointer-only references for restricted but usable sources
    3. Restricted-no-automation sources blocked until written permission exists

- Decision: Scope employment memo output to structured findings categories:
  - clause present/missing
  - baseline variance
  - jurisdiction warning
  - follow-up questions for counsel
  - Why: maximizes utility while staying non-prescriptive.

- Decision: Require traceable rule references in warning output.
  - Why: improves trust and keeps the system auditable and reviewable.

- Decision: Reuse existing content-tier model.
  - Why: avoids licensing regressions when adding external employment sources.

- Decision: Exclude Cooley GO from the employment pack.
  - Why: the source has restrictive usage constraints and anti-automation terms,
    and its form delivery uses tokenized generator URLs rather than stable public
    DOCX sources suitable for deterministic recipe/catalog workflows.

## Architecture Overview

Core additions:
- `employment` template set (offer + IP/inventions + confidentiality companion)
- `employment memo` generator:
  - input: filled template values and/or prepared document text
  - output: structured JSON/markdown memo with findings and citations
- `jurisdiction rule registry` for warning categories:
  - `rule_id`, `jurisdiction`, `category`, `trigger`, `message`,
    `source_reference`, `confidence`
- `source provenance registry` for employment inputs:
  - `source_id`, `source_name`, `license_type`, `terms_classification`,
    `allowed_distribution_mode`, `written_permission_required`,
    `provenance_reference`

Processing flow:
1. User selects employment workflow/template.
2. CLI interviews user and fills document as today.
3. Optional memo step runs deterministic clause/rule checks.
4. Memo output includes non-advice disclaimer and counsel escalation section.

## Risks and Mitigations

- Risk: output interpreted as legal advice.
  - Mitigation: strict non-advice language, prohibited phrase checks, counsel
    escalation prompts for high-risk findings.
- Risk: licensing ambiguity for employment sources.
  - Mitigation: mandatory provenance table and tiered import policy
    (in-repo vs pointer/recipe).
- Risk: restricted provider terms accidentally bypassed in automation.
  - Mitigation: explicit `restricted-no-automation` classification and preflight
    gate in source onboarding checklist.
- Risk: stale jurisdiction rules.
  - Mitigation: include source date in each rule and validation task for updates.
- Risk: overconfidence in model-driven summaries.
  - Mitigation: deterministic checks first; any model summarization clearly
    labeled as supplementary.

## Migration Plan

1. Author and validate v1 employment templates and metadata.
2. Add employment-focused CLI command surfaces and interview flows.
3. Implement deterministic memo generator and rule registry.
4. Add UPL-safe copy guardrail tests.
5. Document usage boundaries and escalation guidance.

## Open Questions

- Minimum jurisdiction set for v1 warning coverage.
- Whether memo generation should accept arbitrary uploaded agreements in v1 or
  remain template-scoped.
- Whether any restricted-provider integration should ever be allowed in this
  capability, or remain permanently out of scope.
