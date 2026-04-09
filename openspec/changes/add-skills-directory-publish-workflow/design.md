## Context

OpenAgreements ships a `skills/` directory that is now distributed through at
least two authenticated skill registries:

- Smithery
- ClawHub

Those registries accept direct publishes from local skill folders, but they do
not participate in the npm release workflow. That has already caused version
drift:

- ClawHub received scanner-mitigation updates first
- git main lagged behind
- Smithery then lagged behind both

`skills.sh` is different. It behaves like an indexing/discovery surface rather
than a registry with a supported publish API, so it should not be modeled as a
CI publish target.

## Goals / Non-Goals

- Goals:
  - Provide a repeatable publish path for `skills/` directories
  - Keep publish scope explicit and reviewable
  - Source ClawHub versions from `SKILL.md` metadata, not implicit bumps
  - Support changed-skill publishing after a squash-merged PR
- Non-Goals:
  - Auto-publish on every push in v1
  - Publish to `skills.sh`
  - Manage cross-repo skill publishes (`safe-docx`, `email-agent-mcp`) in this
    repo's workflow

## Decisions

- Decision: use a separate `workflow_dispatch` workflow rather than extending
  `release.yml` immediately.
  - Why: the repo's release workflow is already responsible for npm packages and
    GitHub Releases. Directory publishing is public-surface mutation with a
    different auth model and different failure modes. Keeping it separate lowers
    blast radius while the token model stabilizes.

- Decision: publish via a repo script rather than inline bash loops.
  - Why: publish scope selection, frontmatter version parsing, and target
    routing are easier to review and test in a single script.

- Decision: support three scopes: `changed`, `all`, `selected`.
  - Why: `changed` is the common case after a squash merge, `selected` is needed
    for repair/backfill work, and `all` is useful for bootstrapping.

- Decision: authenticate Smithery via `SMITHERY_API_KEY` and ClawHub via a
  token-backed `clawhub login --token ... --no-browser`.
  - Why: both CLIs support non-interactive auth suitable for Actions.

- Decision: do not automate `skills.sh`.
  - Why: the repo has evidence of discovery/index behavior (`npx skills add`)
    but not a stable registry publish API. Automating an unsupported surface
    would create brittle CI with poor failure semantics.

## Risks / Trade-offs

- Public publish workflows can mutate external trust surfaces.
  - Mitigation: keep v1 manual (`workflow_dispatch`) and require explicit
    secrets for the requested targets.

- ClawHub changelog text is weaker in CI than a handcrafted publish.
  - Mitigation: allow an optional manual changelog input and otherwise use a
    deterministic commit-based fallback message.

- `changed` scope depends on a base ref.
  - Mitigation: default to `HEAD^` for squash-merge flows and allow the caller
    to override `base_ref` manually.

## Migration Plan

1. Add the workflow and script.
2. Store `SMITHERY_API_KEY` and `CLAWHUB_TOKEN` as repo secrets.
3. Use the workflow manually after merged skill changes.
4. Revisit automatic trigger-on-merge only after several clean manual runs.

## Open Questions

- Whether the umbrella `open-agreements` skill should be included in the first
  manual run after this workflow lands, or handled in a separate content-sync PR.
