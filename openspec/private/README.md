# Private OpenSpec Drafts

This directory is for unpublished or speculative OpenSpec work that should not be treated as active public roadmap content.

Use `openspec/private/ideas/<change-id>/` for early drafts, rough notes, and work-in-progress proposals that are not ready for review.

## Promotion Workflow

1. Move the draft into `openspec/changes/<change-id>/`.
2. Ensure it has `proposal.md`, `tasks.md`, and required spec deltas under `specs/`.
3. Run `openspec validate <change-id> --strict`.
4. Open the PR that promotes the change to public active status.
