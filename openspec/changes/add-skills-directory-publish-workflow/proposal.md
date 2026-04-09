# Change: Add gated skills-directory publish workflow

## Why

ClawHub and Smithery have become real distribution surfaces for the repo's
`skills/` bundles, but their published versions have already drifted from git
main multiple times. We just had to repair that drift manually by publishing
scanner-mitigation changes on ClawHub first, then back-syncing them into git
and republishing Smithery.

The repo needs a controlled publish path for skills-directory updates so future
skill revisions do not require ad hoc terminal work and cross-directory manual
reconciliation.

## What Changes

- Add a dedicated GitHub Actions workflow to publish `skills/` directories to
  Smithery and/or ClawHub.
- Keep the workflow gated behind `workflow_dispatch` for v1 instead of auto-
  publishing on every merge to `main`.
- Add a publish helper script that:
  - resolves the skills to publish from `changed`, `all`, or `selected` scope,
  - reads each skill's declared version from `SKILL.md`,
  - invokes Smithery and ClawHub with deterministic arguments.
- Document the required GitHub secrets and the manual dispatch flow.
- Explicitly document that `skills.sh` is not a direct CI publish target.

## Impact

- Affected specs: `open-agreements`
- Affected code:
  - `.github/workflows/publish-skills-directories.yml`
  - `scripts/publish_skills_directories.mjs`
  - `docs/changelog-release-process.md`
  - `openspec/changes/add-skills-directory-publish-workflow/*`
