import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import AdmZip from 'adm-zip';
import { afterEach, describe, expect } from 'vitest';
import { normalizeBracketArtifacts } from './bracket-normalizer.js';
import { itAllure } from '../../../integration-tests/helpers/allure-test.js';

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const tempDirs: string[] = [];
const it = itAllure.epic('Cleaning & Normalization');

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function buildDocx(paragraphs: string[]): Buffer {
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

  const body = paragraphs
    .map((text) => `<w:p><w:r><w:t>${escapeXml(text)}</w:t></w:r></w:p>`)
    .join('');

  const documentXml =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    `<w:document xmlns:w="${W_NS}"><w:body>${body}</w:body></w:document>`;

  const zip = new AdmZip();
  zip.addFile('[Content_Types].xml', Buffer.from(contentTypes, 'utf-8'));
  zip.addFile('_rels/.rels', Buffer.from(rels, 'utf-8'));
  zip.addFile('word/_rels/document.xml.rels', Buffer.from(wordRels, 'utf-8'));
  zip.addFile('word/document.xml', Buffer.from(documentXml, 'utf-8'));
  return zip.toBuffer();
}

function readParagraphs(path: string): string[] {
  const zip = new AdmZip(path);
  const xml = zip.getEntry('word/document.xml')?.getData().toString('utf-8') ?? '';
  const out: string[] = [];
  for (const m of xml.matchAll(/<w:p[\s>][\s\S]*?<\/w:p>/g)) {
    const text = [...m[0].matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)]
      .map((entry) => entry[1])
      .join('')
      .trim();
    if (text) out.push(text);
  }
  return out;
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

