import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryProvider } from '../src/core/memory-provider.js';
import {
  sidecarPath,
  contentHash,
  loadSidecar,
  indexContract,
  isSidecarStale,
  listUnindexedDocuments,
  validateDocumentType,
  detectOrphanedSidecars,
} from '../src/core/analysis-store.js';
import {
  enrichDocumentRecord,
  buildAnalysisSummary,
  enrichStatusIndex,
} from '../src/core/analysis-indexer.js';
import { searchContracts, formatResultsAsMarkdown } from '../src/core/search-index.js';
import type { DocumentRecord, StatusIndex } from '../src/core/types.js';
import { ANALYSIS_DOCUMENTS_DIR } from '../src/core/constants.js';

function createTestProvider(): MemoryProvider {
  const provider = new MemoryProvider('/test-workspace');
  provider.seed('vendor/acme_nda.docx', 'NDA content between Acme and TestCo');
  provider.seed('vendor/partner_msa.pdf', 'MSA content for partner agreement');
  provider.seed('hr/offer_letter.txt', 'Offer letter for Jane Doe');
  provider.seed('fund-formation/lpa.docx', 'Limited Partnership Agreement');
  // Also seed lifecycle dirs for backward compat tests
  provider.seed('executed/signed_contract.pdf', 'Signed contract');
  provider.seed('drafts/draft_agreement.docx', 'Draft agreement');
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

function makeDocumentRecord(path: string, lifecycle?: 'forms' | 'drafts' | 'incoming' | 'executed' | 'archive'): DocumentRecord {
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

  describe('sidecarPath', () => {
    it('maps document path to .contract.yaml sidecar', () => {
      expect(sidecarPath('vendor/acme_nda.docx')).toBe(
        `${ANALYSIS_DOCUMENTS_DIR}/vendor/acme_nda.docx.contract.yaml`,
      );
    });
  });

  describe('contentHash', () => {
    it('produces a sha256-prefixed hash', () => {
      const hash = contentHash(Buffer.from('test content'));
      expect(hash).toMatch(/^sha256:[a-f0-9]{64}$/);
    });

    it('is stable across calls', () => {
      const h1 = contentHash(Buffer.from('same'));
      const h2 = contentHash(Buffer.from('same'));
      expect(h1).toBe(h2);
    });

    it('differs for different content', () => {
      const h1 = contentHash(Buffer.from('content-a'));
      const h2 = contentHash(Buffer.from('content-b'));
      expect(h1).not.toBe(h2);
    });
  });

  describe('indexContract and loadSidecar', () => {
    it('round-trips classification and extractions', () => {
      const result = indexContract('/test-workspace', {
        documentPath: 'vendor/acme_nda.docx',
        classification: {
          document_type: 'nda',
          confidence: 'high',
          parties: ['Acme Corp', 'TestCo Inc'],
          effective_date: '2025-01-01',
          expiration_date: '2026-01-01',
          governing_law: 'Delaware',
          summary: 'Mutual NDA between Acme and TestCo',
        },
        extractions: [
          { clause: 'governing-law', found: true, text: 'State of Delaware', section_reference: 'Section 10' },
        ],
        indexedBy: 'claude',
      }, provider);

      expect(result.analysis.content_hash).toMatch(/^sha256:/);
      expect(result.warning).toBeUndefined();

      const loaded = loadSidecar('/test-workspace', 'vendor/acme_nda.docx', provider);
      expect(loaded).not.toBeNull();
      expect(loaded!.classification!.document_type).toBe('nda');
      expect(loaded!.extractions).toHaveLength(1);
    });

    it('supports partial updates — preserves extractions when only classification provided', () => {
      indexContract('/test-workspace', {
        documentPath: 'vendor/acme_nda.docx',
        extractions: [{ clause: 'governing-law', found: true, text: 'Delaware' }],
      }, provider);

      indexContract('/test-workspace', {
        documentPath: 'vendor/acme_nda.docx',
        classification: {
          document_type: 'nda', confidence: 'high', parties: ['Acme'], summary: 'NDA',
        },
      }, provider);

      const loaded = loadSidecar('/test-workspace', 'vendor/acme_nda.docx', provider);
      expect(loaded!.classification!.document_type).toBe('nda');
      expect(loaded!.extractions).toHaveLength(1);
    });

    it('returns null for non-existent sidecar', () => {
      expect(loadSidecar('/test-workspace', 'nonexistent.docx', provider)).toBeNull();
    });
  });

  describe('validateDocumentType', () => {
    it('accepts canonical types', () => {
      const result = validateDocumentType('nda', provider);
      expect(result.valid).toBe(true);
      expect(result.document_type).toBe('nda');
    });

    it('rejects unknown types with raw_type fallback', () => {
      const result = validateDocumentType('property-management-agreement', provider);
      expect(result.valid).toBe(false);
      expect(result.document_type).toBeNull();
      expect(result.raw_type).toBe('property-management-agreement');
      expect(result.warning).toContain('Unknown document type');
    });

    it('accepts custom types from config', () => {
      provider.seed('.contracts-workspace/config.yaml', 'custom_document_types:\n  - side-letter\n');
      const result = validateDocumentType('side-letter', provider);
      expect(result.valid).toBe(true);
      expect(result.document_type).toBe('side-letter');
    });
  });

  describe('unknown type through indexContract', () => {
    it('stores null document_type with raw_type and returns warning', () => {
      const result = indexContract('/test-workspace', {
        documentPath: 'vendor/acme_nda.docx',
        classification: {
          document_type: 'property-management-agreement',
          confidence: 'high',
          parties: ['Acme'],
          summary: 'PMA',
        },
      }, provider);

      expect(result.warning).toContain('Unknown document type');
      const loaded = loadSidecar('/test-workspace', 'vendor/acme_nda.docx', provider);
      expect(loaded!.classification!.document_type).toBeNull();
      expect(loaded!.classification!.raw_type).toBe('property-management-agreement');
    });
  });

  describe('isSidecarStale', () => {
    it('returns false for fresh index', () => {
      indexContract('/test-workspace', {
        documentPath: 'vendor/acme_nda.docx',
        classification: { document_type: 'nda', confidence: 'high', parties: ['Acme'], summary: 'NDA' },
      }, provider);
      expect(isSidecarStale('/test-workspace', 'vendor/acme_nda.docx', provider).stale).toBe(false);
    });

    it('returns true when content changes', () => {
      indexContract('/test-workspace', {
        documentPath: 'vendor/acme_nda.docx',
        classification: { document_type: 'nda', confidence: 'high', parties: ['Acme'], summary: 'NDA' },
      }, provider);
      provider.seed('vendor/acme_nda.docx', 'MODIFIED content');
      const result = isSidecarStale('/test-workspace', 'vendor/acme_nda.docx', provider);
      expect(result.stale).toBe(true);
      expect(result.reason).toBe('content_changed');
    });
  });

  describe('listUnindexedDocuments', () => {
    it('returns all as new when none indexed', () => {
      const docs = [{ path: 'vendor/acme_nda.docx' }, { path: 'hr/offer_letter.txt' }];
      const pending = listUnindexedDocuments('/test-workspace', docs, provider);
      expect(pending).toHaveLength(2);
      expect(pending.every((d) => d.reason === 'new')).toBe(true);
    });

    it('returns stale docs with content_changed', () => {
      indexContract('/test-workspace', {
        documentPath: 'vendor/acme_nda.docx',
        classification: { document_type: 'nda', confidence: 'high', parties: ['Acme'], summary: 'NDA' },
      }, provider);
      provider.seed('vendor/acme_nda.docx', 'MODIFIED');
      const pending = listUnindexedDocuments('/test-workspace', [{ path: 'vendor/acme_nda.docx' }], provider);
      expect(pending[0].reason).toBe('content_changed');
    });

    it('excludes fully indexed fresh documents', () => {
      indexContract('/test-workspace', {
        documentPath: 'vendor/acme_nda.docx',
        classification: { document_type: 'nda', confidence: 'high', parties: ['Acme'], summary: 'NDA' },
      }, provider);
      const pending = listUnindexedDocuments('/test-workspace', [{ path: 'vendor/acme_nda.docx' }], provider);
      expect(pending).toHaveLength(0);
    });
  });

  describe('detectOrphanedSidecars', () => {
    it('detects sidecar whose source document no longer exists at recorded path', () => {
      // Index a real document first
      indexContract('/test-workspace', {
        documentPath: 'vendor/acme_nda.docx',
        classification: { document_type: 'nda', confidence: 'high', parties: ['Acme'], summary: 'NDA' },
      }, provider);

      // Manually create an orphaned sidecar (source doc path doesn't exist)
      const orphanSidecarPath = `${ANALYSIS_DOCUMENTS_DIR}/vendor/deleted_contract.docx.contract.yaml`;
      provider.mkdir(`${ANALYSIS_DOCUMENTS_DIR}/vendor`, { recursive: true });
      provider.writeFile(orphanSidecarPath, [
        'schema_version: 1',
        'document_path: vendor/deleted_contract.docx',
        'content_hash: sha256:abc123',
        'indexed_at: 2026-03-30T00:00:00Z',
        'indexed_by: claude',
        'extractions: []',
      ].join('\n'));

      const orphans = detectOrphanedSidecars('/test-workspace', provider);
      expect(orphans).toContain('vendor/deleted_contract.docx');
      expect(orphans).not.toContain('vendor/acme_nda.docx');
    });
  });
});

