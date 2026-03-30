import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryProvider } from '../src/core/memory-provider.js';
import {
  analysisPath,
  contentHash,
  loadAnalysis,
  saveAnalysis,
  isAnalysisStale,
  listPendingDocuments,
} from '../src/core/analysis-store.js';
import {
  enrichDocumentRecord,
  buildAnalysisSummary,
  enrichStatusIndex,
} from '../src/core/analysis-indexer.js';
import type { DocumentRecord, StatusIndex } from '../src/core/types.js';
import type { DocumentClassification, ClauseExtraction } from '../src/core/analysis-types.js';
import { ANALYSIS_DOCUMENTS_DIR } from '../src/core/constants.js';

function createTestProvider(): MemoryProvider {
  const provider = new MemoryProvider('/test-workspace');
  provider.seed('drafts/acme_nda.docx', 'NDA content between Acme and TestCo');
  provider.seed('executed/partner_msa_executed.pdf', 'MSA content for partner agreement');
  provider.seed('incoming/vendor_agreement.txt', 'Vendor service agreement text');
  // Seed the conventions file so loadConventions doesn't fail
  provider.seed('.contracts-workspace/conventions.yaml', [
    'schema_version: 1',
    'executed_marker:',
    '  pattern: _executed',
    '  location: before_extension',
    'naming:',
    '  style: snake_case',
    '  separator: "_"',
    '  date_format: YYYY-MM-DD',
    'lifecycle:',
    '  folders:',
    '    forms: forms',
    '    drafts: drafts',
    '    incoming: incoming',
    '    executed: executed',
    '    archive: archive',
    '  applicable_domains:',
    '    - forms',
    '    - drafts',
    '    - incoming',
    '    - executed',
    '    - archive',
    '  asset_domains: []',
    'cross_references:',
    '  policy: warn',
    '  mechanism: filename',
    'documentation:',
    '  root_file: WORKSPACE.md',
    '  folder_file: FOLDER.md',
  ].join('\n'));
  return provider;
}

function makeDocumentRecord(path: string, lifecycle: 'forms' | 'drafts' | 'incoming' | 'executed' | 'archive'): DocumentRecord {
  const fileName = path.split('/').at(-1) ?? path;
  const extension = fileName.includes('.') ? fileName.slice(fileName.lastIndexOf('.') + 1) : '';
  return {
    path,
    file_name: fileName,
    extension,
    lifecycle,
    executed: false,
    partially_executed: false,
    status: 'pending',
    updated_at: new Date().toISOString(),
  };
}

