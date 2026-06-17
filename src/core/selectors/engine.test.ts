import { describe, expect } from 'vitest';
import { itAllure } from '../../../integration-tests/helpers/allure-test.js';
import { join } from 'node:path';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import AdmZip from 'adm-zip';
import { applySelectorContracts } from './index.js';
import type { FieldSelectorManifest } from './manifest-schema.js';

const it = itAllure.epic('Filling & Rendering');

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

function para(text: string, styleId?: string): string {
  const pPr = styleId ? `<w:pPr><w:pStyle w:val="${styleId}"/></w:pPr>` : '';
  return `<w:p>${pPr}<w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;
}

function buildDocx(bodyParas: string[]): string {
  const documentXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<w:document xmlns:w="${W_NS}"><w:body>${bodyParas.join('')}</w:body></w:document>`;
  const zip = new AdmZip();
  zip.addFile(
    '[Content_Types].xml',
    Buffer.from(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
        `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
        `<Default Extension="xml" ContentType="application/xml"/>` +
        `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>` +
        `</Types>`,
      'utf-8',
    ),
  );
  zip.addFile(
    '_rels/.rels',
    Buffer.from(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>` +
        `</Relationships>`,
      'utf-8',
    ),
  );
  zip.addFile('word/document.xml', Buffer.from(documentXml, 'utf-8'));
  const dir = mkdtempSync(join(tmpdir(), 'selector-engine-'));
  const path = join(dir, 'in.docx');
  zip.writeZip(path);
  return path;
}

function textOf(docxPath: string): string {
  const zip = new AdmZip(docxPath);
  const xml = zip.getEntry('word/document.xml')!.getData().toString('utf-8');
  return [...xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('');
}

const companyManifest = (occurrences: FieldSelectorManifest['occurrences']): FieldSelectorManifest => ({
  schema_version: 1,
  field_id: 'company_name',
  field_label: 'Company Name',
  description: '',
  source_template_version: '10-28-2025',
  occurrences,
  postconditions: [],
  failure_behavior: 'warn',
  fixtures: [],
});

describe('applySelectorContracts (resolve → patch → serialize)', () => {
  it.openspec(['OA-SEL-011','OA-SEL-020'])('[OA-SEL-011] rewrites two heterogeneous anchors to one {company_name} tag', async () => {
    const input = buildDocx([
      para('This Agreement is entered into by [Insert Company Name] (the Company).'),
      para('All references to [Company name] mean the Company.'),
    ]);
    const out = join(mkdtempSync(join(tmpdir(), 'selector-out-')), 'out.docx');
    const manifest = companyManifest([
      { primary: { kind: 'regex', pattern: '\\[Insert Company Name\\]' } },
      { primary: { kind: 'regex', pattern: '\\[Company name\\]' } },
    ]);

    const result = await applySelectorContracts(input, out, [manifest]);

    const text = textOf(out);
    expect(result.fields[0].unresolved).toBe(false);
    expect(text).toContain('{company_name}');
    expect(text).not.toContain('[Insert Company Name]');
    expect(text).not.toContain('[Company name]');
    // {company_name} tag appears once per occurrence (2).
    expect((text.match(/\{company_name\}/g) ?? []).length).toBe(2);
    // Injected bookmarks are stripped on serialization.
    const raw = readFileSync(out).toString('latin1');
    expect(raw).not.toContain('_bk_');
  });

  it.openspec('OA-SEL-003')('[OA-SEL-003] a section scope disambiguates the preamble blank from a stray blank', async () => {
    const input = buildDocx([
      para('Stray earlier blank [____________] elsewhere.'),
      para('PREFERRED STOCK PURCHASE AGREEMENT', 'Heading1'),
      para('made by and among [____________], a Delaware corporation.'),
    ]);
    const out = join(mkdtempSync(join(tmpdir(), 'selector-out-')), 'out.docx');
    const manifest = companyManifest([
      {
        scope: [{ kind: 'section', headingStyleId: 'Heading1' }],
        primary: { kind: 'regex', pattern: '\\[____________\\]' },
      },
    ]);

    const result = await applySelectorContracts(input, out, [manifest]);

    expect(result.fields[0].unresolved).toBe(false);
    const text = textOf(out);
    // Only the in-section blank is rewritten; the stray earlier blank remains.
    expect((text.match(/\{company_name\}/g) ?? []).length).toBe(1);
    expect(text).toContain('Stray earlier blank [____________] elsewhere.');
  });

  it.openspec('OA-SEL-014')('[OA-SEL-014] failure_behavior=block throws on an unresolved occurrence', async () => {
    const input = buildDocx([para('No anchor here at all.')]);
    const out = join(mkdtempSync(join(tmpdir(), 'selector-out-')), 'out.docx');
    const manifest: FieldSelectorManifest = {
      ...companyManifest([{ primary: { kind: 'regex', pattern: '\\[Insert Company Name\\]' } }]),
      failure_behavior: 'block_render_and_request_review',
    };
    await expect(applySelectorContracts(input, out, [manifest])).rejects.toThrow(/blocked render/i);
  });

  it.openspec('OA-SEL-015')('[OA-SEL-015] failure_behavior=warn does not throw on an unresolved occurrence', async () => {
    const input = buildDocx([para('No anchor here at all.')]);
    const out = join(mkdtempSync(join(tmpdir(), 'selector-out-')), 'out.docx');
    const manifest = companyManifest([{ primary: { kind: 'regex', pattern: '\\[Insert Company Name\\]' } }]);
    const result = await applySelectorContracts(input, out, [manifest]);
    expect(result.warnings.length).toBe(1);
    expect(result.fields[0].unresolved).toBe(true);
  });
});