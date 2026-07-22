# Contributing to OpenAgreements

Thanks for your interest in contributing! OpenAgreements is an open-source tool for filling standard legal agreement templates. Contributions of new templates, field-selector improvements, bug fixes, and documentation are welcome.

Please follow our [Code of Conduct](CODE_OF_CONDUCT.md) in all project spaces.

## Ways to Contribute

### Add a Template

The most impactful contribution is adding a new template. Requirements:

- Source document must be **CC BY 4.0** or **CC0** licensed
- Available as DOCX with fillable fields

See [docs/adding-templates.md](docs/adding-templates.md) for the full guide.

### Template credits

Templates may carry a `credits` array naming individuals who materially shaped them. Credit is a form of recognition for substantive work.

- **Credit requires a material, template-specific contribution.** Typo fixes, formatting, or metadata touch-ups don't qualify for template-level credit, even if merged.
- **Consent is required.** No one is added to `credits` without their explicit agreement. Anyone named can ask to be removed at any time.
- **Honest role labels:**
  - `drafter` — originated the template or distinctive clause architecture
  - `drafting_editor` — materially synthesized/adapted external sources into the published form
  - `reviewer` — substantive legal review of drafted text
  - `maintainer` — ongoing stewardship (not authorship)

### Add a Field-selector

Field-selectors handle documents that aren't redistributable (e.g., NVCA model documents). You author transformation instructions — never commit the source DOCX.

See [docs/adding-field-selectors.md](docs/adding-field-selectors.md) for the full guide.

### Report a Bug

Open an issue with:
- What you expected to happen
- What actually happened
- The command you ran
- Your Node.js version (`node -v`)

### Improve Documentation

Docs live in `docs/`. Fix typos, clarify instructions, or add examples.

### Add Your Project to "Built With OpenAgreements"

If you've built something on OpenAgreements, we'd love to feature it. Open a PR adding a one-liner here:

*No projects listed yet — be the first!*

## Template Versioning & Provenance

This policy governs **first-party templates** (those authored here, e.g. `openagreements-*`).
**Upstream-licensed templates** — Common Paper, Bonterms, NVCA derivatives, `yc-safe-*` — are exempt:
their `version` field tracks the upstream standard's own published version (e.g. Common Paper CSA
v2.1), and the rules below do not apply to them.

### Semantic versioning (x.y.z)

First-party template `version` fields follow `x.y.z`:

- **patch (z)** — typos, formatting, clarifications that do not change legal meaning; non-substantive
  bug fixes.
- **minor (y)** — non-breaking additions: new optional fields, new optional clauses, new drafting
  notes, expanded options on existing fields. Existing field shape is preserved.
- **major (x)** — legal-text changes that change meaning; breaking field-shape changes (renames,
  removals, type changes); clause-architecture rewrites.

### The `0.x` posture and the `1.0` bar

First-party templates stay at **`0.x.x` until they earn `1.0`**. A version `>= 1.0` signals a
finality the early catalog has not yet reached, and that mismatch damages trust when content still
shifts. The internal major/minor history is preserved behind the `0.` prefix (e.g. a template that
was `2.0` becomes `0.2.0`); that relabel is **cosmetic** and does not reset anything.

### Stability and the `1.0` ≡ `stable` graduation

First-party template metadata carries a `stability` field:

```
stability: experimental | beta | stable
```

All first-party templates **start at `experimental`** under the `0.x` posture and are promoted
individually. **Reaching `1.0` and earning the `stable` label are the same event** — one combined
graduation checklist, not two orthogonal signals. A template is `stable` (i.e. `1.0`) only when:

1. **It has a base, jurisdiction-neutral template plus multi-jurisdiction validation** — not one or
   two state variants.
2. **Protected-disclosures / DTSA parity holds where applicable** (employment-side templates that
   reasonably need whistleblower / § 1833(b) carve-outs carry them).
3. **Cover-term drafting notes are complete** for the template's high-risk fields.
4. **Two consecutive minor releases without legal-text rework** — an empirical signal the form has
   settled. The `0.x` renumber is cosmetic and does **not** reset this counter; prior settled history
   still counts.

`stability` is surfaced on the template-detail page, the CLI (`oa list` — a Stability column in the
table and a `stability` key in `--json`), and MCP output (`get_template` and `list_templates`). Until
a template is `stable`/`1.0` it shows `experimental` or `beta`.

### Changelog and archived versions

Each first-party template carries a **`CHANGES.md`** adjacent to its `template.md`, surfaced as a
"Changelog" tab on the template-detail page; entries use the `x.y.z` meanings above. Superseded
versions are archived rather than deleted:

- Archived versions live at **versioned URLs for every published version**, e.g.
  `/templates/<slug>/v0.2.0/`, `/templates/<slug>/v0.2.1/` — the exact prior text stays retrievable.
- The current version is indexable and **self-canonical** (`rel=canonical` points at itself, never
  at an archive).
- Archived HTML pages carry `<meta name="robots" content="noindex, follow">`; archived non-HTML
  downloads (DOCX/PDF) carry `X-Robots-Tag: noindex`. Archived URLs stay **crawlable** (never
  disallowed in `robots.txt`), so crawlers can see the `noindex`.
- Do **not** `rel=canonical` an archived page to the current version — old legal text can differ in
  legally meaningful ways and users may need the exact prior wording.

### Provenance: `derived_from`, `credits`, `source_url`