describe('analysis-store', () => {
  let provider: MemoryProvider;

  beforeEach(() => {
    provider = createTestProvider();
  });

  describe('analysisPath', () => {
    it('maps document path to sidecar path', () => {
      expect(analysisPath('drafts/acme_nda.docx')).toBe(
        `${ANALYSIS_DOCUMENTS_DIR}/drafts/acme_nda.docx.analysis.yaml`,
      );
    });
  });

  describe('contentHash', () => {
    it('produces a sha256-prefixed hash', () => {
      const hash = contentHash(Buffer.from('test content'));
      expect(hash).toMatch(/^sha256:[a-f0-9]{64}$/);
    });

    it('produces consistent hashes for same content', () => {
      const h1 = contentHash(Buffer.from('same'));
      const h2 = contentHash(Buffer.from('same'));
      expect(h1).toBe(h2);
    });

    it('produces different hashes for different content', () => {
      const h1 = contentHash(Buffer.from('content-a'));
      const h2 = contentHash(Buffer.from('content-b'));
      expect(h1).not.toBe(h2);
    });
  });

  describe('saveAnalysis and loadAnalysis', () => {
    it('round-trips classification and extractions', () => {
      const classification: DocumentClassification = {
        document_type: 'nda',
        confidence: 'high',
        parties: ['Acme Corp', 'TestCo Inc'],
        effective_date: '2025-01-01',
        expiration_date: '2026-01-01',
        governing_law: 'Delaware',
        summary: 'Mutual NDA between Acme and TestCo',
      };

      const extractions: ClauseExtraction[] = [
        { clause: 'governing-law', found: true, text: 'State of Delaware', section_reference: 'Section 10' },
        { clause: 'termination', found: true, text: '30 days written notice', section_reference: 'Section 8' },
      ];

      const saved = saveAnalysis('/test-workspace', {
        documentPath: 'drafts/acme_nda.docx',
        classification,
        extractions,
        analyzedBy: 'claude',
      }, provider);

      expect(saved.document_id).toMatch(/^[a-f0-9]{8}$/);
      expect(saved.classification).toEqual(classification);
      expect(saved.extractions).toEqual(extractions);
      expect(saved.analyzed_by).toBe('claude');

      const loaded = loadAnalysis('/test-workspace', 'drafts/acme_nda.docx', provider);
      expect(loaded).not.toBeNull();
      expect(loaded!.document_id).toBe(saved.document_id);
      expect(loaded!.classification).toEqual(classification);
      expect(loaded!.extractions).toHaveLength(2);
    });

    it('preserves document_id across updates', () => {
      const first = saveAnalysis('/test-workspace', {
        documentPath: 'drafts/acme_nda.docx',
        classification: {
          document_type: 'nda',
          confidence: 'medium',
          parties: ['Acme'],
          summary: 'NDA',
        },
      }, provider);

      const second = saveAnalysis('/test-workspace', {
        documentPath: 'drafts/acme_nda.docx',
        classification: {
          document_type: 'nda',
          confidence: 'high',
          parties: ['Acme Corp', 'TestCo'],
          summary: 'Mutual NDA',
        },
      }, provider);

      expect(second.document_id).toBe(first.document_id);
      expect(second.classification!.confidence).toBe('high');
    });

    it('supports partial updates — preserves existing extractions when only classification is provided', () => {
      saveAnalysis('/test-workspace', {
        documentPath: 'drafts/acme_nda.docx',
        extractions: [{ clause: 'governing-law', found: true, text: 'Delaware' }],
      }, provider);

      saveAnalysis('/test-workspace', {
        documentPath: 'drafts/acme_nda.docx',
        classification: {
          document_type: 'nda',
          confidence: 'high',
          parties: ['Acme'],
          summary: 'NDA',
        },
      }, provider);

      const loaded = loadAnalysis('/test-workspace', 'drafts/acme_nda.docx', provider);
      expect(loaded!.classification!.document_type).toBe('nda');
      expect(loaded!.extractions).toHaveLength(1);
      expect(loaded!.extractions[0].clause).toBe('governing-law');
    });

    it('returns null for non-existent analysis', () => {
      const result = loadAnalysis('/test-workspace', 'drafts/nonexistent.docx', provider);
      expect(result).toBeNull();
    });
  });

  describe('isAnalysisStale', () => {
    it('returns stale: false for fresh analysis', () => {
      saveAnalysis('/test-workspace', {
        documentPath: 'drafts/acme_nda.docx',
        classification: { document_type: 'nda', confidence: 'high', parties: ['Acme'], summary: 'NDA' },
      }, provider);

      const result = isAnalysisStale('/test-workspace', 'drafts/acme_nda.docx', provider);
      expect(result.stale).toBe(false);
    });

    it('returns stale: true when content changes', () => {
      saveAnalysis('/test-workspace', {
        documentPath: 'drafts/acme_nda.docx',
        classification: { document_type: 'nda', confidence: 'high', parties: ['Acme'], summary: 'NDA' },
      }, provider);

      // Modify the document
      provider.seed('drafts/acme_nda.docx', 'MODIFIED NDA content');

      const result = isAnalysisStale('/test-workspace', 'drafts/acme_nda.docx', provider);
      expect(result.stale).toBe(true);
      expect(result.reason).toBe('content_changed');
    });

    it('returns stale: false when no analysis exists', () => {
      const result = isAnalysisStale('/test-workspace', 'drafts/acme_nda.docx', provider);
      expect(result.stale).toBe(false);
    });
  });

  describe('listPendingDocuments', () => {
    it('returns all documents as new when none are analyzed', () => {
      const documents = [
        { path: 'drafts/acme_nda.docx' },
        { path: 'incoming/vendor_agreement.txt' },
      ];

      const pending = listPendingDocuments('/test-workspace', documents, provider);
      expect(pending).toHaveLength(2);
      expect(pending.every((d) => d.reason === 'new')).toBe(true);
    });

    it('returns stale documents with content_changed reason', () => {
      saveAnalysis('/test-workspace', {
        documentPath: 'drafts/acme_nda.docx',
        classification: { document_type: 'nda', confidence: 'high', parties: ['Acme'], summary: 'NDA' },
      }, provider);

      provider.seed('drafts/acme_nda.docx', 'MODIFIED content');

      const pending = listPendingDocuments('/test-workspace', [{ path: 'drafts/acme_nda.docx' }], provider);
      expect(pending).toHaveLength(1);
      expect(pending[0].reason).toBe('content_changed');
      expect(pending[0].document_type).toBe('nda');
    });

    it('returns incomplete documents missing classification', () => {
      saveAnalysis('/test-workspace', {
        documentPath: 'drafts/acme_nda.docx',
        extractions: [{ clause: 'governing-law', found: true }],
      }, provider);

      const pending = listPendingDocuments('/test-workspace', [{ path: 'drafts/acme_nda.docx' }], provider);
      expect(pending).toHaveLength(1);
      expect(pending[0].reason).toBe('incomplete');
    });

    it('excludes fully analyzed fresh documents', () => {
      saveAnalysis('/test-workspace', {
        documentPath: 'drafts/acme_nda.docx',
        classification: { document_type: 'nda', confidence: 'high', parties: ['Acme'], summary: 'NDA' },
      }, provider);

      const pending = listPendingDocuments('/test-workspace', [{ path: 'drafts/acme_nda.docx' }], provider);
      expect(pending).toHaveLength(0);
    });
  });
});

