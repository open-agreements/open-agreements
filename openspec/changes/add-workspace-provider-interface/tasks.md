## 1. WorkspaceProvider interface

- [ ] 1.1 Define `WorkspaceProvider` interface in `provider.ts` with methods: `exists()`, `readFile()`, `writeFile()`, `mkdir()`, `readdir()`, `stat()`, `walk()`
- [ ] 1.2 Define `FileInfo` type (name, path, isDirectory, mtime, size)
- [ ] 1.3 Define `ProviderOptions` type (root path/identifier, read-only flag)
- [ ] 1.4 Export all provider types from `types.ts` and `index.ts`

## 2. FilesystemProvider implementation

- [ ] 2.1 Create `filesystem-provider.ts` implementing `WorkspaceProvider` using `node:fs`
- [ ] 2.2 Extract filesystem operations from `workspace-structure.ts` into provider methods
- [ ] 2.3 Extract filesystem operations from `indexer.ts` (`walkFiles`) into provider `walk()` method
- [ ] 2.4 Extract filesystem operations from `lint.ts` into provider calls
- [ ] 2.5 Extract filesystem operations from `catalog.ts` into provider calls
- [ ] 2.6 Add unit tests for FilesystemProvider

## 3. MemoryProvider for tests

- [ ] 3.1 Create `memory-provider.ts` implementing `WorkspaceProvider` with in-memory file tree
- [ ] 3.2 Support read, write, mkdir, stat, walk operations against the in-memory tree
- [ ] 3.3 Add unit tests for MemoryProvider
- [ ] 3.4 Demonstrate usage in at least one existing test file as a replacement for disk-based test fixtures

## 4. Provider factory

- [ ] 4.1 Create `createProvider(rootDir, options?)` factory function in `provider.ts`
- [ ] 4.2 Default to `FilesystemProvider` in v1
- [ ] 4.3 Add test for factory returning correct provider type

## 5. Core function refactoring

- [ ] 5.1 Update `initializeWorkspace(rootDir, options?)` to accept optional `provider` parameter, defaulting to `FilesystemProvider`
- [ ] 5.2 Update `lintWorkspace(rootDir)` to accept optional `provider` parameter
- [ ] 5.3 Update `collectWorkspaceDocuments(rootDir)` to accept optional `provider` parameter
- [ ] 5.4 Update `buildStatusIndex()` to accept optional `provider` parameter
- [ ] 5.5 Update `validateCatalog()` and `fetchCatalogEntries()` to accept optional `provider` parameter
- [ ] 5.6 Update `writeStatusIndex()` to accept optional `provider` parameter
- [ ] 5.7 Verify all command-layer callers work with default provider (no changes needed in commands/)

## 6. Public API exports

- [ ] 6.1 Export `WorkspaceProvider`, `FilesystemProvider`, `MemoryProvider`, `createProvider` from `index.ts`
- [ ] 6.2 Export provider-related types (`FileInfo`, `ProviderOptions`)

## 7. Backward compatibility

- [ ] 7.1 Ensure all existing tests pass without any provider argument (default FilesystemProvider used)
- [ ] 7.2 Verify CLI commands work unchanged (commands layer passes no provider, gets default)
- [ ] 7.3 Add integration test confirming identical behavior with explicit FilesystemProvider vs omitted provider

## 8. Documentation

- [ ] 8.1 Update `packages/contracts-workspace/README.md` with provider architecture section
- [ ] 8.2 Document how to implement a custom provider
- [ ] 8.3 Document MemoryProvider usage for testing

## 9. Validation

- [ ] 9.1 Run `openspec validate add-workspace-provider-interface --strict`
- [ ] 9.2 Run workspace package tests and build checks
- [ ] 9.3 Confirm no regressions to existing `open-agreements` tests/build
