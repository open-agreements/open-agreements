import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import AdmZip from 'adm-zip';
import { afterEach, describe, expect } from 'vitest';
import { evaluateComputedProfile, loadComputedProfile } from '../src/core/recipe/computed.js';
import { normalizeBracketArtifacts } from '../src/core/recipe/bracket-normalizer.js';
import { extractAllText } from '../src/core/recipe/verifier.js';
import { itAllure } from './helpers/allure-test.js';

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const tempDirs: string[] = [];
const RECIPE_ID = 'nvca-stock-purchase-agreement';
const RECIPE_DIR = join(import.meta.dirname, '..', 'content', 'recipes', RECIPE_ID);
const it = itAllure.epic('NVCA SPA Template');

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

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

describe('NVCA option resolution policy', () => {
  it.openspec('OA-FIL-018')('costs-of-enforcement policy keeps only the each-party clause', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'oa-nvca-policy-costs-'));
    tempDirs.push(dir);
    const input = join(dir, 'input.docx');
    const output = join(dir, 'output.docx');
    const normalize = JSON.parse(
      readFileSync(join(RECIPE_DIR, 'normalize.json'), 'utf-8')
    ) as {
      paragraph_rules: Array<{
        id: string;
        section_heading: string;
        paragraph_contains: string;
        replacements?: Record<string, string>;
        trim_unmatched_trailing_bracket?: boolean;
      }>;
    };

    writeFileSync(input, buildDocx([
      'Costs of Enforcement',
      '. [If any action at law or in equity (including, arbitration) is necessary to enforce or interpret the terms of any of the Transaction Agreements, the prevailing party shall be entitled to reasonable attorneys’ fees, costs and necessary disbursements in addition to any other relief to which such party may be entitled.] [Each party will bear its own costs in respect of any disputes arising under this Agreement.]',
    ]));

    await normalizeBracketArtifacts(input, output, {
      rules: normalize.paragraph_rules,
      fieldValues: {},
    });

    const text = extractAllText(output);
    expect(text).toContain('Each party will bear its own costs in respect of any disputes arising under this Agreement.');
    expect(text).not.toContain('prevailing party shall be entitled to reasonable attorneys’ fees');
  });

  it.openspec('OA-FIL-018')('dispute-resolution policy defaults arbitration venue when arbitration is selected', () => {
    const profile = loadComputedProfile(RECIPE_DIR);
    expect(profile).not.toBeNull();

    const evaluated = evaluateComputedProfile(profile!, {
      dispute_resolution_mode: 'arbitration',
      state_lower: 'delaware',
    });

    expect(evaluated.auditValues.dispute_resolution_track).toBe('arbitration');
    expect(evaluated.auditValues.forum_governing_law_alignment).toBe('n/a-arbitration');
    expect(evaluated.fillValues.arbitration_location).toBe('San Francisco, California');
  });

  it.openspec('OA-FIL-018')('dispute-resolution policy defaults courts district by state and flags alignment', () => {
    const profile = loadComputedProfile(RECIPE_DIR);
    expect(profile).not.toBeNull();

    const evaluated = evaluateComputedProfile(profile!, {
      dispute_resolution_mode: 'courts',
      state_lower: 'california',
    });

    expect(evaluated.auditValues.dispute_resolution_track).toBe('courts');
    expect(evaluated.auditValues.governing_law_state).toBe('delaware');
    expect(evaluated.auditValues.forum_governing_law_alignment).toBe('mismatch');
    expect(evaluated.fillValues.judicial_district).toBe('Northern District of California');
  });

  it.openspec('OA-FIL-019')('preserves unresolved in-line legal alternatives until an explicit clause policy is added', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'oa-nvca-policy-unresolved-'));
    tempDirs.push(dir);
    const input = join(dir, 'input.docx');
    const output = join(dir, 'output.docx');
    const normalize = JSON.parse(
      readFileSync(join(RECIPE_DIR, 'normalize.json'), 'utf-8')
    ) as {
      paragraph_rules: Array<{
        id: string;
        section_heading: string;
        paragraph_contains: string;
        replacements?: Record<string, string>;
        trim_unmatched_trailing_bracket?: boolean;
      }>;
    };

    writeFileSync(input, buildDocx([
      'Small Business Concern',
      '. The Company together with its affiliates is a [“small business concern”][“smaller business”] within the meaning of the Small Business Act.]',
    ]));

    await normalizeBracketArtifacts(input, output, {
      rules: normalize.paragraph_rules,
      fieldValues: {},
    });

    const text = extractAllText(output);
    expect(text).toContain('[“small business concern”][“smaller business”]');
    expect(text).not.toContain('Small Business Act.]');
  });
});