describe('analysis-indexer', () => {
  let provider: MemoryProvider;

  beforeEach(() => {
    provider = createTestProvider();
  });

  describe('enrichDocumentRecord', () => {
    it('adds analyzed: false when no analysis exists', () => {
      const record = makeDocumentRecord('drafts/acme_nda.docx', 'drafts');
      const enriched = enrichDocumentRecord('/test-workspace', record, provider);

      expect(enriched.analyzed).toBe(false);
      expect(enriched.stale).toBe(false);
      expect(enriched.classification).toBeUndefined();
    });

    it('adds classification and analyzed: true when analysis exists', () => {
      saveAnalysis('/test-workspace', {
        documentPath: 'drafts/acme_nda.docx',
        classification: {
          document_type: 'nda',
          confidence: 'high',
          parties: ['Acme Corp', 'TestCo'],
          effective_date: '2025-01-01',
          summary: 'Mutual NDA',
        },
      }, provider);

      const record = makeDocumentRecord('drafts/acme_nda.docx', 'drafts');
      const enriched = enrichDocumentRecord('/test-workspace', record, provider);

      expect(enriched.analyzed).toBe(true);
      expect(enriched.stale).toBe(false);
      expect(enriched.classification!.document_type).toBe('nda');
      expect(enriched.classification!.parties).toEqual(['Acme Corp', 'TestCo']);
    });

    it('marks stale when content changed', () => {
      saveAnalysis('/test-workspace', {
        documentPath: 'drafts/acme_nda.docx',
        classification: { document_type: 'nda', confidence: 'high', parties: ['Acme'], summary: 'NDA' },
      }, provider);

      provider.seed('drafts/acme_nda.docx', 'MODIFIED content');

      const record = makeDocumentRecord('drafts/acme_nda.docx', 'drafts');
      const enriched = enrichDocumentRecord('/test-workspace', record, provider);

      expect(enriched.analyzed).toBe(true);
      expect(enriched.stale).toBe(true);
    });
  });

  describe('buildAnalysisSummary', () => {
    it('aggregates counts by document type', () => {
      saveAnalysis('/test-workspace', {
        documentPath: 'drafts/acme_nda.docx',
        classification: { document_type: 'nda', confidence: 'high', parties: ['Acme'], summary: 'NDA' },
      }, provider);

      saveAnalysis('/test-workspace', {
        documentPath: 'executed/partner_msa_executed.pdf',
        classification: { document_type: 'msa', confidence: 'high', parties: ['Partner Co'], summary: 'MSA' },
      }, provider);

      const documents = [
        makeDocumentRecord('drafts/acme_nda.docx', 'drafts'),
        makeDocumentRecord('executed/partner_msa_executed.pdf', 'executed'),
        makeDocumentRecord('incoming/vendor_agreement.txt', 'incoming'),
      ];

      const summary = buildAnalysisSummary('/test-workspace', documents, provider);
      expect(summary.analyzed_documents).toBe(2);
      expect(summary.unanalyzed_documents).toBe(1);
      expect(summary.stale_documents).toBe(0);
      expect(summary.by_document_type).toEqual({ nda: 1, msa: 1 });
    });

    it('identifies expiring-soon contracts', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      const expirationDate = futureDate.toISOString().split('T')[0];

      saveAnalysis('/test-workspace', {
        documentPath: 'drafts/acme_nda.docx',
        classification: {
          document_type: 'nda',
          confidence: 'high',
          parties: ['Acme'],
          expiration_date: expirationDate,
          summary: 'Expiring NDA',
        },
      }, provider);

      const documents = [makeDocumentRecord('drafts/acme_nda.docx', 'drafts')];
      const summary = buildAnalysisSummary('/test-workspace', documents, provider);
      expect(summary.expiring_soon).toHaveLength(1);
      expect(summary.expiring_soon[0].path).toBe('drafts/acme_nda.docx');
    });
  });

  describe('enrichStatusIndex', () => {
    it('adds analysis section to status index', () => {
      saveAnalysis('/test-workspace', {
        documentPath: 'drafts/acme_nda.docx',
        classification: { document_type: 'nda', confidence: 'high', parties: ['Acme'], summary: 'NDA' },
      }, provider);

      const baseIndex: StatusIndex = {
        generated_at: new Date().toISOString(),
        workspace_root: '/test-workspace',
        summary: {
          total_documents: 1,
          executed_documents: 0,
          partially_executed_documents: 0,
          pending_documents: 1,
          by_lifecycle: { forms: 0, drafts: 1, incoming: 0, executed: 0, archive: 0 },
        },
        documents: [makeDocumentRecord('drafts/acme_nda.docx', 'drafts')],
        lint: { error_count: 0, warning_count: 0, findings: [] },
      };

      const enriched = enrichStatusIndex('/test-workspace', baseIndex, provider);
      expect(enriched.analysis).toBeDefined();
      expect(enriched.analysis!.analyzed_documents).toBe(1);
      expect(enriched.documents[0].analyzed).toBe(true);
      expect(enriched.documents[0].classification!.document_type).toBe('nda');
    });

    it('produces valid index when no analyses exist', () => {
      const baseIndex: StatusIndex = {
        generated_at: new Date().toISOString(),
        workspace_root: '/test-workspace',
        summary: {
          total_documents: 1,
          executed_documents: 0,
          partially_executed_documents: 0,
          pending_documents: 1,
          by_lifecycle: { forms: 0, drafts: 1, incoming: 0, executed: 0, archive: 0 },
        },
        documents: [makeDocumentRecord('drafts/acme_nda.docx', 'drafts')],
        lint: { error_count: 0, warning_count: 0, findings: [] },
      };

      const enriched = enrichStatusIndex('/test-workspace', baseIndex, provider);
      expect(enriched.analysis!.analyzed_documents).toBe(0);
      expect(enriched.analysis!.unanalyzed_documents).toBe(1);
      expect(enriched.documents[0].analyzed).toBe(false);
    });
  });
});
