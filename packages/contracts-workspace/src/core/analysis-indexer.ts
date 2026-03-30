import { loadConventions } from './convention-config.js';
import { createProvider } from './filesystem-provider.js';
import { loadAnalysis, isAnalysisStale } from './analysis-store.js';
import type { WorkspaceProvider } from './provider.js';
import type { DocumentRecord, StatusIndex, AnalysisSummary } from './types.js';

/**
 * Enrich a DocumentRecord with analysis data (classification, analyzed, stale flags).
 * Returns the record unchanged if no analysis exists.
 */
export function enrichDocumentRecord(
  rootDir: string,
  record: DocumentRecord,
  provider?: WorkspaceProvider,
): DocumentRecord {
  const p = provider ?? createProvider(rootDir);
  const analysis = loadAnalysis(rootDir, record.path, p);

  if (!analysis) {
    return { ...record, analyzed: false, stale: false };
  }

  const staleness = isAnalysisStale(rootDir, record.path, p);

  return {
    ...record,
    analyzed: true,
    stale: staleness.stale,
    classification: analysis.classification
      ? {
          document_type: analysis.classification.document_type,
          parties: analysis.classification.parties,
          summary: analysis.classification.summary,
        }
      : undefined,
  };
}

/**
 * Build an analysis summary for the status index.
 * Aggregates counts by document type, identifies expiring-soon contracts.
 */
export function buildAnalysisSummary(
  rootDir: string,
  documents: DocumentRecord[],
  provider?: WorkspaceProvider,
): AnalysisSummary {
  const p = provider ?? createProvider(rootDir);
  const byDocumentType: Record<string, number> = {};
  let analyzedCount = 0;
  let staleCount = 0;
  const expiringSoon: Array<{ path: string; expiration_date: string; document_type: string }> = [];

  const now = new Date();
  const ninetyDaysFromNow = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  for (const doc of documents) {
    const analysis = loadAnalysis(rootDir, doc.path, p);
    if (!analysis) continue;

    analyzedCount++;

    const staleness = isAnalysisStale(rootDir, doc.path, p);
    if (staleness.stale) staleCount++;

    if (analysis.classification) {
      const docType = analysis.classification.document_type;
      byDocumentType[docType] = (byDocumentType[docType] ?? 0) + 1;

      if (analysis.classification.expiration_date) {
        const expDate = new Date(analysis.classification.expiration_date);
        if (expDate <= ninetyDaysFromNow && expDate >= now) {
          expiringSoon.push({
            path: doc.path,
            expiration_date: analysis.classification.expiration_date,
            document_type: docType,
          });
        }
      }
    }
  }

  expiringSoon.sort((a, b) => a.expiration_date.localeCompare(b.expiration_date));

  return {
    analyzed_documents: analyzedCount,
    unanalyzed_documents: documents.length - analyzedCount,
    stale_documents: staleCount,
    by_document_type: byDocumentType,
    expiring_soon: expiringSoon,
  };
}

/**
 * Enrich an entire StatusIndex with analysis data.
 * Adds per-document classification and a global analysis summary.
 */
export function enrichStatusIndex(
  rootDir: string,
  baseIndex: StatusIndex,
  provider?: WorkspaceProvider,
): StatusIndex {
  const p = provider ?? createProvider(rootDir);

  const enrichedDocuments = baseIndex.documents.map((doc) =>
    enrichDocumentRecord(rootDir, doc, p),
  );

  const analysisSummary = buildAnalysisSummary(rootDir, enrichedDocuments, p);

  return {
    ...baseIndex,
    documents: enrichedDocuments,
    analysis: analysisSummary,
  };
}
