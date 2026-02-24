import AdmZip from 'adm-zip';
import { DOMParser } from '@xmldom/xmldom';
import type { Element, Node } from '@xmldom/xmldom';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect } from 'vitest';
import { itAllure } from './helpers/allure-test.js';
import { fillTemplate } from '../src/core/engine.js';
import { buildChecklistTemplateContext } from '../src/core/checklist/index.js';
import { findTemplateDir } from '../src/utils/paths.js';

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const it = itAllure.epic('Template Rendering');
const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function getTableRowsAsCellText(docxPath: string): string[][][] {
  const zip = new AdmZip(docxPath);
  const xml = zip.getEntry('word/document.xml')?.getData().toString('utf-8') ?? '';
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const tables = doc.getElementsByTagNameNS(W_NS, 'tbl');
  const result: string[][][] = [];

  for (let t = 0; t < tables.length; t++) {
    const rows: string[][] = [];
    const rowNodes = Array.from(tables[t].childNodes ?? []).filter((node: Node): node is Element => {
      if (node.nodeType !== 1) return false;
      const element = node as Element;
      return element.localName === 'tr' && element.namespaceURI === W_NS;
    });
    for (const row of rowNodes) {
      const cells = Array.from(row.childNodes ?? []).filter((node: Node): node is Element => {
        if (node.nodeType !== 1) return false;
        const element = node as Element;
        return element.localName === 'tc' && element.namespaceURI === W_NS;
      });
      const cellText = cells.map((cell) => {
        const textNodes = cell.getElementsByTagNameNS(W_NS, 't');
        const parts: string[] = [];
        for (let i = 0; i < textNodes.length; i++) {
          parts.push(textNodes[i].textContent ?? '');
        }
        return parts.join('').trim();
      });
      rows.push(cellText);
    }
    result.push(rows);
  }

  return result;
}

describe('closing-checklist rendering', () => {
  it.openspec('OA-175')('renders stage-first checklist rows with linked items and unlinked fallbacks', async () => {
    const templateDir = findTemplateDir('closing-checklist');
    expect(templateDir).toBeTruthy();

    const tempDir = mkdtempSync(join(tmpdir(), 'oa-closing-checklist-'));
    tempDirs.push(tempDir);
    const outputPath = join(tempDir, 'closing-checklist.docx');

    await fillTemplate({
      templateDir: templateDir!,
      outputPath,
      values: buildChecklistTemplateContext({
        deal_name: 'Project Atlas - Series A Closing',
        updated_at: '2026-02-20',
        documents: {
          'doc-spa-form': {
            document_id: 'doc-spa-form',
            title: 'Stock Purchase Agreement (Form)',
            primary_link: 'https://drive.example.com/spa-form',
            labels: ['phase:signing'],
          },
          'doc-escrow-exec': {
            document_id: 'doc-escrow-exec',
            title: 'Escrow Agreement (Executed)',
            primary_link: 'https://drive.example.com/escrow-exec',
            labels: ['phase:closing'],
          },
        },
        checklist_entries: {
          'entry-spa': {
            entry_id: 'entry-spa',
            document_id: 'doc-spa-form',
            stage: 'SIGNING',
            sort_key: '100',
            title: 'Stock Purchase Agreement (Form)',
            status: 'FORM_FINAL',
            citations: [{ ref: 'SPA §2.1' }],
          },
          'entry-escrow': {
            entry_id: 'entry-escrow',
            document_id: 'doc-escrow-exec',
            stage: 'CLOSING',
            sort_key: '200',
            title: 'Escrow Agreement (Executed)',
            status: 'PARTIALLY_SIGNED',
            signatories: [
              {
                party: 'Buyer',
                name: 'A. Lee',
                status: 'RECEIVED',
                signature_artifacts: [{ uri: 'https://drive.example.com/buyer-escrow-sig.pdf' }],
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
        action_items: {
          'A-101': {
            action_id: 'A-101',
            description: 'Collect escrow signature pages',
            status: 'IN_PROGRESS',
            assigned_to: { organization: 'Finance' },
            due_date: '2026-02-24',
            related_document_ids: ['doc-escrow-exec'],
          },
          'A-102': {
            action_id: 'A-102',
            description: 'Order good standing certificate',
            status: 'NOT_STARTED',
            assigned_to: { organization: 'Paralegal' },
            due_date: '2026-02-25',
            related_document_ids: [],
          },
        },
        issues: {
          'I-77': {
            issue_id: 'I-77',
            title: 'MFN carveout language',
            status: 'OPEN',
            summary: 'Pending partner review',
            related_document_ids: ['doc-spa-form'],
          },
          'I-88': {
            issue_id: 'I-88',
            title: 'Outstanding tax certificate',
            status: 'OPEN',
            summary: 'Not yet raised to counterparty',
            related_document_ids: [],
          },
        },
      }),
    });

    const tables = getTableRowsAsCellText(outputPath);
    expect(tables).toHaveLength(4);
    expect(tables.map((table) => table.map((row) => row.length))).toEqual([
      [4],
      [2, 2, 2, 2, 2, 2, 2],
      [5, 5],
      [5, 5],
    ]);

    expect(tables[1][1]).toEqual(['II. SIGNING', '']);
    expect(tables[1][2][0]).toContain('1 Stock Purchase Agreement (Form)');
    expect(tables[1][3][0]).toContain('Issue I-77');
    expect(tables[1][4]).toEqual(['III. CLOSING', '']);
    expect(tables[1][5][0]).toContain('1 Escrow Agreement (Executed)');
    expect(tables[1][6][0]).toContain('Action A-101');

    expect(tables[2][1][0]).toBe('A-102');
    expect(tables[3][1][0]).toBe('I-88');
  });
});
