import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import AdmZip from 'adm-zip';
import { afterEach, describe, expect } from 'vitest';
import type { NormalizeConfig, RecipeMetadata } from '../src/core/metadata.js';
import { checkRecipeSourceDrift, computeSourceStructureSignature } from '../src/core/recipe/source-drift.js';
import { itAllure } from './helpers/allure-test.js';

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const tempDirs: string[] = [];
const it = itAllure.epic('Verification & Drift');

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

function sha256Hex(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function makeMetadata(sourceSha: string): RecipeMetadata {
  return {
    name: 'Synthetic Recipe',
    description: 'Synthetic drift canary fixture',
    source_url: 'https://example.com/synthetic.docx',
    source_version: '1.0',
    license_note: 'fixture',
    optional: false,
    source_sha256: sourceSha,
    fields: [
      { name: 'company_name', type: 'string', description: 'Company' },
    ],
    required_fields: ['company_name'],
  };
}

const NORMALIZE_CONFIG: NormalizeConfig = {
  paragraph_rules: [
    {
      id: 'costs-policy',
      section_heading: 'Costs of Enforcement',
      paragraph_contains: 'Each party will bear its own costs in respect of any disputes arising under this Agreement.',
      paragraph_end_contains: 'this Agreement.]',
      trim_unmatched_trailing_bracket: true,
    },
  ],
};

describe('source drift canary', () => {
  it('passes when hash and structural anchors match recipe configuration', () => {
    const dir = mkdtempSync(join(tmpdir(), 'oa-source-drift-pass-'));
    tempDirs.push(dir);
    const sourcePath = join(dir, 'source.docx');
    writeFileSync(sourcePath, buildDocx([
      '[Insert Company Name]',
      'Costs of Enforcement',
      '[Each party will bear its own costs in respect of any disputes arising under this Agreement.]',
    ]));

    const metadata = makeMetadata(sha256Hex(sourcePath));
    const replacements = {
      '[Insert Company Name]': '{company_name}',
    };

    const result = checkRecipeSourceDrift({
      recipeId: 'synthetic',
      sourcePath,
      metadata,
      replacements,
      normalizeConfig: NORMALIZE_CONFIG,
    });

    expect(result.hash_match).toBe(true);
    expect(result.diff.missing_replacement_anchor_groups).toEqual([]);
    expect(result.diff.missing_normalize_heading_anchors).toEqual([]);
    expect(result.diff.missing_normalize_paragraph_anchors).toEqual([]);
    expect(result.diff.missing_normalize_paragraph_end_anchors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('fails when source hash mismatches metadata', () => {
    const dir = mkdtempSync(join(tmpdir(), 'oa-source-drift-hash-'));
    tempDirs.push(dir);
    const sourcePath = join(dir, 'source.docx');
    writeFileSync(sourcePath, buildDocx(['[Insert Company Name]']));

    const metadata = makeMetadata('0'.repeat(64));
    const replacements = {
      '[Insert Company Name]': '{company_name}',
    };

    const result = checkRecipeSourceDrift({
      recipeId: 'synthetic',
      sourcePath,
      metadata,
      replacements,
      normalizeConfig: NORMALIZE_CONFIG,
    });

    expect(result.hash_match).toBe(false);
    expect(result.ok).toBe(false);
  });

  it('reports structural anchor drift for missing replacement and normalize anchors', () => {
    const dir = mkdtempSync(join(tmpdir(), 'oa-source-drift-anchors-'));
    tempDirs.push(dir);
    const sourcePath = join(dir, 'source.docx');
    writeFileSync(sourcePath, buildDocx([
      'Unrelated heading',
      'No expected placeholders in this file.',
    ]));

    const metadata = makeMetadata(sha256Hex(sourcePath));
    const replacements = {
      '[Insert Company Name]': '{company_name}',
    };

    const result = checkRecipeSourceDrift({
      recipeId: 'synthetic',
      sourcePath,
      metadata,
      replacements,
      normalizeConfig: NORMALIZE_CONFIG,
    });

    expect(result.diff.missing_replacement_anchor_groups).toContain('[Insert Company Name]');
    expect(result.diff.missing_normalize_heading_anchors).toContain('costs-policy');
    expect(result.diff.missing_normalize_paragraph_anchors).toContain(
      'Each party will bear its own costs in respect of any disputes arising under this Agreement.'
    );
    expect(result.diff.missing_normalize_paragraph_end_anchors).toContain('this Agreement.]');
    expect(result.ok).toBe(false);
  });

  it('emits basic structure signature useful for drift diagnostics', () => {
    const dir = mkdtempSync(join(tmpdir(), 'oa-source-drift-signature-'));
    tempDirs.push(dir);
    const sourcePath = join(dir, 'source.docx');
    writeFileSync(sourcePath, buildDocx([
      '[Heading Without Closing Bracket',
      '[Insert Company Name]',
      '[This is an intentionally very long clause anchor that exceeds eighty characters and should be counted as long.]',
    ]));

    const signature = computeSourceStructureSignature(sourcePath);
    expect(signature.paragraph_count).toBe(3);
    expect(signature.heading_like_count).toBe(1);
    expect(signature.short_placeholder_count).toBe(1);
    expect(signature.long_clause_count).toBe(1);
    expect(signature.unique_short_placeholders).toContain('[Insert Company Name]');
  });
});
