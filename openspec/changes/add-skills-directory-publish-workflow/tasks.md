## 1. Spec and design

- [x] 1.1 Add OpenSpec proposal, design, and `open-agreements` spec delta for
      gated skills-directory publishing.
- [x] 1.2 Validate the OpenSpec change with `openspec validate ... --strict`.

## 2. Workflow implementation

- [x] 2.1 Add a helper script that resolves publish scope (`changed`, `all`,
      `selected`) and extracts skill versions from `SKILL.md`.
- [x] 2.2 Add a `workflow_dispatch` GitHub Actions workflow for Smithery and
      ClawHub publishing.
- [x] 2.3 Require token-based auth via GitHub secrets and fail clearly when a
      requested target is missing auth.
- [x] 2.4 Exclude `skills.sh` from direct CI publishing and encode that choice
      in workflow/docs.

## 3. Verification and docs

- [x] 3.1 Run local dry-run checks for selected skills using the helper script.
- [x] 3.2 Update release/process docs with the manual dispatch flow and secret
      requirements.
- [x] 3.3 Confirm the worktree is clean, commit, push, and open a draft PR.
