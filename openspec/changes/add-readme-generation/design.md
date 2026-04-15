## Context

The README now behaves like a public discovery surface rather than a short
package synopsis. It includes inventories that overlap with existing repo-owned
data:

- template inventory from `open-agreements list --json`
- template categories and website links from the site catalog builder
- skill metadata from `skills/*/SKILL.md`
- package-specific docs from workspace and MCP package READMEs

The current website catalog data file is not safe to reuse directly because it
copies download assets as a side effect when imported.

## Goals / Non-Goals

- Goals:
  - generate `README.md` deterministically from repo data
  - share one pure template catalog builder across site and README generation
  - fail CI when the committed README is stale
- Non-Goals:
  - generate translated README variants in this first pass
  - auto-commit README changes from CI
  - redesign website template detail coverage in this change

## Decisions

- Decision: use a checked-in `README.template.md`.
  - Why: the README still contains editorial copy that should stay easy to edit
    without writing markdown from JavaScript.

- Decision: introduce a pure catalog helper under `scripts/lib/`.
  - Why: the README generator and site both need the same template metadata,
    but only the site should perform side effects like preparing downloads.

- Decision: keep README generation as an explicit build/check step, not an npm
  `prepare` hook.
  - Why: `prepare` already builds TypeScript outputs, and silently rewriting the
    README on every install is unnecessary and surprising.

- Decision: enforce drift with `git diff --exit-code -- README.md`.
  - Why: this matches existing generated artifact checks in the repo.

## Risks / Trade-offs

- The generator can become a second presentation layer that diverges from the
  website if field formatting logic forks.
  - Mitigation: centralize template normalization in the shared helper.

- A large generated README can feel heavy on npm.
  - Mitigation: keep template and package sections data-driven so they can be
    collapsed or shortened later without changing the data model.
