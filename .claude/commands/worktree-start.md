# Start a Git Worktree for a New Branch

Set up an isolated worktree so you can work on a branch without affecting other agents or the main checkout.

## Instructions

1. **Determine the branch name.** If the user provided `$ARGUMENTS`, use it as the branch name. Otherwise, ask what they're working on and derive a short branch name like `feat/description` or `fix/description`.

2. **Create the worktree.** From the repo root, run:
   ```bash
   git worktree add ../open-agreements-<branch-name> -b <branch-name> main
   ```
   This creates a sibling directory to avoid nesting worktrees inside the main checkout.

3. **Install dependencies** in the new worktree:
   ```bash
   cd ../open-agreements-<branch-name> && npm install
   ```

4. **Verify the setup:**
   ```bash
   git branch --show-current
   npm test
   ```

5. **Tell the user** the worktree path and branch name so they can point their next agent at it.

## Rules

- **Never symlink** credentials, `.env` files, or `node_modules` between worktrees. Each worktree gets its own `node_modules` via `npm install`. Shared secrets should live outside the repo (e.g., `~/.config/` or environment variables).
- **Always branch from `main`** unless the user specifies a different base.
- **One branch per worktree.** A branch that is checked out in one worktree cannot be checked out in another.
- **Don't create worktrees inside the repo directory** — use sibling directories (`../open-agreements-<branch>`) to keep things clean.
