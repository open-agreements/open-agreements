## ADDED Requirements

### Requirement: Workspace Provider Interface
The workspace tooling SHALL define an abstract `WorkspaceProvider` interface
that encapsulates all filesystem operations (read, write, list, walk, stat,
exists, mkdir). All core workspace functions SHALL accept an optional provider
parameter. When no provider is supplied, functions SHALL default to a
filesystem-backed provider for backward compatibility.

#### Scenario: Core function with explicit provider
- **WHEN** `lintWorkspace(rootDir, provider)` is called with a custom provider
- **THEN** all file operations go through the provided provider
- **AND** no direct `node:fs` calls are made

#### Scenario: Core function without provider uses default
- **WHEN** `lintWorkspace(rootDir)` is called without a provider argument
- **THEN** a `FilesystemProvider` is created automatically for `rootDir`
- **AND** behavior is identical to the pre-provider codebase

### Requirement: Filesystem Provider
The workspace tooling SHALL include a `FilesystemProvider` class implementing
`WorkspaceProvider` using `node:fs` operations. The provider SHALL be bound to
a workspace root directory and operate on relative paths within that root. The
provider SHALL produce identical behavior to the pre-refactor direct `fs` calls.

#### Scenario: FilesystemProvider reads file
- **WHEN** `provider.readTextFile("forms/nda.docx")` is called
- **THEN** the provider reads `{root}/forms/nda.docx` from the local filesystem
- **AND** returns the file contents as a string

#### Scenario: FilesystemProvider walks directory
- **WHEN** `provider.walk("executed/")` is called
- **THEN** the provider recursively lists all files under `{root}/executed/`
- **AND** returns `FileInfo` objects with name, relative path, mtime, and size

#### Scenario: FilesystemProvider handles missing path
- **WHEN** `provider.exists("nonexistent/path")` is called
- **THEN** the provider returns `false`
- **AND** does not throw an error

### Requirement: Memory Provider for Testing
The workspace tooling SHALL include a `MemoryProvider` implementing
`WorkspaceProvider` with an in-memory file tree. The provider SHALL support
all interface operations against the in-memory tree for fast, deterministic
unit tests without disk I/O.

#### Scenario: MemoryProvider supports full lifecycle
- **WHEN** a test creates a `MemoryProvider` and writes files via `writeFile()`
- **THEN** `readTextFile()`, `exists()`, `readdir()`, `stat()`, and `walk()` return consistent results
- **AND** no disk I/O occurs

#### Scenario: MemoryProvider used in lint test
- **WHEN** `lintWorkspace(root, memoryProvider)` is called with a pre-populated MemoryProvider
- **THEN** lint validates the in-memory workspace structure
- **AND** the test runs without creating temporary directories

### Requirement: Provider Factory
The workspace tooling SHALL provide a `createProvider(rootDir, options?)`
factory function that returns the appropriate `WorkspaceProvider` for the given
root. In v1, the factory SHALL always return a `FilesystemProvider`. The factory
serves as the extension point for future backend registration.

#### Scenario: Factory returns FilesystemProvider by default
- **WHEN** `createProvider("/path/to/workspace")` is called
- **THEN** the returned provider is a `FilesystemProvider` bound to `/path/to/workspace`

#### Scenario: Factory accepts options for future extensibility
- **WHEN** `createProvider(root, { type: "filesystem" })` is called
- **THEN** the factory returns a `FilesystemProvider`
- **AND** the options parameter exists for future backend types

## MODIFIED Requirements

### Requirement: Filesystem-Only Operation in v1
The workspace tooling SHALL operate on local filesystem directories only in v1,
including locally synced cloud-drive folders. It SHALL NOT require cloud API
integrations in this change. All filesystem access SHALL go through the
`WorkspaceProvider` interface to enable future non-filesystem backends.

#### Scenario: Local synced drive compatibility
- **WHEN** a user runs workspace commands in a locally synced Google Drive folder
- **THEN** commands operate using `FilesystemProvider` with normal filesystem semantics
- **AND** no Google Drive API credentials are required

#### Scenario: All fs access via provider
- **WHEN** any core workspace function performs file operations
- **THEN** operations go through the `WorkspaceProvider` interface
- **AND** no direct `node:fs` imports exist in core modules (except `FilesystemProvider` itself)

### Requirement: Independent Package Boundary
Contracts workspace functionality SHALL be delivered as a sibling package/CLI,
independently installable from the existing OpenAgreements template-filling CLI.
The package SHALL export the `WorkspaceProvider` interface and built-in provider
implementations for use by downstream packages and integrations.

#### Scenario: Workspace-only adoption
- **WHEN** a user installs the workspace package without installing template-filling tooling
- **THEN** workspace commands are available
- **AND** template-filling commands are not required for workspace initialization, catalog, or status features

#### Scenario: Provider types are importable
- **WHEN** a downstream package imports from `@open-agreements/contracts-workspace`
- **THEN** `WorkspaceProvider`, `FilesystemProvider`, `MemoryProvider`, `createProvider`, and `FileInfo` are available as named exports
