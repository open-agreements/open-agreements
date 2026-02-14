export { initializeWorkspace, inferLifecycle, buildWorkspaceMd, buildFolderMd } from './core/workspace-structure.js';
export { validateCatalog, loadCatalog, writeCatalog, fetchCatalogEntries, checksumSha256 } from './core/catalog.js';
export { lintWorkspace } from './core/lint.js';
export { collectWorkspaceDocuments, buildStatusIndex, writeStatusIndex, hasExecutedMarker, hasPartiallyExecutedMarker } from './core/indexer.js';
export type { WorkspaceProvider, FileInfo } from './core/provider.js';
export { FilesystemProvider, createProvider } from './core/filesystem-provider.js';
export { MemoryProvider } from './core/memory-provider.js';
export { loadConventions, writeConventions, defaultConventions } from './core/convention-config.js';
export { scanExistingConventions } from './core/convention-scanner.js';
export type {
  AgentName,
  InitWorkspaceOptions,
  InitWorkspaceResult,
  LintFinding,
  LintReport,
  DocumentRecord,
  StatusIndex,
  CatalogEntry,
  FormsCatalog,
  FetchResult,
  FetchSummary,
  ConventionConfig,
} from './core/types.js';
