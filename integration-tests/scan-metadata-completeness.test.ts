import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import AdmZip from 'adm-zip';
import { afterEach, describe, expect } from 'vitest';
import { scanDocxBrackets } from '../src/commands/scan.js';
import { loadRecipeMetadata } from '../src/core/metadata.js';
import { parseReplacementKey } from '../src/core/recipe/replacement-keys.js';
import { assessScanMetadataCoverage } from '../src/core/validation/scan-metadata.js';
import { itAllure } from './helpers/allure-test.js';

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const tempDirs: string[] = [];
const RECIPE_ID = 'nvca-stock-purchase-agreement';
const RECIPE_DIR = join(import.meta.dirname, '..', 'content', 'recipes', RECIPE_ID);
const it = itAllure.epic('Discovery & Metadata');

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

function loadNvcaCoverageInputs(): {
  metadataFields: string[];
  replacements: Record<string, string>;
  extraCoveredFields: string[];
} {
  const metadata = loadRecipeMetadata(RECIPE_DIR);
  const replacements = JSON.parse(
    readFileSync(join(RECIPE_DIR, 'replacements.json'), 'utf-8')
  ) as Record<string, string>;
  const normalize = JSON.parse(
    readFileSync(join(RECIPE_DIR, 'normalize.json'), 'utf-8')
  ) as {
    paragraph_rules: Array<{ replacements?: Record<string, string> }>;
  };
  const computed = JSON.parse(
    readFileSync(join(RECIPE_DIR, 'computed.json'), 'utf-8')
  ) as {
    rules: Array<{ set_fill?: Record<string, unknown>; set_audit?: Record<string, unknown> }>;
  };

  const extraCovered = new Set<string>();
  for (const rule of normalize.paragraph_rules) {
    for (const value of Object.values(rule.replacements ?? {})) {
      for (const match of value.matchAll(/\{([a-zA-Z0-9_]+)\}/g)) {
        extraCovered.add(match[1]);
      }
    }
  }
  for (const rule of computed.rules) {
    for (const key of Object.keys(rule.set_fill ?? {})) {
      extraCovered.add(key);
    }
    for (const key of Object.keys(rule.set_audit ?? {})) {
      extraCovered.add(key);
    }
  }

  return {
    metadataFields: metadata.fields.map((field) => field.name),
    replacements,
    extraCoveredFields: [...extraCovered].sort(),
  };
}

describe('scan vs metadata completeness', () => {
  it.openspec('OA-172')('flags short placeholders discovered by scan that are not mapped', () => {
    const { metadataFields, replacements, extraCoveredFields } = loadNvcaCoverageInputs();
    const dir = mkdtempSync(join(tmpdir(), 'oa-scan-metadata-gap-'));
    tempDirs.push(dir);
    const input = join(dir, 'input.docx');

    writeFileSync(
      input,
      buildDocx([
        '[Insert Company Name]',
        '[Insert Investor Name]',
        '[Unexpected Placeholder Not In Replacements]',
      ])
    );

    const scan = scanDocxBrackets(input);
    const report = assessScanMetadataCoverage({
      scannedShortPlaceholders: scan.shortPlaceholders,
      metadataFields,
      replacements,
      extraCoveredFields,
    });

    expect(report.coveredShortPlaceholders).toContain('[Insert Company Name]');
    expect(report.coveredShortPlaceholders).toContain('[Insert Investor Name]');
    expect(report.uncoveredShortPlaceholders).toContain('[Unexpected Placeholder Not In Replacements]');
  });

  it.openspec('OA-172')('maps sampled NVCA scanned placeholders to metadata-backed replacements', () => {
    const { metadataFields, replacements, extraCoveredFields } = loadNvcaCoverageInputs();
    const dir = mkdtempSync(join(tmpdir(), 'oa-scan-metadata-sample-'));
    tempDirs.push(dir);
    const input = join(dir, 'input.docx');

    const sampledShortSearchTexts = [...new Set(
      Object.entries(replacements)
        .map(([key, value]) => parseReplacementKey(key, value).searchText)
        .filter((searchText) => searchText.length <= 80)
    )].slice(0, 35);

    writeFileSync(
      input,
      buildDocx(sampledShortSearchTexts)
    );

    const scan = scanDocxBrackets(input);
    const report = assessScanMetadataCoverage({
      scannedShortPlaceholders: scan.shortPlaceholders,
      metadataFields,
      replacements,
      extraCoveredFields,
    });

    expect(scan.shortPlaceholders.length).toBeGreaterThan(20);
    expect(report.uncoveredShortPlaceholders).toEqual([]);
    expect(report.mappedFieldsNotInMetadata).toEqual([]);
  });
});
