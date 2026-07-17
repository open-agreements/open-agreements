import { afterEach, describe, expect } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import AdmZip from 'adm-zip';
import { itAllure } from './helpers/allure-test.js';
import { resolveFieldSelectorDir } from '../src/utils/paths.js';
import { loadFieldSelectorMetadata, loadCleanConfig } from '../src/core/metadata.js';
import { runFillPipeline } from '../src/core/unified-pipeline.js';

// Issue #616: nvca-indemnification-agreement published three fields that
// silently no-oped. These tests pin the fix:
//   - agreement_effective_date is bound to the opening-clause date blank
//     "[___________], 20[__]" and is typed `date` (ISO input renders as
//     "March 15, 2026").
//   - appointing_stockholder_ipo_termination_clause is bound to the bracketed
//     optional clause in Section 1(d); empty default removes the clause while
//     preserving the sentence-ending period.
//   - indemnification_section_letter is unpublished: its "[E]" anchor only
//     ever existed inside treatise-citation commentary that clean.json removes,
//     so the key always zero-matched and no operative slot exists.
//
// The document paragraphs come verbatim from the cleaned source (see the
// fixture), so the replacements are exercised against the exact text the real
// pipeline patches — without a network download.

const it = itAllure.epic('Filling & Rendering');

const TEMPLATE_DIR = resolveFieldSelectorDir('nvca-indemnification-agreement');

const CLEANED_PARAGRAPHS = JSON.parse(
  readFileSync(join(__dirname, 'fixtures', 'nvca-indemnification-cleaned-paragraphs.json'), 'utf-8'),
) as { opening_clause: string; section_1d_appointing_stockholder: string };

const IPO_TERMINATION_CLAUSE =
  ", and terminate on the closing of an initial public offering of the Company's Common Stock; " +
  'provided, however, that in the event of any such suspension or termination, the Appointing ' +
  "Stockholder's rights to indemnification and advancement of expenses will not be suspended or " +
  'terminated with respect to any Proceeding based in whole or in part on facts and circumstances ' +
  'occurring at any time prior to such suspension or termination regardless of whether the ' +
  'Proceeding arises before or after such suspension or termination';

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

const CONTENT_TYPES_XML =
  '<?xml version="1.0" encoding="UTF-8"?>' +
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
  '<Default Extension="xml" ContentType="application/xml"/>' +
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
  '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
  '</Types>';

const RELS_XML =
  '<?xml version="1.0" encoding="UTF-8"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
  '</Relationships>';

const WORD_RELS_XML =
  '<?xml version="1.0" encoding="UTF-8"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildDocx(paragraphs: string[]): Buffer {
  const body = paragraphs
    .map((text) => `<w:p><w:r><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`)
    .join('');
  const documentXml =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    `<w:document xmlns:w="${W_NS}"><w:body>${body}</w:body></w:document>`;
  const zip = new AdmZip();
  zip.addFile('[Content_Types].xml', Buffer.from(CONTENT_TYPES_XML, 'utf-8'));
  zip.addFile('_rels/.rels', Buffer.from(RELS_XML, 'utf-8'));
  zip.addFile('word/_rels/document.xml.rels', Buffer.from(WORD_RELS_XML, 'utf-8'));
  zip.addFile('word/document.xml', Buffer.from(documentXml, 'utf-8'));
  return zip.toBuffer();
}

function extractText(docxPath: string): string {
  const xml = new AdmZip(docxPath).readAsText('word/document.xml');
  const matches = xml.match(/<w:t[^>]*>[^<]*<\/w:t>/g) ?? [];
  return matches.map((m) => m.replace(/<[^>]+>/g, '')).join('');
}

