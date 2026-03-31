# Ralph Loop: Concerto Model Migration & Validation

## Purpose
Iteratively validate and fix all generated Concerto models until every template passes:
1. Compilation (syntax valid)
2. Metadata parity (fields match metadata.yaml 1:1)
3. Sample data validation (concerto validate accepts generated sample)

## One-shot headless run (validates + fixes all)

```bash
cd ~/Projects/open-agreements/.worktrees/concerto-spike

claude -p "
You are in the open-agreements repo on the concerto-spike branch.

Run these commands in order:
1. bash scripts/validate_concerto_models.sh
2. For any failing models, read the .cto file and corresponding metadata.yaml,
   identify the issue, fix the .cto, and re-validate.
3. After fixing, run: npm run validate:concerto && npm run generate:concerto
4. Repeat until all models pass.

Common issues to fix:
- Enum values must be valid identifiers (no spaces, start with letter)
- Defaults with special characters need proper escaping
- Boolean defaults must be true/false (not quoted)
- Array fields use String[] not String

When done, report: total models, passed, failed, and what you fixed.
" --dangerously-skip-permissions --print
```

## Ralph loop (periodic re-check)

```bash
# Run every 10 minutes, checking for regressions after manual edits
/ralph-wiggum:ralph-loop 10m "
cd ~/Projects/open-agreements/.worktrees/concerto-spike
npm run validate:concerto 2>&1
if [ $? -ne 0 ]; then
  echo 'DRIFT DETECTED — run: bash scripts/validate_concerto_models.sh --fix'
fi
"
```

## Manual per-template fix

```bash
# Fix a single template
claude -p "
In ~/Projects/open-agreements/.worktrees/concerto-spike, fix the Concerto model
at concerto/<template-id>.cto. Read content/templates/<template-id>/metadata.yaml
for the source of truth. Ensure all field names match exactly. Run
npm run validate:concerto after fixing.
" --dangerously-skip-permissions --print
```
