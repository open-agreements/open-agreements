import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, beforeEach } from 'vitest';
import { itAllure } from '../../../integration-tests/helpers/allure-test.js';
import { callTool, listToolDescriptors } from '../src/core/tools.js';

const it = itAllure.epic('Platform & Distribution');

function getPayload(result: Awaited<ReturnType<typeof callTool>>): Record<string, unknown> {
  return (result.structuredContent ?? {}) as Record<string, unknown>;
}

function createTestWorkspace(): string {
  const root = mkdtempSync(join(tmpdir(), 'oa-idx-'));
  // Lifecycle dirs
  mkdirSync(join(root, 'drafts'), { recursive: true });
  mkdirSync(join(root, 'executed'), { recursive: true });
  // Custom dirs (non-lifecycle)
  mkdirSync(join(root, 'vendor'), { recursive: true });
  mkdirSync(join(root, 'fund-formation'), { recursive: true });
  // Documents in all folder types
  writeFileSync(join(root, 'vendor', 'acme_nda.docx'), 'NDA content');
  writeFileSync(join(root, 'vendor', 'partner_msa.pdf'), 'MSA content');
  writeFileSync(join(root, 'fund-formation', 'lpa.docx'), 'LPA content');
  writeFileSync(join(root, 'executed', 'signed_agreement.pdf'), 'Signed');
  writeFileSync(join(root, 'drafts', 'draft_sow.docx'), 'Draft SOW');
  // Non-document file (should be excluded)
  writeFileSync(join(root, 'vendor', 'logo.png'), 'fake image');
  return root;
}

