import AdmZip from 'adm-zip';
import { DOMParser } from '@xmldom/xmldom';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect } from 'vitest';
import { itAllure } from './helpers/allure-test.js';
import { fillTemplate } from '../src/core/engine.js';
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
    const rowNodes = Array.from((tables[t] as any).childNodes ?? []).filter(
      (node: any) => node?.localName === 'tr' && node?.namespaceURI === W_NS,
    );
    for (const row of rowNodes as any[]) {
      const cells = Array.from(row.childNodes ?? []).filter(
        (node: any) => node?.localName === 'tc' && node?.namespaceURI === W_NS,
      );
      const cellText = cells.map((cell: any) => {
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
  it('renders one table row per checklist entry when arrays contain multiple rows', async () => {
    const templateDir = findTemplateDir('closing-checklist');
    expect(templateDir).toBeTruthy();

    const tempDir = mkdtempSync(join(tmpdir(), 'oa-closing-checklist-'));
    tempDirs.push(tempDir);
    const outputPath = join(tempDir, 'closing-checklist.docx');

    await fillTemplate({
      templateDir: templateDir!,
      outputPath,
      values: {
        deal_name: 'Project Atlas - Series A Closing',
        created_at: '2026-02-20',
        updated_at: '2026-02-20',
        working_group: [
          { name: 'Alex Founder', organization: 'Atlas Co', role: 'CEO', email: 'alex@atlas.co' },
          { name: 'Morgan Counsel', organization: 'Law Firm', role: 'Lead Counsel', email: 'morgan@lawfirm.com' },
        ],
        documents: [
          { document_name: 'Stock Purchase Agreement', status: 'FORM_FINAL' },
          { document_name: "Investors' Rights Agreement", status: 'INTERNAL_REVIEW' },
        ],
        action_items: [
          {
            item_id: 'A-101',
            description: 'Collect all board signatures',
            status: 'IN_PROGRESS',
            assigned_to: { organization: 'Finance' },
            due_date: '2026-02-24',
          },
          {
            item_id: 'A-102',
            description: 'Finalize cap table',
            status: 'NOT_STARTED',
            assigned_to: { organization: 'Finance' },
            due_date: '2026-02-25',
          },
        ],
        open_issues: [
          {
            issue_id: 'I-77',
            title: 'MFN carveout language',
            status: 'OPEN',
            escalation_tier: 'RED',
            resolution: '',
          },
        ],
      },
    });

    const tables = getTableRowsAsCellText(outputPath);
    expect(tables).toHaveLength(4);
    expect(tables.map((table) => table.map((row) => row.length))).toEqual([
      [4, 4, 4],
      [2, 2, 2],
      [5, 5, 5],
      [5, 5],
    ]);

    expect(tables[0][1]).toEqual(['Alex Founder', 'Atlas Co', 'CEO', 'alex@atlas.co']);
    expect(tables[0][2]).toEqual(['Morgan Counsel', 'Law Firm', 'Lead Counsel', 'morgan@lawfirm.com']);
    expect(tables[1][1]).toEqual(['Stock Purchase Agreement', 'FORM_FINAL']);
    expect(tables[1][2]).toEqual(["Investors' Rights Agreement", 'INTERNAL_REVIEW']);
    expect(tables[2][1][0]).toBe('A-101');
    expect(tables[2][2][0]).toBe('A-102');
  });
});
