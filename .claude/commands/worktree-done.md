# Close Out a Git Worktree Safely

Wrap up work in a worktree: commit, push, open a PR, then cleanly remove the worktree.

## Instructions

1. **Check for uncommitted work:**
   ```bash
   git status
   ```
   If there are uncommitted changes, commit them with an appropriate message. Stage specific files — don't use `git add -A`.

2. **Push the branch:**
   ```bash
   git push -u origin <branch-name>
   ```

3. **Open a PR** using the `gh` CLI:
   ```bash
   gh pr create --title "<short title>" --body "$(cat <<'EOF'
   ## Summary
   <1-3 bullet points>

   ## Test plan
   - [ ] `npm test` passes
   - [ ] <specific verification steps>
   EOF
   )"
   ```

4. **Return to the main checkout** and remove the worktree:
   ```bash
   cd /Users/stevenobiajulu/Projects/open-agreements
   git worktree remove --force ../open-agreements-<branch-name>
   ```
   Always use `git worktree remove`, never `rm -rf` the directory — git needs to clean up its internal worktree tracking.

5. **Confirm cleanup:**
   ```bash
   git worktree list
   ```
   The removed worktree should no longer appear.

6. **Tell the user** the PR URL.

## Rules

- **Always push before removing** the worktree. Unpushed commits in a removed worktree are hard to recover.
- **Use `git worktree remove --force`** because `node_modules` and other untracked files will otherwise block removal.
- **Never delete the main worktree** (the original clone at `/Users/stevenobiajulu/Projects/open-agreements`).
- **Don't delete the branch** after removal — it stays on the remote for the PR. Branch cleanup happens when the PR is merged.
