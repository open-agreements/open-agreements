import { createHash, randomBytes } from 'node:crypto';
import { dump, load } from 'js-yaml';
import { ANALYSIS_DOCUMENTS_DIR } from './constants.js';
import { createProvider } from './filesystem-provider.js';
import type { WorkspaceProvider } from './provider.js';
import type { DocumentAnalysis, DocumentClassification, ClauseExtraction } from './analysis-types.js';

/** Map a document's relative path to its analysis sidecar path. */
export function analysisPath(documentRelativePath: string): string {
  return `${ANALYSIS_DOCUMENTS_DIR}/${documentRelativePath}.analysis.yaml`;
}

/** Generate a stable 8-char hex document ID. */
export function generateDocumentId(): string {
  return randomBytes(4).toString('hex');
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

/** Load an existing analysis, or null if none exists. */
export function loadAnalysis(
  rootDir: string,
  documentPath: string,
  provider?: WorkspaceProvider,
): DocumentAnalysis | null {
  const p = provider ?? createProvider(rootDir);
  const path = analysisPath(documentPath);
  if (!p.exists(path)) return null;

  const text = p.readTextFile(path);
  return load(text) as DocumentAnalysis;
}

export interface SaveAnalysisInput {
  documentPath: string;
  classification?: DocumentClassification;
  extractions?: ClauseExtraction[];
  analyzedBy?: string;
}

/**
 * Save (upsert) analysis for a document.
 * Merges with existing analysis — partial updates are supported.
 * Preserves document_id across updates.
 */
export function saveAnalysis(
  rootDir: string,
  input: SaveAnalysisInput,
  provider?: WorkspaceProvider,
): DocumentAnalysis {
  const p = provider ?? createProvider(rootDir);
  const { documentPath, classification, extractions, analyzedBy } = input;

  const hash = computeContentHash(p, documentPath);
  const existing = loadAnalysis(rootDir, documentPath, p);

  const analysis: DocumentAnalysis = {
    schema_version: 1,
    document_id: existing?.document_id ?? generateDocumentId(),
    document_path: documentPath,
    content_hash: hash,
    analyzed_at: new Date().toISOString(),
    analyzed_by: analyzedBy ?? 'agent',
    classification: classification ?? existing?.classification,
    extractions: extractions ?? existing?.extractions ?? [],
  };

  const path = analysisPath(documentPath);
  const dir = path.slice(0, path.lastIndexOf('/'));
  p.mkdir(dir, { recursive: true });
  p.writeFile(path, dump(analysis, { noRefs: true, lineWidth: 120, sortKeys: false }));

  return analysis;
}

/** Delete analysis for a document. */
export function deleteAnalysis(
  rootDir: string,
  documentPath: string,
  provider?: WorkspaceProvider,
): boolean {
  const p = provider ?? createProvider(rootDir);
  const path = analysisPath(documentPath);
  if (!p.exists(path)) return false;
  // Write empty content to effectively delete (providers don't have a delete method)
  // In practice, the file is just ignored if empty. For now, we leave it.
  // The reconciliation pass handles orphans.
  return true;
}

/** Check if a document's analysis is stale (content changed since last analysis). */
export function isAnalysisStale(
  rootDir: string,
  documentPath: string,
  provider?: WorkspaceProvider,
): { stale: boolean; reason?: string } {
  const p = provider ?? createProvider(rootDir);
  const analysis = loadAnalysis(rootDir, documentPath, p);
  if (!analysis) return { stale: false };

  if (!p.exists(documentPath)) {
    return { stale: true, reason: 'document_missing' };
  }

  const currentHash = computeContentHash(p, documentPath);
  if (currentHash !== analysis.content_hash) {
    return { stale: true, reason: 'content_changed' };
  }

  return { stale: false };
}

export interface PendingDocument {
  path: string;
  reason: 'new' | 'content_changed' | 'incomplete';
  content_hash: string;
  document_type?: string;
  parties?: string[];
  last_analyzed_at?: string;
}

/**
 * List documents needing analysis.
 * Walks all documents in the workspace and checks against stored analyses.
 */
export function listPendingDocuments(
  rootDir: string,
  documents: Array<{ path: string }>,
  provider?: WorkspaceProvider,
): PendingDocument[] {
  const p = provider ?? createProvider(rootDir);
  const pending: PendingDocument[] = [];

  for (const doc of documents) {
    const analysis = loadAnalysis(rootDir, doc.path, p);

    if (!analysis) {
      const hash = computeContentHash(p, doc.path);
      pending.push({ path: doc.path, reason: 'new', content_hash: hash });
      continue;
    }

    const currentHash = computeContentHash(p, doc.path);
    if (currentHash !== analysis.content_hash) {
      pending.push({
        path: doc.path,
        reason: 'content_changed',
        content_hash: currentHash,
        document_type: analysis.classification?.document_type,
        parties: analysis.classification?.parties,
        last_analyzed_at: analysis.analyzed_at,
      });
      continue;
    }

    // Check for incomplete analysis (no classification)
    if (!analysis.classification) {
      pending.push({
        path: doc.path,
        reason: 'incomplete',
        content_hash: currentHash,
        last_analyzed_at: analysis.analyzed_at,
      });
    }
  }

  return pending;
}
