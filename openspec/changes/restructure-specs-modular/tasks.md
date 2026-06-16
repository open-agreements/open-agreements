## 1. Map requirements to new capabilities

- [x] 1.1 Read full `openspec/specs/open-agreements/spec.md` (1,869 lines, 106 requirements)
- [x] 1.2 Assign each `### Requirement: ...` block to one of: engine, recipes, cli, mcp-contract-templates, closing-checklist, signing, provider-docusign, distribution, authoring, validation, ip-license, quality-gates — OR mark for DELETION (data-model shape-only) — OR mark for EXTRACTION (template-family content → per-template README)
- [x] 1.3 Record the mapping in `design.md` for review traceability

## 2. Write ADDED Requirements delta files (12 new capabilities)

- [x] 2.1 `specs/engine/spec.md` — fill pipeline, sandboxing, DOCX text extraction, computed/derived fields
- [x] 2.2 `specs/recipes/spec.md` — cleaner, patcher, verifier, source-drift, recipe metadata
- [x] 2.3 `specs/cli/spec.md` — fill/list/validate/scan/recipe/checklist subcommands, JSON envelope, content-root resolution
- [x] 2.4 `specs/mcp-contract-templates/spec.md` — list_templates/get_template/fill_template, pagination, MCP envelope contract
- [x] 2.5 `specs/closing-checklist/spec.md` — checklist data model, JSON Patch lifecycle, rendering, MCP tools
- [x] 2.8 `specs/distribution/spec.md` — npm packaging, tarball, skill publishing, runtime tarball, registry auth
- [x] 2.9 `specs/authoring/spec.md` — canonical Markdown DSL, DOCX placeholder semantics
- [x] 2.10 `specs/validation/spec.md` — template/recipe/metadata validation, severity, patch schema
- [x] 2.11 `specs/ip-license/spec.md` — CC license tiers, derivative rules, attribution
- [x] 2.12 `specs/quality-gates/spec.md` — source-drift, README drift, coverage gates, trust signals

## 3. Write RENAMED + REMOVED deltas for existing capabilities

- [x] 3.1 `specs/open-agreements/spec.md` — REMOVED block listing every requirement with `**Reason**: Moved to <capability>` and `**Migration**: see openspec/specs/<capability>/spec.md` (or `**Reason**: Shape duplicates Zod schema` / `**Reason**: Template-family content extracted to README` for deletions)
- [x] 3.2 `specs/contracts-workspace/spec.md` — RENAMED to mcp-contracts-workspace (contents preserved)

## 4. Data-model dedup

- [x] 4.1 Identify shape-only requirements (just listing field types / required-vs-optional / enum members) vs semantic invariants (cross-field rules with WHY)
- [x] 4.2 Delete shape-only requirements via the REMOVED delta with `**Reason**: Shape duplicates Zod schema in src/core/metadata.ts`
- [x] 4.3 Rewrite kept semantic-invariant requirements to reference Zod schema paths
- [x] 4.4 JSDoc enrichment audit pass on `src/core/metadata.ts` — add/improve JSDoc for any field where the prior spec had load-bearing prose

## 5. Content-specific extraction

- [x] 5.1 Identify template-family requirements (titles mention SAFE / NVCA / Employment / Mutual NDA / Common Paper / a specific template id)
- [x] 5.2 For each, create or update `content/templates/<id>/README.md` capturing the equivalent rules
- [x] 5.3 Delete extracted requirements via the REMOVED delta with `**Reason**: Template-family content extracted to content/templates/<id>/README.md`

## 6. Audience framing + id-mapping

- [x] 6.1 Update `openspec/project.md` with audience framing (overworked GC; AI-agent-readable rigour)
- [x] 6.2 Add brief "Who this is for" section to root `README.md` (brand-led: Common Paper, Bonterms, NVCA, SAFE first; audience second)
- [x] 6.3 Regenerate `openspec/id-mapping.json` against new capability paths

## 7. Rebase 4 near-done in-flight changes

- [x] 7.1 `restore-traditional-safe-consents` (90% done) — repoint delta to new capability (likely `authoring`)
- [x] 7.2 `rename-contract-ir-content-to-template` (81%) — repoint to `authoring`
- [x] 7.3 `add-typescript-mcp-server` (64%) — repoint to `mcp-contract-templates`
- [x] 7.4 `add-template-display-labels` (62%) — repoint to `engine` or `authoring`
- [x] 7.5 Each rebased change passes `openspec validate <id> --strict`

## 8. Validate

- [x] 8.1 `openspec validate restructure-specs-modular --strict` passes
- [x] 8.2 `openspec validate --strict` (bulk) passes for every capability in the tree
- [x] 8.3 Spot-check 5 representative requirements moved correctly (content preserved, scenario count preserved unless intentionally deleted)
- [x] 8.4 Confirm requirement accounting: starting 106 = moved + deleted-as-shape + extracted-to-README, with each category enumerated in design.md
- [x] 8.5 `git grep "specs/open-agreements/"` returns zero hits in src/, scripts/, site/, integration-tests/ (archive metadata excepted)
- [x] 8.6 README drift gate, license compliance gate, source-drift canary still pass
