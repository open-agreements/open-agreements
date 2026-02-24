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

describe('working-group-list rendering', () => {
  it.openspec('OA-177')('renders one line per working group member', async () => {
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

    const lines = getParagraphText(outputPath);
    expect(lines).toContain('Project Atlas - Series A Closing - Working Group List');
    expect(lines).toContain('Updated: 2026-02-22');
    expect(lines).toContain('Name | Organization | Role | Email');
    expect(lines).toContain('Alex Founder | Atlas Co | CEO | alex@atlas.co');
    expect(lines).toContain('Morgan Counsel | Law Firm | Lead Counsel | morgan@lawfirm.com');
  });
});