describe('analysis-indexer', () => {
  let provider: MemoryProvider;

  beforeEach(() => {
    provider = createTestProvider();
  });

  describe('enrichDocumentRecord', () => {
    it('adds analyzed: false when no sidecar exists', () => {
      const record = makeDocumentRecord('vendor/acme_nda.docx');
      const enriched = enrichDocumentRecord('/test-workspace', record, provider);
      expect(enriched.analyzed).toBe(false);
      expect(enriched.stale).toBe(false);
    });

    it('adds classification when sidecar exists', () => {
      indexContract('/test-workspace', {
        documentPath: 'vendor/acme_nda.docx',
        classification: { document_type: 'nda', confidence: 'high', parties: ['Acme', 'TestCo'], summary: 'NDA' },
      }, provider);
      const record = makeDocumentRecord('vendor/acme_nda.docx');
      const enriched = enrichDocumentRecord('/test-workspace', record, provider);
      expect(enriched.analyzed).toBe(true);
      expect(enriched.classification!.document_type).toBe('nda');
    });
  });

  describe('buildAnalysisSummary', () => {
    it('aggregates counts', () => {
      indexContract('/test-workspace', {
        documentPath: 'vendor/acme_nda.docx',
        classification: { document_type: 'nda', confidence: 'high', parties: ['Acme'], summary: 'NDA' },
      }, provider);
      const docs = [
        makeDocumentRecord('vendor/acme_nda.docx'),
        makeDocumentRecord('hr/offer_letter.txt'),
      ];
      const summary = buildAnalysisSummary('/test-workspace', docs, provider);
      expect(summary.analyzed_documents).toBe(1);
      expect(summary.unanalyzed_documents).toBe(1);
      expect(summary.by_document_type).toEqual({ nda: 1 });
    });
  });

  describe('enrichStatusIndex', () => {
    it('adds analysis section', () => {
      indexContract('/test-workspace', {
        documentPath: 'vendor/acme_nda.docx',
        classification: { document_type: 'nda', confidence: 'high', parties: ['Acme'], summary: 'NDA' },
      }, provider);

      const baseIndex: StatusIndex = {
        generated_at: new Date().toISOString(),
        workspace_root: '/test-workspace',
        summary: {
          total_documents: 1, executed_documents: 0, partially_executed_documents: 0,
          pending_documents: 1, by_lifecycle: { forms: 0, drafts: 0, incoming: 0, executed: 0, archive: 0 },
        },
        documents: [makeDocumentRecord('vendor/acme_nda.docx')],
        lint: { error_count: 0, warning_count: 0, findings: [] },
      };

      const enriched = enrichStatusIndex('/test-workspace', baseIndex, provider);
      expect(enriched.analysis!.analyzed_documents).toBe(1);
      expect(enriched.documents[0].analyzed).toBe(true);
    });
  });
});

