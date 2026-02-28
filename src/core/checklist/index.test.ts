import { describe, expect } from 'vitest';
import { itAllure } from '../../../integration-tests/helpers/allure-test.js';
import { buildChecklistTemplateContext } from './index.js';
import { arrayToRecord } from './test-utils.js';

const it = itAllure.epic('Compliance & Governance').withLabels({ feature: 'Checklist Rendering v2' });

describe('checklist render model traceability', () => {
  it.openspec(['OA-CKL-004', 'OA-CKL-005', 'OA-CKL-006'])(
    'renders canonical stage order with nested numbering while keeping stable IDs unchanged',
    () => {
      const entriesArray = [
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
      ];

      const payload = {
        deal_name: 'Atlas Series A',
        updated_at: '2026-02-23',
        documents: arrayToRecord([
          { document_id: 'doc-parent', title: 'Parent signing package' },
          { document_id: 'doc-inserted', title: 'Inserted mid-stream item' },
          { document_id: 'doc-closing', title: 'Closing deliverable' },
        ], 'document_id'),
        checklist_entries: arrayToRecord(entriesArray, 'entry_id'),
        action_items: {},
        issues: {},
      };

      const originalIds = entriesArray.map((entry) => entry.entry_id);
      const context = buildChecklistTemplateContext(payload);
      const titleRows = context.documents.map((row) => row.title);

      const preSigningIndex = titleRows.findIndex((row) => row.includes('I. PRE-SIGNING'));
      const signingIndex = titleRows.findIndex((row) => row.includes('II. SIGNING'));
      const closingIndex = titleRows.findIndex((row) => row.includes('III. CLOSING'));
      expect(preSigningIndex).toBeGreaterThanOrEqual(0);
      expect(signingIndex).toBeGreaterThan(preSigningIndex);
      expect(closingIndex).toBeGreaterThan(signingIndex);

      const parentRow = context.documents.find((row) => row.number === '1' && row.title.includes('Parent signing package'));
      const childRow = context.documents.find((row) => row.number === '1.1');
      const insertedRow = context.documents.find((row) => row.number === '2' && row.title.includes('Inserted mid-stream item'));
      expect(parentRow).toBeTruthy();
      expect(childRow).toBeTruthy();
      expect(childRow!.title).toContain('Nested child signature dependency');
      expect(insertedRow).toBeTruthy();

      const resultingIds = Object.values(payload.checklist_entries).map((entry) => entry.entry_id);
      expect(resultingIds).toEqual(originalIds);
    },
  );

  it.openspec(['OA-CKL-008', 'OA-CKL-009'])(
    'renders named pending signatories and signature artifact locations for partially signed documents',
    () => {
      const context = buildChecklistTemplateContext({
        deal_name: 'Atlas Series A',
        updated_at: '2026-02-23',
        documents: {
          'doc-escrow': { document_id: 'doc-escrow', title: 'Escrow Agreement (Executed)' },
        },
        checklist_entries: {
          'entry-escrow': {
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
        },
        action_items: {},
        issues: {},
      });

      const escrowRow = context.documents.find((row) => row.title.includes('Escrow Agreement'));
      expect(escrowRow).toBeTruthy();

      // Signatories are now sub-rows
      const signatoryRows = context.documents.filter((row) => row.title.includes('Signatory:'));
      expect(signatoryRows.length).toBeGreaterThanOrEqual(2);

      const kentRow = signatoryRows.find((row) => row.title.includes('M. Kent'));
      expect(kentRow).toBeTruthy();
      expect(kentRow!.title).toContain('Pending');

      const leeRow = signatoryRows.find((row) => row.title.includes('A. Lee'));
      expect(leeRow).toBeTruthy();
      expect(leeRow!.title).toContain('Received');
    },
  );

  it.openspec(['OA-CKL-010', 'OA-CKL-012', 'OA-CKL-014'])(
    'renders citation-backed document rows and keeps unlinked actions in fallback sections',
    () => {
      const context = buildChecklistTemplateContext({
        deal_name: 'Atlas Series A',
        updated_at: '2026-02-23',
        documents: {
          'doc-working-group': { document_id: 'doc-working-group', title: 'Working Group List' },
        },
        checklist_entries: {
          'entry-working-group': {
            entry_id: 'entry-working-group',
            document_id: 'doc-working-group',
            stage: 'PRE_SIGNING',
            sort_key: '010',
            title: 'Working Group List',
            status: 'FORM_FINAL',
            citations: [{ ref: 'Working Group Exhibit A' }],
          },
        },
        action_items: {
          'A-UNLINKED': {
            action_id: 'A-UNLINKED',
            description: 'Collect conflict check forms',
            status: 'NOT_STARTED',
            related_document_ids: [],
          },
        },
        issues: {},
      });

      expect(context.documents.some((row) => row.title.includes('Working Group List'))).toBe(true);
      // Citation is now a sub-row
      expect(context.documents.some((row) => row.title.includes('Working Group Exhibit A'))).toBe(true);
      expect(context.action_items).toHaveLength(1);
      expect(context.action_items[0]!.item_id).toBe('A-UNLINKED');
    },
  );
});
