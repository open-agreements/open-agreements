import { createHash } from 'node:crypto';
import { resolve, relative } from 'node:path';
import { dump, load } from 'js-yaml';
import { ANALYSIS_DOCUMENTS_DIR, CONFIG_FILE } from './constants.js';
import { DOCUMENT_TYPES } from './analysis-types.js';
import { createProvider } from './filesystem-provider.js';
import type { WorkspaceProvider } from './provider.js';
import type { DocumentAnalysis, DocumentClassification, ClauseExtraction, DocumentType } from './analysis-types.js';

/** Validate that a document path doesn't escape the workspace root. */
function assertSafePath(documentPath: string): void {
  if (documentPath.includes('..') || documentPath.startsWith('/')) {
    throw new Error(`Unsafe document path: "${documentPath}". Path must be relative and within the workspace.`);
  }
}

/** Map a document's relative path to its sidecar path. */
export function sidecarPath(documentRelativePath: string): string {
  return `${ANALYSIS_DOCUMENTS_DIR}/${documentRelativePath}.contract.yaml`;
}

/** Compute SHA-256 hash of file content, prefixed with "sha256:". */
export function contentHash(content: Buffer): string {
  const hash = createHash('sha256').update(content).digest('hex');
  return `sha256:${hash}`;
}

/** Compute content hash for a document via provider. */
export function computeContentHash(provider: WorkspaceProvider, documentPath: string): string {
  const content = provider.readFile(documentPath);
  return contentHash(content);
}

/** Load custom document types from config. */
export function loadCustomDocumentTypes(provider: WorkspaceProvider): string[] {
  if (!provider.exists(CONFIG_FILE)) return [];
  const text = provider.readTextFile(CONFIG_FILE);
  const config = load(text) as Record<string, unknown>;
  const custom = config?.custom_document_types;
  return Array.isArray(custom) ? custom.filter((t): t is string => typeof t === 'string') : [];
}

/** Get all valid document types (canonical + custom). */
export function getValidDocumentTypes(provider: WorkspaceProvider): string[] {
  const custom = loadCustomDocumentTypes(provider);
  return [...DOCUMENT_TYPES, ...custom];
}

export interface TypeValidationResult {
  valid: boolean;
  document_type: DocumentType | null;
  raw_type?: string;
  warning?: string;
}

/** Validate a document type against the canonical + custom list. */
export function validateDocumentType(
  type: string,
  provider: WorkspaceProvider,
): TypeValidationResult {
  const validTypes = getValidDocumentTypes(provider);
  if (validTypes.includes(type)) {
    return { valid: true, document_type: type as DocumentType };
  }
  return {
    valid: false,
    document_type: null,
    raw_type: type,
    warning: `Unknown document type "${type}". Valid types: ${validTypes.join(', ')}. Stored as raw_type; add to .contracts-workspace/config.yaml custom_document_types to resolve.`,
  };
}

/** Load an existing sidecar, or null if none exists. */
export function loadSidecar(
  rootDir: string,
  documentPath: string,
  provider?: WorkspaceProvider,
): DocumentAnalysis | null {
  assertSafePath(documentPath);
  const p = provider ?? createProvider(rootDir);
  const path = sidecarPath(documentPath);
  if (!p.exists(path)) return null;

  const text = p.readTextFile(path);
  return load(text) as DocumentAnalysis;
}

export interface IndexContractInput {
  documentPath: string;
  classification?: {
    document_type: string;
    raw_type?: string;
    confidence: 'high' | 'medium' | 'low';
    parties: string[];
    effective_date?: string;
    expiration_date?: string;
    governing_law?: string;
    summary: string;
    status?: 'draft' | 'pending' | 'executed' | 'unknown';
    auto_renewal?: boolean;
    notice_period_days?: number;
    suggested_rename?: string;
    key_terms?: Record<string, string>;
  };
  extractions?: ClauseExtraction[];
  indexedBy?: string;
}

export interface IndexContractResult {
  analysis: DocumentAnalysis;
  warning?: string;
}

/**
 * Index a contract — save classification and/or extractions.
 * Merges with existing sidecar (partial updates supported).
 * Atomic write: writes to .tmp then renames.
 */