describe('search-index', () => {
  let provider: MemoryProvider;

  beforeEach(() => {
    provider = createTestProvider();
    indexContract('/test-workspace', {
      documentPath: 'vendor/acme_nda.docx',
      classification: {
        document_type: 'nda', confidence: 'high', parties: ['Acme Corp', 'TestCo'],
        governing_law: 'Delaware', summary: 'Mutual non-disclosure agreement',
      },
      extractions: [
        { clause: 'confidentiality', found: true, text: 'All information shared shall remain confidential' },
        { clause: 'governing-law', found: true, text: 'State of Delaware' },
      ],
    }, provider);
    indexContract('/test-workspace', {
      documentPath: 'vendor/partner_msa.pdf',
      classification: {
        document_type: 'msa', confidence: 'high', parties: ['Partner Co'],
        expiration_date: '2026-06-15', summary: 'Master services agreement',
      },
      extractions: [
        { clause: 'indemnification', found: true, text: 'Each party shall indemnify the other' },
      ],
    }, provider);
  });

  it('finds documents by BM25 text query', () => {
    const results = searchContracts('/test-workspace', { query: 'confidential' }, [], provider);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].path).toBe('vendor/acme_nda.docx');
  });

  it('filters by document_type', () => {
    const results = searchContracts('/test-workspace', { document_type: 'nda' }, [], provider);
    expect(results).toHaveLength(1);
    expect(results[0].document_type).toBe('nda');
  });

  it('filters by party substring', () => {
    const results = searchContracts('/test-workspace', { party: 'Acme' }, [], provider);
    expect(results).toHaveLength(1);
    expect(results[0].parties).toContain('Acme Corp');
  });

  it('filters by expiring_before', () => {
    const results = searchContracts('/test-workspace', { expiring_before: '2026-12-31' }, [], provider);
    expect(results).toHaveLength(1);
    expect(results[0].path).toBe('vendor/partner_msa.pdf');
  });

  it('formats as markdown', () => {
    const results = searchContracts('/test-workspace', { document_type: 'nda' }, [], provider);
    const md = formatResultsAsMarkdown(results);
    expect(md).toContain('| vendor/acme_nda.docx |');
    expect(md).toContain('nda');
  });

  it('returns empty for no matches', () => {
    const results = searchContracts('/test-workspace', { query: 'zzzznotfound' }, [], provider);
    expect(results).toHaveLength(0);
  });
});
