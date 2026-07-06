import { afterEach, describe, expect, vi } from 'vitest';
import { join } from 'node:path';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import AdmZip from 'adm-zip';
import { validateTemplate } from '../src/core/validation/template.js';
import { itAllure } from './helpers/allure-test.js';

// Dual-artifact templates (#1378 / legal-explainer projection): `template.docx`
// is the humanized [bracket]-prose human download, `template.fill.docx` is the
// machine-fillable {token} document. The engine must fill from the variant and
// validation must scan the variant for token coverage.

const it = itAllure.epic('Filling & Rendering');
const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
  vi.unmock('../src/core/metadata.js');
  vi.unmock('../src/core/selector.js');
  vi.unmock('../src/core/unified-pipeline.js');
  vi.unmock('../src/core/fill-utils.js');
  vi.restoreAllMocks();
  vi.resetModules();
});

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

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

function buildDocx(documentText: string): Buffer {
  const zip = new AdmZip();
  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    `<w:document xmlns:w="${W_NS}"><w:body><w:p><w:r><w:t>${documentText}</w:t></w:r></w:p></w:body></w:document>`;
  zip.addFile('[Content_Types].xml', Buffer.from(CONTENT_TYPES_XML, 'utf-8'));
  zip.addFile('_rels/.rels', Buffer.from(RELS_XML, 'utf-8'));
  zip.addFile('word/_rels/document.xml.rels', Buffer.from(WORD_RELS_XML, 'utf-8'));
  zip.addFile('word/document.xml', Buffer.from(xml, 'utf-8'));
  return zip.toBuffer();
}

function createDualArtifactFixture(opts: {
  humanDocText: string;
  fillDocText?: string;
  fieldsYaml: string;
  priorityFields?: string[];
  withMdocTwin?: boolean;
  withReplacements?: boolean;
}): string {
  const dir = mkdtempSync(join(tmpdir(), 'oa-fill-variant-'));
  tempDirs.push(dir);
  const priorityFields = opts.priorityFields ?? [];
  const priorityFieldsLines =
    priorityFields.length === 0
      ? ['priority_fields: []']
      : ['priority_fields:', ...priorityFields.map((field) => `  - ${field}`)];
  writeFileSync(
    join(dir, 'metadata.yaml'),
    [
      'name: Fixture Template',
      'source_url: https://example.com/template.docx',
      'version: "1.0"',
      'license: CC-BY-4.0',
      'allow_derivatives: true',
      'attribution_text: Example Attribution',
      'fields:',
      opts.fieldsYaml,
      ...priorityFieldsLines,
      '',
    ].join('\n'),
    'utf-8'
  );
  writeFileSync(join(dir, 'template.docx'), buildDocx(opts.humanDocText));
  if (opts.fillDocText !== undefined) {
    writeFileSync(join(dir, 'template.fill.docx'), buildDocx(opts.fillDocText));
  }
  if (opts.withMdocTwin ?? true) {
    writeFileSync(join(dir, 'template.mdoc'), '# Fixture Template\n', 'utf-8');
  }
  if (opts.withReplacements) {
    writeFileSync(join(dir, 'replacements.json'), JSON.stringify({ '[X]': '{x}' }), 'utf-8');
  }
  return dir;
}

const COMPANY_FIELD_YAML = [
  '  - name: company_name',
  '    type: string',
  '    description: Company legal name',
].join('\n');

