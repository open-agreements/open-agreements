import { createProvider } from './filesystem-provider.js';
import { loadSidecar, isSidecarStale, detectOrphanedSidecars } from './analysis-store.js';
import type { WorkspaceProvider } from './provider.js';
import type { DocumentRecord, StatusIndex, AnalysisSummary } from './types.js';

/**
 * Enrich a DocumentRecord with sidecar data (classification, analyzed, stale flags).
 */
export function enrichDocumentRecord(
  rootDir: string,
  record: DocumentRecord,
  provider?: WorkspaceProvider,
): DocumentRecord {
  const p = provider ?? createProvider(rootDir);
  const sidecar = loadSidecar(rootDir, record.path, p);

  if (!sidecar) {
    return { ...record, analyzed: false, stale: false };
  }

  const staleness = isSidecarStale(rootDir, record.path, p);

  return {
    ...record,
    analyzed: true,
    stale: staleness.stale,
    classification: sidecar.classification
      ? {
          document_type: sidecar.classification.document_type,
          parties: sidecar.classification.parties,
          summary: sidecar.classification.summary,
          status: sidecar.classification.status,
          auto_renewal: sidecar.classification.auto_renewal,
          expiration_date: sidecar.classification.expiration_date,
          suggested_rename: sidecar.classification.suggested_rename,
        }
      : undefined,
  };
}

/**
 * Build an analysis summary for the status index.
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
  let pendingSignature = 0;
  let expiring30 = 0;
  let expiring3090 = 0;
  const expiringSoon: Array<{ path: string; expiration_date: string; document_type: string }> = [];

  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const ninetyDaysFromNow = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  for (const doc of documents) {
    const sidecar = loadSidecar(rootDir, doc.path, p);
    if (!sidecar) continue;

    analyzedCount++;

    const staleness = isSidecarStale(rootDir, doc.path, p);
    if (staleness.stale) staleCount++;

    if (sidecar.classification) {
      const docType = sidecar.classification.document_type ?? 'unclassified';
      byDocumentType[docType] = (byDocumentType[docType] ?? 0) + 1;

      // Signature status
      const sigStatus = sidecar.classification.status;
      if (sigStatus === 'draft' || sigStatus === 'pending') {
        pendingSignature++;
      }

      // Expiration buckets
      if (sidecar.classification.expiration_date) {
        const expDate = new Date(sidecar.classification.expiration_date);
        if (expDate >= now && expDate <= thirtyDaysFromNow) {
          expiring30++;
          expiringSoon.push({
            path: doc.path,
            expiration_date: sidecar.classification.expiration_date,
            document_type: docType,
          });
        } else if (expDate > thirtyDaysFromNow && expDate <= ninetyDaysFromNow) {
          expiring3090++;
          expiringSoon.push({
            path: doc.path,
            expiration_date: sidecar.classification.expiration_date,
            document_type: docType,
          });
        }
      }
    }
  }

  const orphans = detectOrphanedSidecars(rootDir, p);

  expiringSoon.sort((a, b) => a.expiration_date.localeCompare(b.expiration_date));

  return {
    analyzed_documents: analyzedCount,
    unanalyzed_documents: documents.length - analyzedCount,
    stale_documents: staleCount,
    orphaned_sidecars: orphans.length,
    pending_signature: pendingSignature,
    expiring_30_days: expiring30,
    expiring_30_90_days: expiring3090,
    by_document_type: byDocumentType,
    expiring_soon: expiringSoon,
  };
}

/**
 * Enrich an entire StatusIndex with analysis data.
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
