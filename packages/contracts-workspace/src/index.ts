export { initializeWorkspace, inferLifecycle } from './core/workspace-structure.js';
export { validateCatalog, loadCatalog, writeCatalog, fetchCatalogEntries, checksumSha256 } from './core/catalog.js';
export { lintWorkspace } from './core/lint.js';
export { collectWorkspaceDocuments, buildStatusIndex, writeStatusIndex, hasExecutedMarker } from './core/indexer.js';
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
} from './core/types.js';
