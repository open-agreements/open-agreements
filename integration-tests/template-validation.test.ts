import { afterEach, describe, expect } from 'vitest';
import { join } from 'node:path';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import AdmZip from 'adm-zip';
import { validateTemplate } from '../src/core/validation/template.js';
import { validateMetadata } from '../src/core/metadata.js';
import {
  allureAttachment,
  allureJsonAttachment,
  allureParameter,
  allureStep,
  itAllure,
} from './helpers/allure-test.js';

// These tests rely on the existing templates in the repo
const templatesDir = join(import.meta.dirname, '..', 'content', 'templates');
const tempDirs: string[] = [];
const it = itAllure.epic('Verification & Drift');

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
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

function createTemplateFixture(opts: {
  docText: string;
  fieldsYaml: string;
  requiredFields?: string[];
  replacements?: Record<string, string>;
  replacementsRaw?: string;
  writeTemplateDocx?: boolean;
}): string {
  const dir = mkdtempSync(join(tmpdir(), 'oa-template-validate-'));
  tempDirs.push(dir);
  const requiredFields = opts.requiredFields ?? [];
  const requiredFieldsLines =
    requiredFields.length === 0
      ? ['required_fields: []']
      : ['required_fields:', ...requiredFields.map((field) => `  - ${field}`)];
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
      ...requiredFieldsLines,
      '',
    ].join('\n'),
    'utf-8'
  );
  if (opts.writeTemplateDocx ?? true) {
    writeFileSync(join(dir, 'template.docx'), buildDocx(opts.docText));
  }
  if (opts.replacementsRaw !== undefined) {
    writeFileSync(join(dir, 'replacements.json'), opts.replacementsRaw, 'utf-8');
  } else if (opts.replacements) {
    writeFileSync(join(dir, 'replacements.json'), JSON.stringify(opts.replacements, null, 2), 'utf-8');
  }
  return dir;
}

function buildDocxWithoutDocumentXml(): Buffer {
  const zip = new AdmZip();
  zip.addFile('[Content_Types].xml', Buffer.from(CONTENT_TYPES_XML, 'utf-8'));
  zip.addFile('_rels/.rels', Buffer.from(RELS_XML, 'utf-8'));
  zip.addFile('word/_rels/document.xml.rels', Buffer.from(WORD_RELS_XML, 'utf-8'));
  return zip.toBuffer();
}

