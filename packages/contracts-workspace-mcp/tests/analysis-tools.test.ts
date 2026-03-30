import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, beforeEach } from 'vitest';
import { itAllure } from '../../../integration-tests/helpers/allure-test.js';
import { callTool, listToolDescriptors } from '../src/core/tools.js';

const it = itAllure.epic('Platform & Distribution');

function getStructuredContent(result: Awaited<ReturnType<typeof callTool>>): Record<string, unknown> {
  return (result.structuredContent ?? {}) as Record<string, unknown>;
}

function createTestWorkspace(): string {
  const root = mkdtempSync(join(tmpdir(), 'oa-analysis-'));
  for (const folder of ['forms', 'drafts', 'incoming', 'executed', 'archive']) {
    mkdirSync(join(root, folder), { recursive: true });
  }
  writeFileSync(join(root, 'drafts', 'acme_nda.docx'), 'NDA content between Acme and TestCo');
  writeFileSync(join(root, 'executed', 'partner_msa_executed.pdf'), 'MSA content');
  writeFileSync(join(root, 'incoming', 'vendor_agreement.txt'), 'Vendor agreement text');
  return root;
}

describe('contract analysis MCP tools', () => {
  let root: string;

  beforeEach(() => {
    root = createTestWorkspace();
  });

  it('tool listing includes all 10 tools', () => {
    const names = listToolDescriptors().map((t) => t.name);
    expect(names).toContain('save_contract_analysis');
    expect(names).toContain('read_contract_analysis');
    expect(names).toContain('list_pending_contracts');
    expect(names).toContain('search_contracts');
    expect(names).toContain('suggest_contract_rename');
    expect(names).toHaveLength(10);
  });

  describe('save_contract_analysis', () => {
    it.openspec('OA-WKS-032')('stores classification and returns document_id', async () => {
      const result = await callTool('save_contract_analysis', {
        root_dir: root,
        document_path: 'drafts/acme_nda.docx',
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
        analyzed_by: 'claude',
      });

      expect(result.isError).toBeUndefined();
      const payload = getStructuredContent(result);
      expect(payload.document_id).toMatch(/^[a-f0-9]{8}$/);
      expect(payload.content_hash).toMatch(/^sha256:/);
    });

    it.openspec('OA-WKS-033')('preserves document_id across updates', async () => {
      const first = await callTool('save_contract_analysis', {
        root_dir: root,
        document_path: 'drafts/acme_nda.docx',
        classification: {
          document_type: 'nda',
          confidence: 'medium',
          parties: ['Acme'],
          summary: 'NDA draft',
        },
      });

      const second = await callTool('save_contract_analysis', {
        root_dir: root,
        document_path: 'drafts/acme_nda.docx',
        classification: {
          document_type: 'nda',
          confidence: 'high',
          parties: ['Acme Corp', 'TestCo'],
          summary: 'Mutual NDA',
        },
      });

      const firstPayload = getStructuredContent(first);
      const secondPayload = getStructuredContent(second);
      expect(secondPayload.document_id).toBe(firstPayload.document_id);
    });

    it.openspec('OA-WKS-034')('partial update preserves existing extractions', async () => {
      await callTool('save_contract_analysis', {
        root_dir: root,
        document_path: 'drafts/acme_nda.docx',
        extractions: [
          { clause: 'governing-law', found: true, text: 'Delaware' },
        ],
      });

      await callTool('save_contract_analysis', {
        root_dir: root,
        document_path: 'drafts/acme_nda.docx',
        classification: {
          document_type: 'nda',
          confidence: 'high',
          parties: ['Acme'],
          summary: 'NDA',
        },
      });

      const readResult = await callTool('read_contract_analysis', {
        root_dir: root,
        document_path: 'drafts/acme_nda.docx',
      });
      const payload = getStructuredContent(readResult);
      const analysis = payload.analysis as Record<string, unknown>;
      expect(analysis.classification).toBeDefined();
      expect((analysis.extractions as unknown[]).length).toBe(1);
    });
  });

  describe('read_contract_analysis', () => {
    it.openspec('OA-WKS-036')('returns analysis with stale: false for fresh document', async () => {
      await callTool('save_contract_analysis', {
        root_dir: root,
        document_path: 'drafts/acme_nda.docx',
        classification: {
          document_type: 'nda',
          confidence: 'high',
          parties: ['Acme'],
          summary: 'NDA',
        },
      });

      const result = await callTool('read_contract_analysis', {
        root_dir: root,
        document_path: 'drafts/acme_nda.docx',
      });
      const payload = getStructuredContent(result);
      expect(payload.stale).toBe(false);
      expect(payload.analysis).not.toBeNull();
    });

    it.openspec('OA-WKS-035')('detects stale analysis when content changes', async () => {
      await callTool('save_contract_analysis', {
        root_dir: root,
        document_path: 'drafts/acme_nda.docx',
        classification: {
          document_type: 'nda',
          confidence: 'high',
          parties: ['Acme'],
          summary: 'NDA',
        },
      });

      // Modify the document
      writeFileSync(join(root, 'drafts', 'acme_nda.docx'), 'MODIFIED NDA content');

      const result = await callTool('read_contract_analysis', {
        root_dir: root,
        document_path: 'drafts/acme_nda.docx',
      });
      const payload = getStructuredContent(result);
      expect(payload.stale).toBe(true);
      expect(payload.stale_reason).toBe('content_changed');
    });

    it('returns null analysis for non-analyzed document', async () => {
      const result = await callTool('read_contract_analysis', {
        root_dir: root,
        document_path: 'drafts/acme_nda.docx',
      });
      const payload = getStructuredContent(result);
      expect(payload.analysis).toBeNull();
      expect(payload.stale).toBe(false);
    });
  });

  describe('list_pending_contracts', () => {
    it.openspec('OA-WKS-037')('lists unanalyzed documents as new', async () => {
      const result = await callTool('list_pending_contracts', { root_dir: root });
      const payload = getStructuredContent(result);
      expect(payload.pending_count).toBe(3);
      const docs = payload.documents as Array<Record<string, unknown>>;
      expect(docs.every((d) => d.reason === 'new')).toBe(true);
    });

    it.openspec('OA-WKS-038')('lists stale documents with content_changed reason', async () => {
      await callTool('save_contract_analysis', {
        root_dir: root,
        document_path: 'drafts/acme_nda.docx',
        classification: {
          document_type: 'nda',
          confidence: 'high',
          parties: ['Acme'],
          summary: 'NDA',
        },
      });

      writeFileSync(join(root, 'drafts', 'acme_nda.docx'), 'MODIFIED content');

      const result = await callTool('list_pending_contracts', { root_dir: root });
      const payload = getStructuredContent(result);
      const docs = payload.documents as Array<Record<string, unknown>>;
      const staleDoc = docs.find((d) => d.path === 'drafts/acme_nda.docx');
      expect(staleDoc).toBeDefined();
      expect(staleDoc!.reason).toBe('content_changed');
    });
  });

  describe('search_contracts', () => {
    it.openspec('OA-WKS-039')('filters by document type', async () => {
      await callTool('save_contract_analysis', {
        root_dir: root,
        document_path: 'drafts/acme_nda.docx',
        classification: {
          document_type: 'nda',
          confidence: 'high',
          parties: ['Acme Corp'],
          summary: 'NDA',
        },
      });

      await callTool('save_contract_analysis', {
        root_dir: root,
        document_path: 'executed/partner_msa_executed.pdf',
        classification: {
          document_type: 'msa',
          confidence: 'high',
          parties: ['Partner Co'],
          summary: 'MSA',
        },
      });

      const result = await callTool('search_contracts', {
        root_dir: root,
        document_type: 'nda',
      });
      const payload = getStructuredContent(result);
      expect(payload.match_count).toBe(1);
      const docs = payload.documents as Array<Record<string, unknown>>;
      expect(docs[0].path).toBe('drafts/acme_nda.docx');
    });

    it.openspec('OA-WKS-041')('filters by party name (substring match)', async () => {
      await callTool('save_contract_analysis', {
        root_dir: root,
        document_path: 'drafts/acme_nda.docx',
        classification: {
          document_type: 'nda',
          confidence: 'high',
          parties: ['Acme Corp', 'TestCo'],
          summary: 'NDA',
        },
      });

      const result = await callTool('search_contracts', {
        root_dir: root,
        party: 'Acme',
      });
      const payload = getStructuredContent(result);
      expect(payload.match_count).toBe(1);
    });

    it('filters by analyzed status', async () => {
      await callTool('save_contract_analysis', {
        root_dir: root,
        document_path: 'drafts/acme_nda.docx',
        classification: {
          document_type: 'nda',
          confidence: 'high',
          parties: ['Acme'],
          summary: 'NDA',
        },
      });

      const analyzedResult = await callTool('search_contracts', {
        root_dir: root,
        analyzed: true,
      });
      expect((getStructuredContent(analyzedResult)).match_count).toBe(1);

      const unanalyzedResult = await callTool('search_contracts', {
        root_dir: root,
        analyzed: false,
      });
      expect((getStructuredContent(unanalyzedResult)).match_count).toBe(2);
    });
  });

  describe('suggest_contract_rename', () => {
    it.openspec('OA-WKS-042')('suggests standardized filename from classification', async () => {
      await callTool('save_contract_analysis', {
        root_dir: root,
        document_path: 'drafts/acme_nda.docx',
        classification: {
          document_type: 'nda',
          confidence: 'high',
          parties: ['Acme Corp'],
          effective_date: '2025-06-01',
          summary: 'NDA with Acme',
        },
      });

      const result = await callTool('suggest_contract_rename', {
        root_dir: root,
        document_path: 'drafts/acme_nda.docx',
      });
      const payload = getStructuredContent(result);
      expect(payload.suggested_name).toBe('2025-06-01_acme_corp_nda.docx');
    });

    it.openspec('OA-WKS-043')('returns null for unclassified document', async () => {
      const result = await callTool('suggest_contract_rename', {
        root_dir: root,
        document_path: 'drafts/acme_nda.docx',
      });
      const payload = getStructuredContent(result);
      expect(payload.suggested_name).toBeNull();
    });
  });

  describe('status_generate with analysis enrichment', () => {
    it.openspec('OA-WKS-044')('includes analysis summary in generated index', async () => {
      await callTool('save_contract_analysis', {
        root_dir: root,
        document_path: 'drafts/acme_nda.docx',
        classification: {
          document_type: 'nda',
          confidence: 'high',
          parties: ['Acme Corp'],
          summary: 'NDA',
        },
      });

      const result = await callTool('status_generate', { root_dir: root });
      const payload = getStructuredContent(result);
      const analysis = payload.analysis as Record<string, unknown>;
      expect(analysis).toBeDefined();
      expect(analysis.analyzed_documents).toBe(1);
      expect(analysis.unanalyzed_documents).toBe(2);
    });

    it.openspec('OA-WKS-045')('produces valid index with no analyses', async () => {
      const result = await callTool('status_generate', { root_dir: root });
      const payload = getStructuredContent(result);
      const analysis = payload.analysis as Record<string, unknown>;
      expect(analysis.analyzed_documents).toBe(0);
      expect(analysis.unanalyzed_documents).toBe(3);
    });
  });
});
