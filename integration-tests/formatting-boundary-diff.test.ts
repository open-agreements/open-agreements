import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import AdmZip from 'adm-zip';
import { DOMParser } from '@xmldom/xmldom';
import { afterEach, describe, expect, it } from 'vitest';
import { normalizeBracketArtifacts } from '../src/core/recipe/bracket-normalizer.js';

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function buildStyledDocx(documentBodyXml: string): Buffer {
  const contentTypes =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
    '</Types>';

  const rels =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
    '</Relationships>';

  const wordRels =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>';

  const documentXml =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    `<w:document xmlns:w="${W_NS}"><w:body>${documentBodyXml}</w:body></w:document>`;

  const zip = new AdmZip();
  zip.addFile('[Content_Types].xml', Buffer.from(contentTypes, 'utf-8'));
  zip.addFile('_rels/.rels', Buffer.from(rels, 'utf-8'));
  zip.addFile('word/_rels/document.xml.rels', Buffer.from(wordRels, 'utf-8'));
  zip.addFile('word/document.xml', Buffer.from(documentXml, 'utf-8'));
  return zip.toBuffer();
}

interface RunInfo {
  text: string;
  bold: boolean;
  underline: boolean;
}

function readParagraphRuns(docxPath: string): RunInfo[][] {
  const zip = new AdmZip(docxPath);
  const xml = zip.getEntry('word/document.xml')?.getData().toString('utf-8') ?? '';
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'text/xml');
  const paragraphs = doc.getElementsByTagNameNS(W_NS, 'p');
  const out: RunInfo[][] = [];

  for (let pi = 0; pi < paragraphs.length; pi++) {
    const para = paragraphs[pi];
    const runs = para.getElementsByTagNameNS(W_NS, 'r');
    const row: RunInfo[] = [];

    for (let ri = 0; ri < runs.length; ri++) {
      const run = runs[ri];
      const tElements = run.getElementsByTagNameNS(W_NS, 't');
      let text = '';
      for (let ti = 0; ti < tElements.length; ti++) {
        text += tElements[ti].textContent ?? '';
      }
      if (text.length === 0) continue;

      const rPr = run.getElementsByTagNameNS(W_NS, 'rPr')[0];
      const boldEl = rPr?.getElementsByTagNameNS(W_NS, 'b')[0];
      const underlineEl = rPr?.getElementsByTagNameNS(W_NS, 'u')[0];
      const bold = Boolean(boldEl) && boldEl.getAttributeNS(W_NS, 'val') !== '0';
      const underline = Boolean(underlineEl) && underlineEl.getAttributeNS(W_NS, 'val') !== 'none';
      row.push({ text, bold, underline });
    }

    out.push(row);
  }

  return out;
}

function joinText(runs: RunInfo[]): string {
  return runs.map((run) => run.text).join('');
}

describe('run-level formatting boundary diff', () => {
  it('preserves underline boundaries while stripping heading-leading brackets', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'oa-run-boundary-heading-'));
    tempDirs.push(dir);
    const input = join(dir, 'input.docx');
    const output = join(dir, 'output.docx');

    const body =
      '<w:p>' +
      '  <w:r><w:rPr><w:u w:val="single"/></w:rPr><w:t>[Real Property</w:t></w:r>' +
      '  <w:r><w:rPr><w:u w:val="single"/></w:rPr><w:t xml:space="preserve"> Holding Corporation</w:t></w:r>' +
      '</w:p>';

    writeFileSync(input, buildStyledDocx(body));
    await normalizeBracketArtifacts(input, output, {
      rules: [{
        id: 'activate-declarative-mode',
        section_heading: 'No Match Heading',
        paragraph_contains: 'No Match Anchor',
      }],
    });

    const [runs] = readParagraphRuns(output);
    expect(joinText(runs)).toBe('Real Property Holding Corporation');
    expect(runs.length).toBe(2);
    expect(runs[0].underline).toBe(true);
    expect(runs[1].underline).toBe(true);
  });

  it('trims trailing unmatched bracket without moving underlined anchor text', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'oa-run-boundary-trailing-'));
    tempDirs.push(dir);
    const input = join(dir, 'input.docx');
    const output = join(dir, 'output.docx');

    const body =
      '<w:p>' +
      '  <w:r><w:t xml:space="preserve">See </w:t></w:r>' +
      '  <w:r><w:rPr><w:u w:val="single"/></w:rPr><w:t>Exhibit A</w:t></w:r>' +
      '  <w:r><w:t xml:space="preserve"> attached to this Agreement.]</w:t></w:r>' +
      '</w:p>';

    writeFileSync(input, buildStyledDocx(body));
    await normalizeBracketArtifacts(input, output, {
      rules: [{
        id: 'activate-declarative-mode',
        section_heading: 'No Match Heading',
        paragraph_contains: 'No Match Anchor',
      }],
    });

    const [runs] = readParagraphRuns(output);
    expect(joinText(runs)).toBe('See Exhibit A attached to this Agreement.');
    const exhibitRun = runs.find((run) => run.text.includes('Exhibit A'));
    expect(exhibitRun?.underline).toBe(true);
    expect(exhibitRun?.text).toBe('Exhibit A');
  });
});

