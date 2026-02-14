## 1. Employment pack scaffolding

- [x] 1.1 Define v1 employment template set and source provenance table with trust ranking
- [x] 1.2 Add template directories and metadata for offer letter, PIIA/EPIIAA, and confidentiality companion
- [x] 1.3 Validate template licensing classification (in-repo vs pointer/recipe)
- [x] 1.4 Add source terms classification (`permissive`, `pointer-only`, `restricted-no-automation`) for employment providers
- [x] 1.5 Mark Cooley GO as excluded from employment-pack source onboarding

## 2. CLI and fill workflow integration

- [x] 2.1 Add employment discovery grouping in `list` outputs
- [x] 2.2 Add interview flows optimized for employment fields and sections
- [x] 2.3 Ensure filled employment outputs preserve existing template quality checks

## 3. Negotiation memo generator

- [x] 3.1 Implement structured memo schema (findings, citations, confidence, follow-up questions)
- [x] 3.2 Implement deterministic clause presence/absence checks
- [x] 3.3 Implement baseline variance checks against selected employment standard template
- [x] 3.4 Add jurisdiction warning rule registry with source date metadata
- [x] 3.5 Add markdown and JSON memo output formats

## 4. UPL-safe output guardrails

- [x] 4.1 Add mandatory non-advice disclaimer block to employment memo outputs
- [x] 4.2 Add prohibited recommendation phrase checks in generated outputs
- [x] 4.3 Add counsel-escalation guidance for high-risk findings
- [x] 4.4 Add tests that verify advice-like language is not emitted by default

## 5. Tests and documentation

- [x] 5.1 Add unit tests for employment template metadata and required field coverage
- [x] 5.2 Add integration tests for employment fill + memo workflows
- [x] 5.3 Add docs for employment workflow usage boundaries and licensing model
- [ ] 5.4 Add docs for jurisdiction rule maintenance and source update cadence
- [x] 5.5 Add docs for source onboarding policy, including restricted-provider handling

## 6. Validation

- [x] 6.1 Run `openspec validate add-employment-negotiation-pack --strict`
- [x] 6.2 Run `npm run test:run`
- [x] 6.3 Run `npm run build`
