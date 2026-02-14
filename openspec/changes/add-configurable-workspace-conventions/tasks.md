## 0. Dependency

- [ ] 0.1 Confirm `add-workspace-provider-interface` is implemented and merged (this change depends on the `WorkspaceProvider` interface being available)

## 1. Convention config schema and loader

- [ ] 1.1 Define `ConventionConfig` type in `types.ts` (executed suffix, naming style, lifecycle folder names, lifecycle-applicable domains, cross-reference policy)
- [ ] 1.2 Create `convention-config.ts` with `loadConventions(provider)` that reads `.contracts-workspace/conventions.yaml` and falls back to defaults from `constants.ts`
- [ ] 1.3 Create `writeConventions(provider, config)` to persist conventions to YAML
- [ ] 1.4 Add Zod schema validation for convention config
- [ ] 1.5 Add tests for config load, write, fallback, and validation

## 2. Convention scanner

- [ ] 2.1 Create `convention-scanner.ts` with `scanExistingConventions(provider)` that analyzes filenames in a workspace
- [ ] 2.2 Implement status marker detection (infer `_executed`, `(fully executed)`, `(signed)`, etc. from existing filenames)
- [ ] 2.3 Implement naming style detection (infer kebab-case, snake_case, Title Case with separators, etc.)
- [ ] 2.4 Implement lifecycle applicability inference (detect which domain folders contain lifecycle-stage content vs flat assets)
- [ ] 2.5 Implement bias-toward-defaults logic (use kebab-case and `_executed` when no clear convention is detected)
- [ ] 2.6 Add tests for scanner with varied filename corpora

## 3. Adaptive init

- [ ] 3.1 Update `initializeWorkspace()` to accept convention config and call scanner when directory is non-empty
- [ ] 3.2 Write scanned conventions to `.contracts-workspace/conventions.yaml` during init
- [ ] 3.3 Only create lifecycle subfolders for domains marked as lifecycle-applicable in config
- [ ] 3.4 Preserve existing folder structures — do not rename or move existing files
- [ ] 3.5 Add tests for init on non-empty directories with varied conventions

## 4. WORKSPACE.md and FOLDER.md generation

- [ ] 4.1 Generate root `WORKSPACE.md` during init documenting overall structure, ownership, and linking to per-folder FOLDER.md files
- [ ] 4.2 Generate per-domain `FOLDER.md` declaring purpose, naming convention, owner, and applicable lifecycle stages
- [ ] 4.3 Make WORKSPACE.md and FOLDER.md templates convention-aware (reflect configured naming style and status markers)
- [ ] 4.4 Ensure idempotent re-generation (preserve user edits by checking for sentinel comments)
- [ ] 4.5 Add tests for WORKSPACE.md and FOLDER.md content generation

## 5. Convention-aware lint

- [ ] 5.1 Update `lintWorkspace()` to load conventions from config
- [ ] 5.2 Make executed-suffix detection configurable (match configured marker instead of hardcoded `_executed`)
- [ ] 5.3 Add filename-vs-folder consistency warning (executed marker present but file not in executed folder)
- [ ] 5.4 Make disallowed-file-type rules convention-aware
- [ ] 5.5 Add tests for lint with non-default conventions

## 6. Convention-aware indexer

- [ ] 6.1 Update `hasExecutedMarker()` to accept configured suffix pattern
- [ ] 6.2 Update `collectWorkspaceDocuments()` to read conventions for status inference
- [ ] 6.3 Add tests for indexer with non-default executed suffixes

## 7. Backward compatibility

- [ ] 7.1 Ensure all existing tests pass without convention config present (fallback to defaults)
- [ ] 7.2 Verify `constants.ts` values are used as defaults when no config exists
- [ ] 7.3 Add integration test: init on empty directory produces same result as before this change

## 8. Documentation

- [ ] 8.1 Update `packages/contracts-workspace/README.md` with convention config documentation
- [ ] 8.2 Update `docs/contracts-workspace.md` with adaptive init and FOLDER.md guidance
- [ ] 8.3 Update generated `CONTRACTS.md` template to reference convention config

## 9. Validation

- [ ] 9.1 Run `openspec validate add-configurable-workspace-conventions --strict`
- [ ] 9.2 Run workspace package tests and build checks
- [ ] 9.3 Confirm no regressions to existing `open-agreements` tests/build