describe('validateTemplate with template.fill.docx', () => {
  it('scans the fill variant for token coverage and passes when covered', () => {
    const dir = createDualArtifactFixture({
      humanDocText: 'By and between [Company legal name] and the undersigned.',
      fillDocText: 'By and between {company_name} and the undersigned.',
      fieldsYaml: COMPANY_FIELD_YAML,
      priorityFields: ['company_name'],
    });
    const result = validateTemplate(dir, 'fixture');
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it('errors when a priority field is missing from the fill variant, naming template.fill.docx', () => {
    const dir = createDualArtifactFixture({
      humanDocText: 'By and between [Company legal name] and the undersigned.',
      fillDocText: 'No tokens here at all.',
      fieldsYaml: COMPANY_FIELD_YAML,
      priorityFields: ['company_name'],
    });
    const result = validateTemplate(dir, 'fixture');
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('template.fill.docx') && e.includes('company_name'))).toBe(true);
  });

  it('errors when template.docx itself carries fill tokens alongside a fill variant', () => {
    const dir = createDualArtifactFixture({
      humanDocText: 'Leaked token {company_name} in the human doc.',
      fillDocText: 'By and between {company_name}.',
      fieldsYaml: COMPANY_FIELD_YAML,
    });
    const result = validateTemplate(dir, 'fixture');
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('token-free'))).toBe(true);
  });

  it('rejects the fill variant + replacements.json combination', () => {
    const dir = createDualArtifactFixture({
      humanDocText: 'Humanized prose.',
      fillDocText: '{company_name}',
      fieldsYaml: COMPANY_FIELD_YAML,
      withReplacements: true,
    });
    const result = validateTemplate(dir, 'fixture');
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('replacements.json'))).toBe(true);
  });

  it('runs the unsafe-tag scan against the fill variant', () => {
    const dir = createDualArtifactFixture({
      humanDocText: 'Humanized prose.',
      fillDocText: 'Unsafe {= 1 + 1} expression and {company_name}.',
      fieldsYaml: COMPANY_FIELD_YAML,
    });
    const result = validateTemplate(dir, 'fixture');
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Unsafe template tag'))).toBe(true);
  });

  it('runs the unsafe-tag scan against the human doc too', () => {
    const dir = createDualArtifactFixture({
      humanDocText: 'Unsafe {#if x} tag in the human doc.',
      fillDocText: '{company_name}',
      fieldsYaml: COMPANY_FIELD_YAML,
    });
    const result = validateTemplate(dir, 'fixture');
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Unsafe template tag'))).toBe(true);
  });

  it('preserves the humanized-skip for mdoc templates without a fill variant', () => {
    const dir = createDualArtifactFixture({
      humanDocText: 'By and between [Company legal name] and the undersigned.',
      fieldsYaml: COMPANY_FIELD_YAML,
      priorityFields: ['company_name'],
    });
    const result = validateTemplate(dir, 'fixture');
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
    expect(result.warnings).toEqual([]);
  });

  it('validates FOR loops and item refs in the fill variant', () => {
    const dir = createDualArtifactFixture({
      humanDocText: 'Humanized signer list.',
      fillDocText: '{FOR item IN board_members} Print Name: {$item.name} {END-FOR item}',
      fieldsYaml: [
        '  - name: board_members',
        '    type: array',
        '    description: Board members',
        '    items:',
        '      - name: name',
        '        type: string',
        '        description: Director name',
      ].join('\n'),
    });
    const result = validateTemplate(dir, 'fixture');
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });
});

describe('fillTemplate input selection', () => {
  async function loadEngineWithPipelineSpy(): Promise<{
    fillTemplate: (args: { templateDir: string; values: Record<string, unknown>; outputPath: string }) => Promise<unknown>;
    runFillPipeline: ReturnType<typeof vi.fn>;
  }> {
    vi.resetModules();
    const runFillPipeline = vi.fn(async (args: { inputPath: string; outputPath: string }) => ({
      outputPath: args.outputPath,
      fieldsUsed: [],
      providedFieldsUsed: [],
      fillCommandCount: 0,
      warnings: [],
    }));
    vi.doMock('../src/core/metadata.js', () => ({
      loadMetadata: vi.fn(() => ({
        name: 'Fixture Template',
        fields: [{ name: 'company_name', type: 'string', description: 'Company' }],
        priority_fields: [] as string[],
      })),
      loadCleanConfig: vi.fn(() => ({})),
    }));
    vi.doMock('../src/core/selector.js', () => ({
      loadSelectionsConfig: vi.fn(() => ({ groups: [] })),
    }));
    vi.doMock('../src/core/unified-pipeline.js', () => ({ runFillPipeline }));
    vi.doMock('../src/core/fill-utils.js', () => ({
      BLANK_PLACEHOLDER: '__BLANK__',
      verifyTemplateFill: vi.fn(() => ({ passed: true, checks: [] })),
    }));
    const module = await import('../src/core/engine.js');
    return { fillTemplate: module.fillTemplate, runFillPipeline };
  }

  it('fills from template.fill.docx when it exists', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'oa-fill-variant-engine-'));
    tempDirs.push(dir);
    writeFileSync(join(dir, 'template.docx'), buildDocx('Humanized prose.'));
    writeFileSync(join(dir, 'template.fill.docx'), buildDocx('{company_name}'));

    const { fillTemplate, runFillPipeline } = await loadEngineWithPipelineSpy();
    await fillTemplate({ templateDir: dir, values: {}, outputPath: join(dir, 'out.docx') });

    expect(runFillPipeline).toHaveBeenCalledTimes(1);
    expect(runFillPipeline.mock.calls[0][0].inputPath).toBe(join(dir, 'template.fill.docx'));
  });

  it('falls back to template.docx when no fill variant exists', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'oa-fill-variant-engine-'));
    tempDirs.push(dir);
    writeFileSync(join(dir, 'template.docx'), buildDocx('{company_name}'));

    const { fillTemplate, runFillPipeline } = await loadEngineWithPipelineSpy();
    await fillTemplate({ templateDir: dir, values: {}, outputPath: join(dir, 'out.docx') });

    expect(runFillPipeline).toHaveBeenCalledTimes(1);
    expect(runFillPipeline.mock.calls[0][0].inputPath).toBe(join(dir, 'template.docx'));
  });
});
