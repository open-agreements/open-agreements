## 1. Package scaffolding

- [ ] 1.1 Create sibling package for workspace CLI under `packages/contracts-workspace/`
- [ ] 1.2 Add package scripts for build, test, and CLI execution
- [ ] 1.3 Add README for workspace package with quickstart and scope boundaries

## 2. Init workflow

- [ ] 2.1 Implement `init` command that scaffolds lifecycle-first directory structure in current working directory
- [ ] 2.2 Scaffold topic subfolders under `forms/`
- [ ] 2.3 Generate `CONTRACTS.md` shared guidance document
- [ ] 2.4 Generate optional Claude Code and Gemini CLI integration snippets referencing `CONTRACTS.md`
- [ ] 2.5 Add tests for idempotent re-run behavior of `init`

## 3. Forms catalog

- [ ] 3.1 Define YAML schema for forms catalog entries (URL + checksum + license handling)
- [ ] 3.2 Implement `catalog validate` command enforcing checksum presence and schema correctness
- [ ] 3.3 Implement `catalog fetch` command for eligible entries with checksum verification
- [ ] 3.4 Implement pointer-only/proprietary handling (reference metadata only, no prohibited vendoring)
- [ ] 3.5 Add tests covering checksum mismatch and license gate behavior

## 4. Status indexing and linting

- [ ] 4.1 Implement filename-based execution-state parser (`_executed` source of truth)
- [ ] 4.2 Implement `status generate` to produce `contracts-index.yaml` with timestamp and per-document rows
- [ ] 4.3 Implement `status lint` for folder/layout/naming violations and stale index detection
- [ ] 4.4 Add baseline lint rule: detect disallowed file types by folder (e.g., PDFs in `forms/`)
- [ ] 4.5 Add tests for status inference, lint failures, and stale-index detection

## 5. Documentation and integration

- [ ] 5.1 Add top-level docs describing relationship between `open-agreements` and workspace package
- [ ] 5.2 Document local-synced Google Drive usage model (filesystem-only)
- [ ] 5.3 Document out-of-scope items (signature requests, PDF splitting) and future extension points

## 6. Validation

- [ ] 6.1 Run `openspec validate add-contracts-workspace-cli --strict`
- [ ] 6.2 Run workspace package tests and build checks
- [ ] 6.3 Confirm no regressions to existing `open-agreements` tests/build