describe('normalizeBracketArtifacts', () => {
  it('removes bracket artifacts and degenerate optional-clause leftovers', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'oa-bracket-normalizer-'));
    tempDirs.push(dir);

    const input = join(dir, 'input.docx');
    const output = join(dir, 'output.docx');

    const sourceParagraphs = [
      'Costs of Enforcement',
      '. [If any action at law or in equity (including, arbitration) is necessary to enforce or interpret the terms of any of the Transaction Agreements, the prevailing party shall be entitled to reasonable attorneys’ fees, costs and necessary disbursements in addition to any other relief to which such party may be entitled.] [Each party will bear its own costs in respect of any disputes arising under this Agreement.]',
      '[Financial Statements',
      ';] Liabilities. [The] Company has no material liabilities reflected in [the Financial Statements] [financial statements],',
      '. A minimum of  Shares must be sold at the Initial Closing.]',
      '. The Purchasers shall have received from [___________], counsel for the Company.',
      '. As of the Initial Closing, the authorized size of the Board of Directors shall be , and the Board of Directors shall be comprised of .]',
    ];

    writeFileSync(input, buildDocx(sourceParagraphs));
    const stats = await normalizeBracketArtifacts(input, output);
    const resultParagraphs = readParagraphs(output);
    const joined = resultParagraphs.join('\n');

    expect(stats.normalizedParagraphs).toBeGreaterThan(0);
    expect(joined).not.toContain('[');
    expect(joined).not.toContain(']');
    expect(joined).toContain('Costs of Enforcement');
    expect(joined).toContain('Each party will bear its own costs in respect of any disputes arising under this Agreement.');
    expect(joined).toContain('Liabilities. The Company has no material liabilities');
    expect(joined).not.toContain('A minimum of Shares must be sold at the Initial Closing.');
    expect(joined).not.toContain('from , counsel');
    expect(joined).not.toContain('from, counsel');
  });

  it('applies declarative paragraph rules with heading aliases and field interpolation', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'oa-bracket-normalizer-rules-'));
    tempDirs.push(dir);

    const input = join(dir, 'input.docx');
    const output = join(dir, 'output.docx');

    writeFileSync(
      input,
      buildDocx([
        '[Small Business Concern',
        '. The Company together with its “affiliates” is a “small business concern” within the meaning of the Small Business Act.]',
        'Qualifications',
        '. The Purchasers shall have received from [___________], counsel for the Company, an opinion.]',
        '. As of the Initial Closing, the authorized size of the Board of Directors shall be [______], and the Board of Directors shall be comprised of [_________________].]',
        'Residence',
        '. Except as otherwise disclosed in writing to the Company, the Purchaser is not a “person of a country of concern” within the meaning of the Outbound Investment Security Program.]',
      ])
    );

    const stats = await normalizeBracketArtifacts(input, output, {
      rules: [
        {
          id: 'opinion-counsel',
          section_heading: 'Conditions of the Purchasers’ Obligations at Closing',
          section_heading_any: ['Qualifications'],
          paragraph_contains: 'The Purchasers shall have received from',
          paragraph_end_contains: 'counsel for the Company',
          replacements: {
            '[___________]': '{company_counsel_name}',
          },
          trim_unmatched_trailing_bracket: true,
          expected_min_matches: 1,
        },
        {
          id: 'board-composition',
          section_heading: 'Conditions of the Purchasers’ Obligations at Closing',
          section_heading_any: ['Qualifications'],
          paragraph_contains: 'authorized size of the Board of Directors',
          paragraph_end_contains: 'Board of Directors shall be comprised of',
          replacements: {
            '[______]': '{board_size}',
            '[_________________]': '{director_names}',
          },
          trim_unmatched_trailing_bracket: true,
          expected_min_matches: 1,
        },
        {
          id: 'country-of-concern',
          section_heading: 'Representations and Warranties of the Purchaser',
          section_heading_any: ['Residence'],
          paragraph_contains: 'person of a country of concern',
          paragraph_end_contains:
            'within the meaning of the Outbound Investment Security Program.]',
          trim_unmatched_trailing_bracket: true,
          expected_min_matches: 1,
        },
      ],
      fieldValues: {
        company_counsel_name: 'Cooley LLP',
        director_names: 'Jane Founder; Pat Director',
      },
    });

    const resultParagraphs = readParagraphs(output);
    const joined = resultParagraphs.join('\n');

    expect(stats.declarativeRuleApplications).toBe(5);
    expect(stats.declarativeRuleMatchCounts['opinion-counsel']).toBe(1);
    expect(stats.declarativeRuleMatchCounts['board-composition']).toBe(1);
    expect(stats.declarativeRuleMatchCounts['country-of-concern']).toBe(1);
    expect(stats.declarativeRuleExpectationFailures).toEqual([]);
    expect(joined).toContain('Small Business Concern');
    expect(joined).toContain('small business concern” within the meaning of the Small Business Act.');
    expect(joined).toContain('received from Cooley LLP, counsel for the Company');
    expect(joined).toContain('authorized size of the Board of Directors shall be _______');
    expect(joined).toContain('Board of Directors shall be comprised of Jane Founder; Pat Director.');
    expect(joined).toContain('person of a country of concern” within the meaning of the Outbound Investment Security Program.');
    expect(joined).not.toContain(']');
  });

  it('tracks expectation failures when a rule start/end anchor pair is not found', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'oa-bracket-normalizer-expectations-'));
    tempDirs.push(dir);

    const input = join(dir, 'input.docx');
    const output = join(dir, 'output.docx');

    writeFileSync(
      input,
      buildDocx([
        'Qualifications',
        '. The Purchasers shall have received from [___________], counsel for the Company, an opinion.]',
      ])
    );

    const stats = await normalizeBracketArtifacts(input, output, {
      rules: [
        {
          id: 'missed-end-anchor',
          section_heading: 'Conditions of the Purchasers’ Obligations at Closing',
          section_heading_any: ['Qualifications'],
          paragraph_contains: 'The Purchasers shall have received from',
          paragraph_end_contains: 'THIS END ANCHOR DOES NOT EXIST',
          replacements: {
            '[___________]': '{company_counsel_name}',
          },
          expected_min_matches: 1,
        },
      ],
      fieldValues: {
        company_counsel_name: 'Cooley LLP',
      },
    });

    expect(stats.declarativeRuleMatchCounts['missed-end-anchor']).toBe(0);
    expect(stats.declarativeRuleExpectationFailures).toContain(
      'missed-end-anchor: expected at least 1 match(es), found 0'
    );
  });
});
