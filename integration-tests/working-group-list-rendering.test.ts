import AdmZip from 'adm-zip';
import { DOMParser } from '@xmldom/xmldom';
import type { Element, Node } from '@xmldom/xmldom';
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

function getParagraphText(docxPath: string): string[] {
  const zip = new AdmZip(docxPath);
  const xml = zip.getEntry('word/document.xml')?.getData().toString('utf-8') ?? '';
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const paragraphs = doc.getElementsByTagNameNS(W_NS, 'p');
  const out: string[] = [];
  for (let i = 0; i < paragraphs.length; i++) {
    const textNodes = paragraphs[i].getElementsByTagNameNS(W_NS, 't');
    const parts: string[] = [];
    for (let j = 0; j < textNodes.length; j++) {
      parts.push(textNodes[j].textContent ?? '');
    }
    const text = parts.join('').trim();
    if (text.length > 0) out.push(text);
  }
  return out;
}

function getTableRows(docxPath: string): string[][] {
  const zip = new AdmZip(docxPath);
  const xml = zip.getEntry('word/document.xml')?.getData().toString('utf-8') ?? '';
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const tables = doc.getElementsByTagNameNS(W_NS, 'tbl');
  const rows: string[][] = [];

  for (let t = 0; t < tables.length; t++) {
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
  }

  return rows;
}

function getXmlContent(docxPath: string, entryPattern: RegExp): string {
  const zip = new AdmZip(docxPath);
  const entries = zip.getEntries();
  const parts: string[] = [];
  for (const entry of entries) {
    if (entryPattern.test(entry.entryName)) {
      parts.push(entry.getData().toString('utf-8'));
    }
  }
  return parts.join('\n');
}

describe('working-group-list rendering', () => {
  it.openspec('OA-CKL-029')('renders one line per working group member', async () => {
    const templateDir = findTemplateDir('working-group-list');
    expect(templateDir).toBeTruthy();

    const tempDir = mkdtempSync(join(tmpdir(), 'oa-working-group-list-'));
    tempDirs.push(tempDir);
    const outputPath = join(tempDir, 'working-group-list.docx');

    await fillTemplate({
      templateDir: templateDir!,
      outputPath,
      values: {
        deal_name: 'Project Atlas - Series A Closing',
        updated_at: '2026-02-22',
        working_group: [
          { name: 'Alex Founder', organization: 'Atlas Co', role: 'CEO', email: 'alex@atlas.co' },
          { name: 'Morgan Counsel', organization: 'Law Firm', role: 'Lead Counsel', email: 'morgan@lawfirm.com' },
        ],
      },
    });

    // Title and date paragraphs
    const paragraphs = getParagraphText(outputPath);
    expect(paragraphs).toContain('Project Atlas - Series A Closing — Working Group List');
    expect(paragraphs).toContain('Updated: 2026-02-22');

    // Table assertions
    const rows = getTableRows(outputPath);
    const nonEmptyRows = rows.filter((row) => row.some((cell) => cell.length > 0));

    // Header row
    expect(nonEmptyRows[0]).toEqual(['Name', 'Organization', 'Role', 'Email']);

    // Data rows contain filled member values
    const alexRow = nonEmptyRows.find((row) => row.includes('Alex Founder'));
    expect(alexRow).toBeTruthy();
    expect(alexRow).toEqual(['Alex Founder', 'Atlas Co', 'CEO', 'alex@atlas.co']);

    const morganRow = nonEmptyRows.find((row) => row.includes('Morgan Counsel'));
    expect(morganRow).toBeTruthy();
    expect(morganRow).toEqual(['Morgan Counsel', 'Law Firm', 'Lead Counsel', 'morgan@lawfirm.com']);

    // No leftover loop markers in the filled output
    const allText = rows.flat().join(' ');
    expect(allText).not.toContain('{FOR');
    expect(allText).not.toContain('{END-FOR');

    // Header XML contains "WORKING GROUP LIST"
    const headerXml = getXmlContent(outputPath, /word\/header\d*\.xml/);
    expect(headerXml).toContain('WORKING GROUP LIST');

    // Footer XML contains "CC0 1.0"
    const footerXml = getXmlContent(outputPath, /word\/footer\d*\.xml/);
    expect(footerXml).toContain('CC0 1.0');
  });
});
