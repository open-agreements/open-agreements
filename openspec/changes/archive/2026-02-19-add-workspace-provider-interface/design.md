## Context

The contracts-workspace package calls `node:fs` directly in every core module.
This tight coupling prevents alternative backends (Google Drive API, SharePoint,
S3) and makes unit tests slow (real disk I/O for every test). Defining an
abstract provider interface now — before adding convention config and cloud
backends — establishes the right boundary early.

This change is a mechanical extraction: behavior is identical, only the
abstraction boundary changes.

Stakeholders: open-agreements maintainers, future cloud backend contributors,
test authors.

## Goals / Non-Goals

- Goals:
  - Define `WorkspaceProvider` interface that any backend can implement
  - Extract `FilesystemProvider` from existing code (identical behavior)
  - Provide `MemoryProvider` for fast unit tests
  - Zero breaking changes to public API
  - Prepare for convention config change (which needs provider to read config)

- Non-Goals:
  - Implement Google Drive, SharePoint, or any cloud provider
  - Add authentication or OAuth
  - Build a plugin/registration system for providers
  - Change async/sync behavior of existing code

## Decisions

### Interface shape

```typescript
interface WorkspaceProvider {
  readonly root: string;

  exists(relativePath: string): boolean | Promise<boolean>;
  readFile(relativePath: string): Buffer | Promise<Buffer>;
  readTextFile(relativePath: string): string | Promise<string>;
  writeFile(relativePath: string, content: string | Buffer): void | Promise<void>;
  mkdir(relativePath: string, options?: { recursive?: boolean }): void | Promise<void>;
  readdir(relativePath: string): FileInfo[] | Promise<FileInfo[]>;
  stat(relativePath: string): FileInfo | Promise<FileInfo>;
  walk(relativePath: string): FileInfo[] | Promise<FileInfo[]>;
}

interface FileInfo {
  name: string;
  relativePath: string;
  isDirectory: boolean;
  mtime: Date;
  size: number;
}
```

- Decision: Interface, not abstract class.
- Why: No inheritance coupling. Any object satisfying the shape works. Enables
  easy mocking in tests without class hierarchies.
- Alternative: Abstract class with shared helpers. Rejected — shared helpers
  can be standalone functions that accept a provider.

### Sync/async return types

- Decision: Methods return `T | Promise<T>`. FilesystemProvider returns `T`
  (synchronous, matching current behavior). Future API providers return
  `Promise<T>`.
- Why: Callers use `await` uniformly — awaiting a non-Promise value is a no-op.
  This avoids a breaking interface change when async providers arrive.
- Alternative: All methods return `Promise<T>`. Rejected because it forces
  unnecessary async overhead on the synchronous filesystem path and requires
  updating all existing callers to be async.

### Provider carries root

- Decision: Each provider instance is bound to a workspace root. All paths in
  method calls are relative to that root.
- Why: Eliminates repeated root path construction. Keeps method signatures clean.
  The root is set once at creation and doesn't change.
- Alternative: Pass absolute paths to every method. Rejected — verbose and
  error-prone (root path leaks into every call site).

### Factory function

```typescript
function createProvider(rootDir: string, options?: ProviderOptions): WorkspaceProvider {
  return new FilesystemProvider(rootDir);
}
```

- Decision: Simple factory that returns FilesystemProvider in v1. Extension point
  for future backend selection based on options (e.g., `type: 'gdrive'`).
- Why: Centralizes provider creation. When Google Drive support arrives, callers
  don't change — only the factory gains a new branch.
- Alternative: Direct construction everywhere. Rejected — scatters provider
  selection logic.

### MemoryProvider design

- Decision: In-memory Map<string, Buffer | Set<string>> representing files and
  directories. Supports the full WorkspaceProvider interface.
- Why: Fast tests without disk I/O or temp directory cleanup. Deterministic
  mtime values for reproducible tests.
- Scope: Test helper only — not exported from the main package entry point.
  Exported from a `/testing` subpath export.

### Optional provider parameter pattern

```typescript
// Before
export function lintWorkspace(rootDir: string): LintReport { ... }

// After
export function lintWorkspace(
  rootDir: string,
  provider?: WorkspaceProvider
): LintReport {
  const p = provider ?? new FilesystemProvider(rootDir);
  // ... use p instead of fs.*
}
```

- Decision: Add optional `provider` parameter to all core functions. Default to
  `FilesystemProvider(rootDir)` when omitted.
- Why: Zero breaking changes. Existing code calling `lintWorkspace(dir)` works
  identically. New code can inject a mock or alternative provider.
- Alternative: Remove `rootDir` parameter, require provider. Rejected — breaking
  change to public API.

## Risks / Trade-offs

- Risk: Over-abstraction for a single backend
  → Mitigation: The extraction is mechanical — no new behavior, just a boundary.
  The MemoryProvider pays for itself immediately in test speed. The interface cost
  is ~50 lines of types.

- Risk: Sync/async split causes confusion
  → Mitigation: Document that FilesystemProvider is sync and callers should
  `await` uniformly. TypeScript catches misuse at compile time.

- Risk: Provider root assumption doesn't fit all backends
  → Mitigation: Google Drive "root" would be a folder ID. SharePoint "root" would
  be a site/library path. The `root` property is `string` — flexible enough for
  any identifier.

## Migration Plan

1. Add `WorkspaceProvider` interface and `FileInfo` type
2. Implement `FilesystemProvider` by extracting from existing code
3. Implement `MemoryProvider` for tests
4. Add `createProvider` factory
5. Update core functions one at a time (each is an independent commit)
6. Update exports
7. All changes are backward-compatible — zero breaking changes

## Open Questions

- Should `MemoryProvider` be exported from a `/testing` subpath or kept internal
  to the package? Leaning toward subpath export so downstream packages can use it.
- Should the interface include a `copy()` method for file duplication, or is
  `readFile()` + `writeFile()` sufficient? Leaning toward no — keep the interface
  minimal and compose.