describe('contract indexing MCP tools', () => {
  let root: string;

  beforeEach(() => {
    root = createTestWorkspace();
  });

  it('lists all 9 tools including 4 indexing tools', () => {
    const names = listToolDescriptors().map((t) => t.name);
    expect(names).toContain('index_contract');
    expect(names).toContain('get_contract_index');
    expect(names).toContain('list_unindexed_contracts');
    expect(names).toContain('search_contracts');
    expect(names).toHaveLength(9);
  });

  describe('list_unindexed_contracts', () => {
    it.openspec('OA-IDX-008')('lists documents from all folders including custom dirs', async () => {
      const result = await callTool('list_unindexed_contracts', { root_dir: root });
      const payload = getPayload(result);
      // Should find docs in vendor/, fund-formation/, executed/, drafts/ — but NOT logo.png
      expect(payload.total_documents).toBe(5);
      expect(payload.unindexed_count).toBe(5);
      const docs = payload.documents as Array<Record<string, unknown>>;
      const paths = docs.map((d) => d.path);
      expect(paths).toContain('vendor/acme_nda.docx');
      expect(paths).toContain('fund-formation/lpa.docx');
      expect(paths).not.toContain('vendor/logo.png');
    });
  });

  describe('index_contract', () => {
    it.openspec('OA-IDX-001')('stores classification and returns content_hash', async () => {
      const result = await callTool('index_contract', {
        root_dir: root,
        document_path: 'vendor/acme_nda.docx',
        classification: {
          document_type: 'nda',
          confidence: 'high',
          parties: ['Acme Corp', 'TestCo Inc'],
          summary: 'Mutual NDA',
        },
        indexed_by: 'claude',
      });
      expect(result.isError).toBeUndefined();
      const payload = getPayload(result);
      expect(payload.content_hash).toMatch(/^sha256:/);
      expect(payload.warning).toBeUndefined();
    });

    it.openspec('OA-IDX-003')('accepts canonical document type', async () => {
      const result = await callTool('index_contract', {
        root_dir: root,
        document_path: 'vendor/acme_nda.docx',
        classification: {
          document_type: 'nda', confidence: 'high', parties: ['Acme'], summary: 'NDA',
        },
      });
      expect(getPayload(result).warning).toBeUndefined();
    });

    it.openspec('OA-IDX-004')('warns on unknown type with raw_type fallback', async () => {
      const result = await callTool('index_contract', {
        root_dir: root,
        document_path: 'vendor/acme_nda.docx',
        classification: {
          document_type: 'property-management-agreement',
          confidence: 'high', parties: ['Acme'], summary: 'PMA',
        },
      });
      const payload = getPayload(result);
      expect(payload.warning).toContain('Unknown document type');
    });

    it.openspec('OA-IDX-002')('partial update preserves existing extractions', async () => {
      await callTool('index_contract', {
        root_dir: root,
        document_path: 'vendor/acme_nda.docx',
        extractions: [{ clause: 'governing-law', found: true, text: 'Delaware' }],
      });
      await callTool('index_contract', {
        root_dir: root,
        document_path: 'vendor/acme_nda.docx',
        classification: {
          document_type: 'nda', confidence: 'high', parties: ['Acme'], summary: 'NDA',
        },
      });
      const read = await callTool('get_contract_index', {
        root_dir: root, document_path: 'vendor/acme_nda.docx',
      });
      const contract = (getPayload(read)).contract as Record<string, unknown>;
      expect(contract.classification).toBeDefined();
      expect((contract.extractions as unknown[]).length).toBe(1);
    });
  });

  describe('get_contract_index', () => {
    it.openspec('OA-IDX-007')('returns fresh sidecar with stale: false', async () => {
      await callTool('index_contract', {
        root_dir: root,
        document_path: 'vendor/acme_nda.docx',
        classification: { document_type: 'nda', confidence: 'high', parties: ['Acme'], summary: 'NDA' },
      });
      const result = await callTool('get_contract_index', {
        root_dir: root, document_path: 'vendor/acme_nda.docx',
      });
      const payload = getPayload(result);
      expect(payload.stale).toBe(false);
      expect(payload.contract).not.toBeNull();
    });

    it.openspec('OA-IDX-006')('detects stale sidecar', async () => {
      await callTool('index_contract', {
        root_dir: root,
        document_path: 'vendor/acme_nda.docx',
        classification: { document_type: 'nda', confidence: 'high', parties: ['Acme'], summary: 'NDA' },
      });
      writeFileSync(join(root, 'vendor', 'acme_nda.docx'), 'MODIFIED');
      const result = await callTool('get_contract_index', {
        root_dir: root, document_path: 'vendor/acme_nda.docx',
      });
      expect(getPayload(result).stale).toBe(true);
    });

    it.openspec('OA-IDX-015')('returns portfolio overview without document_path', async () => {
      await callTool('index_contract', {
        root_dir: root,
        document_path: 'vendor/acme_nda.docx',
        classification: { document_type: 'nda', confidence: 'high', parties: ['Acme'], summary: 'NDA' },
      });
      const result = await callTool('get_contract_index', { root_dir: root });
      const payload = getPayload(result);
      expect(payload.indexed_count).toBe(1);
      expect((payload.unindexed_count as number)).toBeGreaterThanOrEqual(4);
      expect(payload.by_document_type).toEqual({ nda: 1 });
    });
  });

  describe('search_contracts', () => {
    beforeEach(async () => {
      await callTool('index_contract', {
        root_dir: root,
        document_path: 'vendor/acme_nda.docx',
        classification: {
          document_type: 'nda', confidence: 'high',
          parties: ['Acme Corp'], summary: 'Mutual non-disclosure agreement',
        },
        extractions: [{ clause: 'confidentiality', found: true, text: 'All info shall be confidential' }],
      });
      await callTool('index_contract', {
        root_dir: root,
        document_path: 'vendor/partner_msa.pdf',
        classification: {
          document_type: 'msa', confidence: 'high',
          parties: ['Partner Co'], expiration_date: '2026-06-15',
          summary: 'Master services agreement',
        },
      });
    });

    it.openspec('OA-IDX-010')('BM25 search by query text', async () => {
      const result = await callTool('search_contracts', { root_dir: root, query: 'confidential' });
      const payload = getPayload(result);
      expect((payload.match_count as number)).toBeGreaterThan(0);
    });

    it.openspec('OA-IDX-011')('filters by document type', async () => {
      const result = await callTool('search_contracts', { root_dir: root, document_type: 'nda' });
      const payload = getPayload(result);
      expect(payload.match_count).toBe(1);
    });

    it.openspec('OA-IDX-013')('filters by party', async () => {
      const result = await callTool('search_contracts', { root_dir: root, party: 'Acme' });
      expect(getPayload(result).match_count).toBe(1);
    });

    it.openspec('OA-IDX-012')('filters by expiring_before', async () => {
      const result = await callTool('search_contracts', { root_dir: root, expiring_before: '2026-12-31' });
      expect(getPayload(result).match_count).toBe(1);
    });

    it.openspec('OA-IDX-014')('returns markdown format', async () => {
      const result = await callTool('search_contracts', { root_dir: root, document_type: 'nda', format: 'markdown' });
      const payload = getPayload(result);
      expect(payload.markdown).toContain('| vendor/acme_nda.docx |');
    });
  });
});