describe('validateTemplate', () => {
  it.openspec('OA-TMP-015')('validates bonterms-mutual-nda without errors', async () => {
    const dir = join(templatesDir, 'bonterms-mutual-nda');
    await allureParameter('template_id', 'bonterms-mutual-nda');
    const result = await allureStep('Validate template', () =>
      validateTemplate(dir, 'bonterms-mutual-nda')
    );
    await allureJsonAttachment('template-validation-result.json', result);

    await allureStep('Assert template passes validation', () => {
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });

  it.openspec('OA-TMP-015')('validates common-paper-mutual-nda without errors', async () => {
    const dir = join(templatesDir, 'common-paper-mutual-nda');
    await allureParameter('template_id', 'common-paper-mutual-nda');
    const result = await allureStep('Validate template', () =>
      validateTemplate(dir, 'common-paper-mutual-nda')
    );
    await allureJsonAttachment('template-validation-result.json', result);

    await allureStep('Assert template passes validation', () => {
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });

  it.openspec('OA-TMP-015')('validates openagreements-employment-offer-letter without errors', async () => {
    const dir = join(templatesDir, 'openagreements-employment-offer-letter');
    await allureParameter('template_id', 'openagreements-employment-offer-letter');
    const result = await allureStep('Validate template', () =>
      validateTemplate(dir, 'openagreements-employment-offer-letter')
    );
    await allureJsonAttachment('template-validation-result.json', result);

    await allureStep('Assert template passes validation', () => {
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });

  it.openspec('OA-TMP-015')('validates openagreements-employee-ip-inventions-assignment without errors', async () => {
    const dir = join(templatesDir, 'openagreements-employee-ip-inventions-assignment');
    await allureParameter('template_id', 'openagreements-employee-ip-inventions-assignment');
    const result = await allureStep('Validate template', () =>
      validateTemplate(dir, 'openagreements-employee-ip-inventions-assignment')
    );
    await allureJsonAttachment('template-validation-result.json', result);

    await allureStep('Assert template passes validation', () => {
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });

  it.openspec('OA-TMP-015')('validates openagreements-employment-confidentiality-acknowledgement without errors', async () => {
    const dir = join(templatesDir, 'openagreements-employment-confidentiality-acknowledgement');
    await allureParameter('template_id', 'openagreements-employment-confidentiality-acknowledgement');
    const result = await allureStep('Validate template', () =>
      validateTemplate(dir, 'openagreements-employment-confidentiality-acknowledgement')
    );
    await allureJsonAttachment('template-validation-result.json', result);

    await allureStep('Assert template passes validation', () => {
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });
});

describe('validateMetadata', () => {
  it.openspec('OA-TMP-015')('validates bonterms-mutual-nda metadata', async () => {
    const dir = join(templatesDir, 'bonterms-mutual-nda');
    await allureParameter('template_id', 'bonterms-mutual-nda');
    const result = await allureStep('Validate metadata.yaml', () => validateMetadata(dir));
    await allureJsonAttachment('metadata-validation-result.json', result);

    await allureStep('Assert metadata validation passes', () => {
      expect(result.valid).toBe(true);
    });
  });

  it.openspec('OA-TMP-015')('validates employment offer metadata', async () => {
    const dir = join(templatesDir, 'openagreements-employment-offer-letter');
    await allureParameter('template_id', 'openagreements-employment-offer-letter');
    const result = await allureStep('Validate metadata.yaml', () => validateMetadata(dir));
    await allureJsonAttachment('metadata-validation-result.json', result);

    await allureStep('Assert metadata validation passes', () => {
      expect(result.valid).toBe(true);
    });
  });
});

describe('validateTemplate placeholder coverage', () => {
  it.openspec('OA-TMP-001')('reports error for missing required placeholder', async () => {
    const dir = createTemplateFixture({
      docText: 'No placeholders here',
      fieldsYaml: '  - name: required_field\n    type: string\n    description: Required',
      requiredFields: ['required_field'],
    });
    await allureParameter('fixture_template_id', 'fixture-required-missing');
    await allureAttachment('fixture-doc-text.txt', 'No placeholders here');
    const result = await allureStep('Validate required placeholder coverage', () =>
      validateTemplate(dir, 'fixture-required-missing')
    );
    await allureJsonAttachment('required-placeholder-result.json', result);

    await allureStep('Assert required placeholder error is reported', () => {
      expect(result.valid).toBe(false);
      expect(result.errors.join(' ')).toContain('Required field \"required_field\"');
    });
  });

  it.openspec('OA-TMP-002')('reports warning for missing optional placeholder', async () => {
    const dir = createTemplateFixture({
      docText: 'No placeholders here either',
      fieldsYaml: '  - name: optional_field\n    type: string\n    description: Optional',
      requiredFields: [],
    });
    await allureParameter('fixture_template_id', 'fixture-optional-missing');
    await allureAttachment('fixture-doc-text.txt', 'No placeholders here either');
    const result = await allureStep('Validate optional placeholder coverage', () =>
      validateTemplate(dir, 'fixture-optional-missing')
    );
    await allureJsonAttachment('optional-placeholder-result.json', result);

    await allureStep('Assert optional placeholder warning is reported', () => {
      expect(result.valid).toBe(true);
      expect(result.warnings.join(' ')).toContain('Optional field \"optional_field\"');
    });
  });

  it.openspec('OA-TMP-016')('reports required-field errors for declarative replacements missing metadata tags', async () => {
    const dir = createTemplateFixture({
      docText: 'Order form has [Company Name] only',
      fieldsYaml: '  - name: required_field\n    type: string\n    description: Required field',
      requiredFields: ['required_field'],
      replacements: {
        '[Company Name]': '{other_field}',
      },
    });

    const result = validateTemplate(dir, 'fixture-required-missing-in-replacements');
    await allureJsonAttachment('required-missing-in-replacements-result.json', result);
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toContain('Required field \"required_field\" defined in metadata but not found');
  });

  it('returns an error when metadata cannot be loaded', () => {
    const dir = mkdtempSync(join(tmpdir(), 'oa-template-metadata-missing-'));
    tempDirs.push(dir);

    const result = validateTemplate(dir, 'fixture-missing-metadata');

    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toContain('Failed to load metadata');
  });

  it('returns an error when template.docx is absent', () => {
    const dir = createTemplateFixture({
      docText: 'Unused',
      fieldsYaml: '  - name: company_name\n    type: string\n    description: Company name',
      writeTemplateDocx: false,
    });

    const result = validateTemplate(dir, 'fixture-missing-docx');

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('template.docx not found in template directory');
  });

  it('returns an error when replacements.json cannot be parsed', () => {
    const dir = createTemplateFixture({
      docText: '[Company Name]',
      fieldsYaml: '  - name: company_name\n    type: string\n    description: Company name',
      replacementsRaw: '{invalid-json',
    });

    const result = validateTemplate(dir, 'fixture-invalid-replacements-json');

    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toContain('Failed to parse replacements.json');
  });

  it('validates declarative replacement keys and placeholder coverage', () => {
    const dir = createTemplateFixture({
      docText: '[Company Name] {doc_only} {IF doc_flag}{END-IF} {IF}',
      fieldsYaml: [
        '  - name: company_name',
        '    type: string',
        '    description: Company name',
        '  - name: unused_optional',
        '    type: string',
        '    description: Optional but unused',
      ].join('\n'),
      requiredFields: ['company_name'],
      replacements: {
        '[Missing Placeholder]': '{company_name}',
        '[Company Name]': '{company_name} {IF company_name}{END-IF}',
      },
    });

    const result = validateTemplate(dir, 'fixture-declarative-coverage');

    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toContain('Replacement key "[Missing Placeholder]" not found');
    expect(result.warnings.join(' ')).toContain('Optional field "unused_optional"');
    expect(result.warnings.join(' ')).toContain('Placeholder {doc_only} found in replacements/template');
  });

  it('accepts FOR loop placeholders in direct template scanning mode', () => {
    const dir = createTemplateFixture({
      docText: '{FOR row IN board_members}{$row.name}{END-FOR row}',
      fieldsYaml: '  - name: board_members\n    type: array\n    description: Board members',
    });

    const result = validateTemplate(dir, 'fixture-for-loop');

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('flags unsafe template control tags in template.docx', () => {
    const dir = createTemplateFixture({
      docText: '{#if hacked}Text{/if}',
      fieldsYaml: '  - name: company_name\n    type: string\n    description: Company name',
    });

    const result = validateTemplate(dir, 'fixture-unsafe-tags');

    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toContain('Unsafe template tag');
  });

  it('warns on unknown placeholders and ignores END control token warnings', () => {
    const dir = createTemplateFixture({
      docText: '{END} {unknown_field}',
      fieldsYaml: '  - name: known_field\n    type: string\n    description: Known field',
    });

    const result = validateTemplate(dir, 'fixture-unknown-placeholder');

    expect(result.valid).toBe(true);
    expect(result.warnings.join(' ')).toContain('Placeholder {unknown_field} found in template.docx');
    expect(result.warnings.join(' ')).not.toContain('Placeholder {END}');
  });

  it('handles DOCX files that do not contain word/document.xml', () => {
    const dir = mkdtempSync(join(tmpdir(), 'oa-template-missing-document-xml-'));
    tempDirs.push(dir);
    writeFileSync(
      join(dir, 'metadata.yaml'),
      [
        'name: Missing XML Fixture',
        'source_url: https://example.com/template.docx',
        'version: "1.0"',
        'license: CC-BY-4.0',
        'allow_derivatives: true',
        'attribution_text: Example attribution',
        'fields:',
        '  - name: optional_field',
        '    type: string',
        '    description: Optional field',
        'required_fields: []',
        '',
      ].join('\n'),
      'utf-8'
    );
    writeFileSync(join(dir, 'template.docx'), buildDocxWithoutDocumentXml());

    const result = validateTemplate(dir, 'fixture-no-document-xml');

    expect(result.valid).toBe(true);
    expect(result.warnings.join(' ')).toContain('Optional field "optional_field"');
  });
});