- **`derived_from`** — set **only** when a template is genuinely derived from a public,
  permissively-licensed model (Common Paper, Bonterms, NVCA). Carries source name + version + URL.
  **First-party originals legitimately leave `derived_from` empty** — authors are not required to
  manufacture a derivation where none exists. Provenance for an original comes from its drafting
  notes (sourced from published commentary), its git history, and adoption signals. We do **not**
  retroactively hunt for permissively-licensed lookalikes to populate `derived_from` on originals.
- **`credits`** — contributors / authors / reviewers who materially shaped the template (see
  *Template credits* above; consent required). Populate these accurately — they are the primary
  provenance signal for first-party originals.
- **`source_url`** — canonical reference URL when applicable.

An empty `derived_from` on a first-party original is **not** a `1.0` graduation blocker.

## Development Setup

```bash
git clone https://github.com/open-agreements/open-agreements.git
cd open-agreements
npm install
npm run build
npm run test:run
```

## Before Submitting a PR

1. **Build**: `npm run build` passes
2. **Lint**: `npm run lint` passes
3. **Test**: `npm run test:run` passes (all 81+ tests)
4. **Validate**: `node bin/open-agreements.js validate` passes for all templates and field-selectors
5. **Preview freshness** (OA-owned templates only): if you modified a template's
   `template.md` (canonical templates), `template.json` (the JSON-spec template),
   or `template.docx`, or any renderer/generator script (e.g., under
   `scripts/template_renderer/`, `scripts/generate_templates.mjs`,
   `scripts/template-specs/styles/openagreements-default-v1.json`,
   `scripts/generate_checklist_template.mjs`,
   `scripts/generate_working_group_template.mjs`), regenerate the affected
   previews locally and commit them in the same PR:

   ```
   npm run generate:templates                              # if you edited template.md / template.json
   npm run generate:template-previews -- --template <template-id>
   # or for a renderer-pipeline change that fans out to many templates:
   npm run generate:template-previews
   ```

   Commit the updated `data/template-previews/<id>/page-*.png` (and any
   regenerated `template.docx` / `.template.generated.json`). CI's
   `preview-freshness-gate` enforces this on PRs.

   Note: `metadata.yaml` is catalog-only (not a render input), so editing it
   does **not** require a preview refresh.

6. **LLM-Based Quality Gate**: same-repo PRs are reviewed by the central
   LLM-powered code-reuse detector through
   `.github/workflows/llm-gate-dispatch.yml`. The gate runs when a PR is opened,
   marked ready for review, synchronized, or has the `llm-gate/override` label
   added or removed. If a verdict is stale after a fix, maintainers can manually
   re-run it from Actions or with
   `gh workflow run llm-gate-dispatch.yml --field pr_number=<number>`.
   By default the gate is advisory: it posts PASS/WARN findings as a PR comment
   but does not block merging. Maintainers can enable blocking mode with the
   `LLM_GATE_BLOCKING=1` repo variable in the central gate configuration; in
   that mode any WARN row fails the aggregate check unless the PR has the
   `llm-gate/override` label, which keeps the findings visible while treating
   them as non-blocking for that PR.

## Project Structure

```
templates/          # All content: templates/<source>-<rights>/<slug>/
                    #   kind derived from metadata.yaml:
                    #     allow_derivatives:true  → template (we ship the DOCX)
                    #     allow_derivatives:false → external (CC BY-ND, vendored unchanged)
                    #     artifact_type:field-selector → field-selector (instructions only)
src/                # TypeScript source + collocated unit tests
integration-tests/  # Integration and end-to-end tests
skills/             # Agent Skills (Claude Code, Cursor, etc.)
docs/               # Documentation
```

## Releasing

Releases are automated through GitHub Actions using npm trusted publishing (OIDC) with provenance enabled.

1. Update versions in root package + publishable MCP packages.
2. Push commit + tag with `git push origin main --tags`
3. Run the local Gemini extension gate (copy/symlink into `~/.gemini/extensions/open-agreements` and verify both local MCP servers start/respond).
4. The `Release` workflow publishes from the tag after running build, validation, tests, isolated runtime smoke, and package checks.

Workflow guardrails:

- Tag must match root + publishable package versions
- Release commit must be contained in `origin/main`
- Publish fails if any target npm version already exists

## Architecture

- **Language**: TypeScript
- **DOCX Engine**: [docx-templates](https://www.npmjs.com/package/docx-templates) (MIT)
- **CLI**: [Commander.js](https://www.npmjs.com/package/commander)
- **Validation**: [Zod](https://www.npmjs.com/package/zod) schemas
- **Skill Pattern**: Agent-agnostic `ToolCommandAdapter` interface

```
templates/                  # All content: templates/<source>-<rights>/<slug>/
                            #   e.g. common-paper-cc-by-4.0/, yc-cc-by-nd-4.0/,
                            #   nvca-free-non-redistributable/ — kind is derived
                            #   from each slug's metadata.yaml (see above)

src/                        # TypeScript source + collocated unit tests
├── cli/                    # Commander.js CLI
├── commands/               # fill, validate, list, field-selector, scan
├── core/
│   ├── engine.ts           # docx-templates wrapper
│   ├── metadata.ts         # Zod schemas + loader
│   ├── field-selector/             # Field-selector pipeline (clean → patch → fill → verify)
│   ├── external/           # External template support
│   ├── validation/         # template, license, output, field-selector
│   └── command-generation/
│       ├── types.ts        # ToolCommandAdapter interface
│       └── adapters/       # Claude Code adapter
└── index.ts                # Public API

integration-tests/          # Integration and end-to-end tests
```

## License

By contributing, you agree that your contributions will be licensed under the Apache License 2.0. Template content retains the license of its source (CC BY 4.0, CC0, or CC BY-ND 4.0).
