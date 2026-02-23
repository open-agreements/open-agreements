import { describe, expect } from 'vitest';
import { itAllure } from '../../../integration-tests/helpers/allure-test.js';
import { buildChecklistTemplateContext, renderChecklistMarkdown } from './index.js';

const it = itAllure.epic('Compliance & Governance').withLabels({ feature: 'Checklist Rendering v2' });

describe('checklist render model traceability', () => {
  it.openspec(['OA-091', 'OA-092', 'OA-093'])(
    'renders canonical stage order with nested numbering while keeping stable IDs unchanged',
    () => {
      const payload = {
        deal_name: 'Atlas Series A',
        updated_at: '2026-02-23',
        documents: [
          { document_id: 'doc-parent', title: 'Parent signing package' },
          { document_id: 'doc-inserted', title: 'Inserted mid-stream item' },
          { document_id: 'doc-closing', title: 'Closing deliverable' },
        ],
        checklist_entries: [
          {
            entry_id: 'entry-pre',
            stage: 'PRE_SIGNING',
            sort_key: '010',
            title: 'Pre-signing setup',
            status: 'NOT_STARTED',
          },
          {
            entry_id: 'entry-parent',
            document_id: 'doc-parent',
            stage: 'SIGNING',
            sort_key: '100',
            title: 'Parent signing package',
            status: 'FORM_FINAL',
          },
          {
            entry_id: 'entry-inserted',
            document_id: 'doc-inserted',
            stage: 'SIGNING',
            sort_key: '105',
            title: 'Inserted mid-stream item',
            status: 'DRAFT',
          },
          {
            entry_id: 'entry-child',
            parent_entry_id: 'entry-parent',
            stage: 'SIGNING',
            sort_key: '110',
            title: 'Nested child signature dependency',
            status: 'CIRCULATED',
          },
          {
            entry_id: 'entry-closing',
            document_id: 'doc-closing',
            stage: 'CLOSING',
            sort_key: '200',
            title: 'Closing deliverable',
            status: 'NOT_STARTED',
          },
        ],
        action_items: [],
        issues: [],
      };

      const originalIds = payload.checklist_entries.map((entry) => entry.entry_id);
      const context = buildChecklistTemplateContext(payload);
      const documentRows = context.documents.map((row) => row.document_name);

      const preSigningIndex = documentRows.findIndex((row) => row.includes('I. PRE-SIGNING'));
      const signingIndex = documentRows.findIndex((row) => row.includes('II. SIGNING'));
      const closingIndex = documentRows.findIndex((row) => row.includes('III. CLOSING'));
      expect(preSigningIndex).toBeGreaterThanOrEqual(0);
      expect(signingIndex).toBeGreaterThan(preSigningIndex);
      expect(closingIndex).toBeGreaterThan(signingIndex);

      const parentRow = documentRows.find((row) => row.includes('1 Parent signing package'));
      const childRow = documentRows.find((row) => row.includes('1.1'));
      const insertedRow = documentRows.find((row) => row.includes('2 Inserted mid-stream item'));
      expect(parentRow).toBeTruthy();
      expect(childRow).toContain('Nested child signature dependency');
      expect(insertedRow).toBeTruthy();

      const resultingIds = payload.checklist_entries.map((entry) => entry.entry_id);
      expect(resultingIds).toEqual(originalIds);
    },
  );

  it.openspec(['OA-095', 'OA-096'])(
    'renders named pending signatories and signature artifact locations for partially signed documents',
    () => {
      const markdown = renderChecklistMarkdown({
        deal_name: 'Atlas Series A',
        updated_at: '2026-02-23',
        documents: [{ document_id: 'doc-escrow', title: 'Escrow Agreement (Executed)' }],
        checklist_entries: [
          {
            entry_id: 'entry-escrow',
            document_id: 'doc-escrow',
            stage: 'CLOSING',
            sort_key: '100',
            title: 'Escrow Agreement (Executed)',
            status: 'PARTIALLY_SIGNED',
            signatories: [
              {
                party: 'Buyer',
                name: 'A. Lee',
                status: 'RECEIVED',
                signature_artifacts: [{ uri: 'https://drive.example.com/buyer-signature.pdf' }],
              },
              {
                party: 'Seller',
                name: 'M. Kent',
                status: 'PENDING',
                signature_artifacts: [],
              },
            ],
          },
        ],
        action_items: [],
        issues: [],
      });

      expect(markdown).toContain('M. Kent [PENDING]');
      expect(markdown).toContain('A. Lee [RECEIVED]');
      expect(markdown).toContain('https://drive.example.com/buyer-signature.pdf');
    },
  );

  it.openspec(['OA-097', 'OA-099', 'OA-101'])(
    'renders citation-backed working-group document rows and keeps unlinked actions in fallback sections',
    () => {
      const context = buildChecklistTemplateContext({
        deal_name: 'Atlas Series A',
        updated_at: '2026-02-23',
        documents: [{ document_id: 'doc-working-group', title: 'Working Group List' }],
        checklist_entries: [
          {
            entry_id: 'entry-working-group',
            document_id: 'doc-working-group',
            stage: 'PRE_SIGNING',
            sort_key: '010',
            title: 'Working Group List',
            status: 'FORM_FINAL',
            citations: [{ ref: 'Working Group Exhibit A' }],
          },
        ],
        action_items: [
          {
            action_id: 'A-UNLINKED',
            description: 'Collect conflict check forms',
            status: 'NOT_STARTED',
            related_document_ids: [],
          },
        ],
        issues: [],
      });

      expect(context.documents.some((row) => row.document_name.includes('Working Group List'))).toBe(true);
      expect(context.documents.some((row) => row.document_name.includes('Working Group Exhibit A'))).toBe(true);
      expect(context.action_items).toHaveLength(1);
      expect(context.action_items[0]!.item_id).toBe('A-UNLINKED');
      expect(context.working_group).toEqual([]);
    },
  );
});