async function fillClausesDoc(values: Record<string, string>): Promise<string> {
  const tempDir = mkdtempSync(join(tmpdir(), 'nvca-indem-bindings-'));
  tempDirs.push(tempDir);
  const inputPath = join(tempDir, 'source.docx');
  const outputPath = join(tempDir, 'output.docx');
  writeFileSync(
    inputPath,
    buildDocx([CLEANED_PARAGRAPHS.opening_clause, CLEANED_PARAGRAPHS.section_1d_appointing_stockholder]),
  );

  const metadata = loadFieldSelectorMetadata(TEMPLATE_DIR);
  const replacements = JSON.parse(readFileSync(join(TEMPLATE_DIR, 'replacements.json'), 'utf-8')) as Record<string, string>;
  await runFillPipeline({
    inputPath,
    outputPath,
    values,
    fields: metadata.fields,
    priorityFieldNames: [],
    cleanPatch: { cleanConfig: loadCleanConfig(TEMPLATE_DIR), replacements },
    verify: async () => ({ passed: true, checks: [] }),
  });
  return extractText(outputPath);
}

describe('nvca-indemnification-agreement field bindings (#616)', () => {
  it('publishes no dead fields: indemnification_section_letter is gone and every replacement targets a published field', () => {
    const metadata = loadFieldSelectorMetadata(TEMPLATE_DIR);
    const fieldNames = metadata.fields.map((f) => f.name);
    expect(fieldNames).not.toContain('indemnification_section_letter');
    expect(metadata.priority_fields ?? []).not.toContain('indemnification_section_letter');

    const replacements = JSON.parse(
      readFileSync(join(TEMPLATE_DIR, 'replacements.json'), 'utf-8'),
    ) as Record<string, string>;
    expect(Object.keys(replacements)).not.toContain('[E]');

    // The two previously dead-but-kept fields are now bound.
    const boundFields = new Set(
      Object.values(replacements).flatMap((v) => [...v.matchAll(/\{([a-z_][a-z0-9_]*)\}/g)].map((m) => m[1])),
    );
    expect(boundFields.has('agreement_effective_date')).toBe(true);
    expect(boundFields.has('appointing_stockholder_ipo_termination_clause')).toBe(true);
    // Every replacement tag targets a published field.
    for (const field of boundFields) {
      expect(fieldNames).toContain(field);
    }
  });

  it('agreement_effective_date is typed date and ISO input fills the opening-clause blank as a document date', async () => {
    const metadata = loadFieldSelectorMetadata(TEMPLATE_DIR);
    const dateField = metadata.fields.find((f) => f.name === 'agreement_effective_date');
    expect(dateField?.type).toBe('date');

    const text = await fillClausesDoc({
      agreement_effective_date: '2026-03-15',
      company_name: 'Meridian Sentinel Inc.',
      indemnitee_name: 'Jordan Sentinel',
    });
    expect(text).toContain('as of March 15, 2026 between Meridian Sentinel Inc.');
    expect(text).not.toContain('[___________]');
    expect(text).not.toContain('20[__]');
  });

  it('empty appointing_stockholder_ipo_termination_clause removes the bracketed clause and preserves the sentence period', async () => {
    const text = await fillClausesDoc({
      agreement_effective_date: '2026-03-15',
      company_name: 'Meridian Sentinel Inc.',
      indemnitee_name: 'Jordan Sentinel',
    });
    expect(text).toContain('representative on the Company’s Board. The Company and Indemnitee intend');
    expect(text).not.toContain('terminate on the closing of an initial public offering');
  });

  it('supplied appointing_stockholder_ipo_termination_clause is inserted before the sentence period', async () => {
    const text = await fillClausesDoc({
      agreement_effective_date: '2026-03-15',
      company_name: 'Meridian Sentinel Inc.',
      indemnitee_name: 'Jordan Sentinel',
      appointing_stockholder_ipo_termination_clause: IPO_TERMINATION_CLAUSE,
    });
    expect(text).toContain(
      "Board, and terminate on the closing of an initial public offering of the Company's Common Stock",
    );
    expect(text).toContain('before or after such suspension or termination. The Company and Indemnitee intend');
    expect(text).not.toContain('..');
    expect(text).not.toContain('[, and terminate');
  });
});
