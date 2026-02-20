## 0. Dependency

- [x] 0.1 Confirm `add-workspace-provider-interface` is implemented and merged

## 1. Convention config schema and loader

- [x] 1.1 Define `ConventionConfig` type in `types.ts`
- [x] 1.2 Create `convention-config.ts` with `loadConventions(provider)` that reads `.contracts-workspace/conventions.yaml` and falls back to defaults
- [x] 1.3 Create `writeConventions(provider, config)` to persist conventions to YAML
- [x] 1.4 Add Zod schema validation for convention config (`ConventionConfigSchema`)
- [x] 1.5 Add tests for config load, write, fallback, and validation

## 2. Convention scanner

- [x] 2.1 Create `convention-scanner.ts` with `scanExistingConventions(provider)`
- [x] 2.2 Implement status marker detection (`_executed`, `_signed`, `(fully executed)`, etc.)
- [x] 2.3 Implement naming style detection (`snake_case`, `kebab-case`, `title-case-spaces`, `title-case-dash`)
- [x] 2.4 Implement lifecycle applicability inference (domain folders vs asset folders)
- [x] 2.5 Implement bias-toward-defaults logic (defaults when fewer than 5 files or no clear majority)
- [x] 2.6 Add tests for scanner with varied filename corpora

## 3. Adaptive init

- [x] 3.1 Update `initializeWorkspace()` to call scanner when directory is non-empty, default conventions otherwise
- [x] 3.2 Write scanned conventions to `.contracts-workspace/conventions.yaml` during init
- [x] 3.3 Only create lifecycle subfolders for domains marked as lifecycle-applicable in config
- [x] 3.4 Preserve existing folder structures — do not rename or move existing files
- [x] 3.5 Add tests for init on non-empty directories with varied conventions

## 4. WORKSPACE.md and FOLDER.md generation

- [x] 4.1 Generate root `WORKSPACE.md` during init via `buildWorkspaceMd()`
- [x] 4.2 Generate per-domain `FOLDER.md` via `buildFolderMd()` into each existing lifecycle directory
- [x] 4.3 Make WORKSPACE.md and FOLDER.md templates convention-aware (reflect configured naming style and executed marker)
- [x] 4.4 Ensure idempotent re-generation — uses sentinel comments (`<!-- contracts-workspace:begin/end -->`); on re-init replaces content between sentinels, preserves user additions outside
- [x] 4.5 Add tests for WORKSPACE.md and FOLDER.md content generation

## 5. Convention-aware lint

- [x] 5.1 Update `lintWorkspace()` to load conventions from config
- [x] 5.2 Make executed-suffix detection configurable (match configured marker instead of hardcoded `_executed`)
- [x] 5.3 Add filename-vs-folder consistency warning (executed marker present but file not in executed folder)
- [x] 5.4 Make disallowed-file-type rules convention-aware — reads from `disallowed_file_types` in convention config (default: `{ forms: [pdf] }`)
- [x] 5.5 Add tests for lint with non-default conventions

## 6. Convention-aware indexer

- [x] 6.1 Update `hasExecutedMarker()` to accept configured suffix pattern
- [x] 6.2 Update `collectWorkspaceDocuments()` to read conventions for status inference
- [x] 6.3 Add tests for indexer with non-default executed suffixes

## 7. Backward compatibility

- [x] 7.1 Ensure all existing tests pass without convention config present (fallback to defaults)
- [x] 7.2 Verify `constants.ts` values are used as defaults when no config exists
- [x] 7.3 Add integration test: init on empty directory produces same result as before this change

## 8. Documentation

- [x] 8.1 Update `packages/contracts-workspace/README.md` with convention config documentation (schema table, adaptive init, generated docs sections)
- [x] 8.2 Update `docs/contracts-workspace.md` with adaptive init, FOLDER.md guidance, and full lint rule list
- [x] 8.3 Update `buildContractsGuide()` to read from convention config (naming style, executed marker, conventions.yaml reference)

## 9. Validation

- [x] 9.1 Workspace package tests pass (68/68)
- [x] 9.2 No regressions to existing tests/build
- [x] 9.3 JSON Schema snapshot updated for new `disallowed_file_types` field