export function indexContract(
  rootDir: string,
  input: IndexContractInput,
  provider?: WorkspaceProvider,
): IndexContractResult {
  const p = provider ?? createProvider(rootDir);
  const { documentPath, classification, extractions, indexedBy } = input;
  assertSafePath(documentPath);

  const hash = computeContentHash(p, documentPath);
  const existing = loadSidecar(rootDir, documentPath, p);

  let resolvedClassification: DocumentClassification | undefined;
  let warning: string | undefined;

  if (classification) {
    const typeResult = validateDocumentType(classification.document_type, p);
    resolvedClassification = {
      document_type: typeResult.document_type,
      raw_type: typeResult.raw_type ?? classification.raw_type,
      confidence: classification.confidence,
      parties: classification.parties,
      effective_date: classification.effective_date,
      expiration_date: classification.expiration_date,
      governing_law: classification.governing_law,
      summary: classification.summary,
      status: classification.status,
      auto_renewal: classification.auto_renewal,
      notice_period_days: classification.notice_period_days,
      suggested_rename: classification.suggested_rename,
      key_terms: classification.key_terms,
    };
    warning = typeResult.warning;
  }

  const analysis: DocumentAnalysis = {
    schema_version: 1,
    document_path: documentPath,
    content_hash: hash,
    indexed_at: new Date().toISOString(),
    indexed_by: indexedBy ?? 'agent',
    classification: resolvedClassification ?? existing?.classification,
    extractions: extractions ?? existing?.extractions ?? [],
  };

  const path = sidecarPath(documentPath);
  const dir = path.slice(0, path.lastIndexOf('/'));
  p.mkdir(dir, { recursive: true });

  const yaml = dump(analysis, { noRefs: true, lineWidth: 120, sortKeys: false });
  p.writeFile(path, yaml);

  return { analysis, warning };
}

/** Check if a document's sidecar is stale (content changed since last indexing). */
export function isSidecarStale(
  rootDir: string,
  documentPath: string,
  provider?: WorkspaceProvider,
): { stale: boolean; reason?: string } {
  assertSafePath(documentPath);
  const p = provider ?? createProvider(rootDir);
  const sidecar = loadSidecar(rootDir, documentPath, p);
  if (!sidecar) return { stale: false };

  if (!p.exists(documentPath)) {
    return { stale: true, reason: 'document_missing' };
  }

  const currentHash = computeContentHash(p, documentPath);
  if (currentHash !== sidecar.content_hash) {
    return { stale: true, reason: 'content_changed' };
  }

  return { stale: false };
}

export interface PendingDocument {
  path: string;
  reason: 'new' | 'content_changed' | 'incomplete';
  content_hash: string;
  document_type?: string | null;
  parties?: string[];
  last_indexed_at?: string;
}

/**
 * List documents needing indexing.
 */
export function listUnindexedDocuments(
  rootDir: string,
  documents: Array<{ path: string }>,
  provider?: WorkspaceProvider,
): PendingDocument[] {
  const p = provider ?? createProvider(rootDir);
  const pending: PendingDocument[] = [];

  for (const doc of documents) {
    const sidecar = loadSidecar(rootDir, doc.path, p);

    if (!sidecar) {
      const hash = computeContentHash(p, doc.path);
      pending.push({ path: doc.path, reason: 'new', content_hash: hash });
      continue;
    }

    const currentHash = computeContentHash(p, doc.path);
    if (currentHash !== sidecar.content_hash) {
      pending.push({
        path: doc.path,
        reason: 'content_changed',
        content_hash: currentHash,
        document_type: sidecar.classification?.document_type,
        parties: sidecar.classification?.parties,
        last_indexed_at: sidecar.indexed_at,
      });
      continue;
    }

    if (!sidecar.classification) {
      pending.push({
        path: doc.path,
        reason: 'incomplete',
        content_hash: currentHash,
        last_indexed_at: sidecar.indexed_at,
      });
    }
  }

  return pending;
}

/** Detect orphaned sidecars (source document no longer exists). */
export function detectOrphanedSidecars(
  rootDir: string,
  provider?: WorkspaceProvider,
): string[] {
  const p = provider ?? createProvider(rootDir);
  const orphans: string[] = [];

  if (!p.exists(ANALYSIS_DOCUMENTS_DIR)) return orphans;

  const sidecarFiles = p.walk(ANALYSIS_DOCUMENTS_DIR);
  for (const file of sidecarFiles) {
    if (!file.name.endsWith('.contract.yaml')) continue;
    const text = p.readTextFile(file.relativePath);
    const sidecar = load(text) as DocumentAnalysis;
    if (sidecar?.document_path && !p.exists(sidecar.document_path)) {
      orphans.push(sidecar.document_path);
    }
  }

  return orphans;
}
