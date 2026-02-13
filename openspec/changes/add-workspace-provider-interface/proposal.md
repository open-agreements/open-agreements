# Change: Add abstract workspace provider interface

## Why

The contracts-workspace CLI is tightly coupled to the local filesystem — every
core function calls `fs.readdir()`, `fs.stat()`, `fs.writeFile()` directly.
This works for local folders and locally synced Google Drive, but prevents
future backends like the Google Drive API, SharePoint, or S3.

More immediately, defining the interface now creates a clean contract boundary
that improves testability (mock providers in tests), enables the convention
config work (provider reads/writes config), and establishes the Liskov
Substitution Principle: any tool built against the workspace interface works on
any backend without knowing which one it is.

This change defines the abstract `WorkspaceProvider` interface, refactors the
existing filesystem implementation to implement it, and updates all core
functions to accept a provider instead of raw `rootDir` strings.

## What Changes

- **`WorkspaceProvider` interface**: Defines the contract for workspace backends
  with operations: list documents in a folder, read file contents, write file
  contents, check file/folder existence, get file metadata (mtime, size), create
  directory, and walk directory trees recursively.
- **`FilesystemProvider`**: Refactors current `fs.*` calls into a class that
  implements `WorkspaceProvider`. This is a mechanical extraction — behavior is
  identical to current code.
- **Core function signatures updated**: `initializeWorkspace()`, `lintWorkspace()`,
  `collectWorkspaceDocuments()`, `buildStatusIndex()`, `validateCatalog()`, and
  `fetchCatalogEntries()` accept an optional `provider?: WorkspaceProvider`
  parameter. When omitted, they default to `FilesystemProvider` for backward
  compatibility.
- **Provider factory**: A `createProvider(rootDir, options?)` factory returns the
  appropriate provider. In v1, this always returns `FilesystemProvider`. The
  factory exists as the future extension point for registering additional backends.
- **Test helpers**: A `MemoryProvider` in-memory implementation for unit tests,
  enabling fast tests without disk I/O.

## Critical Design Decisions

- **Interface, not abstract class**: TypeScript interface (not abstract class) so
  providers have no inheritance coupling. Any object satisfying the contract works.
- **Optional provider parameter**: All public functions default to
  `FilesystemProvider` when no provider is given. This means zero breaking changes
  to existing callers — `initializeWorkspace(rootDir)` continues to work.
- **Read-write interface**: The provider supports both reading and writing. Some
  future backends may be read-only (e.g., an audit scanner); they can throw on
  write operations, but the interface itself is read-write because `init` and
  `catalog fetch` require writes.
- **No async in v1**: The `FilesystemProvider` uses synchronous `fs` operations
  (matching current code). The interface methods return `T | Promise<T>` so async
  providers (API-based) can be added without interface changes.
- **Provider carries root**: Each provider instance is bound to a workspace root
  (a directory path, a Drive ID, etc.). Methods operate on paths relative to that
  root. This keeps the interface simple and avoids passing absolute paths
  everywhere.

## Scope Boundaries

### In scope (this change)

- `WorkspaceProvider` interface definition
- `FilesystemProvider` implementation (extraction from current code)
- `MemoryProvider` for tests
- `createProvider()` factory
- Core function signature updates (optional provider parameter)
- Backward-compatible defaults (no breaking changes)

### Out of scope (future changes)

- Google Drive API provider
- SharePoint provider
- S3 / cloud storage providers
- Authentication/OAuth flows for cloud providers
- Provider registration/plugin system

## Impact

- Affected specs:
  - `contracts-workspace` (ADDED: provider interface requirements)
- Affected code:
  - New: `packages/contracts-workspace/src/core/provider.ts` (interface + factory)
  - New: `packages/contracts-workspace/src/core/filesystem-provider.ts`
  - New: `packages/contracts-workspace/src/core/memory-provider.ts` (test helper)
  - `packages/contracts-workspace/src/core/workspace-structure.ts` — accept provider
  - `packages/contracts-workspace/src/core/lint.ts` — accept provider
  - `packages/contracts-workspace/src/core/indexer.ts` — accept provider
  - `packages/contracts-workspace/src/core/catalog.ts` — accept provider
  - `packages/contracts-workspace/src/core/types.ts` — WorkspaceProvider type
  - `packages/contracts-workspace/src/index.ts` — export provider types
- Compatibility:
  - Non-breaking: all public functions maintain current signatures with optional provider
  - Existing tests continue to pass (use default FilesystemProvider)
  - New tests use MemoryProvider for faster execution
