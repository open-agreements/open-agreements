export {
  initializeWorkspace,
  planWorkspaceInitialization,
  inferLifecycle,
  buildWorkspaceMd,
  buildFolderMd,
} from './core/workspace-structure.js';
export { validateCatalog, loadCatalog, writeCatalog, fetchCatalogEntries, checksumSha256, FormsCatalogSchema, CatalogEntrySchema } from './core/catalog.js';
export { lintWorkspace } from './core/lint.js';
export { collectWorkspaceDocuments, buildStatusIndex, writeStatusIndex, hasExecutedMarker, hasPartiallyExecutedMarker } from './core/indexer.js';
export type { WorkspaceProvider, FileInfo } from './core/provider.js';
export { FilesystemProvider, createProvider } from './core/filesystem-provider.js';
export { MemoryProvider } from './core/memory-provider.js';
export { loadConventions, writeConventions, defaultConventions, ConventionConfigSchema } from './core/convention-config.js';
export { scanExistingConventions } from './core/convention-scanner.js';
export type {
  AgentName,
  InitWorkspaceOptions,
  InitWorkspacePlanResult,
  InitWorkspaceResult,
  LintFinding,
  LintReport,
  DocumentRecord,
  StatusIndex,
  AnalysisSummary,
  CatalogEntry,
  FormsCatalog,
  FetchResult,
  FetchSummary,
  ConventionConfig,
} from './core/types.js';
export type { DocumentType, DocumentClassification, ClauseExtraction, DocumentAnalysis } from './core/analysis-types.js';
export {
  analysisPath,
  generateDocumentId,
  contentHash,
  computeContentHash,
  loadAnalysis,
  saveAnalysis,
  isAnalysisStale,
  listPendingDocuments,
} from './core/analysis-store.js';
export type { SaveAnalysisInput, PendingDocument } from './core/analysis-store.js';
export { enrichDocumentRecord, buildAnalysisSummary, enrichStatusIndex } from './core/analysis-indexer.js';
