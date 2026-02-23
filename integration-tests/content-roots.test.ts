import AdmZip from 'adm-zip';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect } from 'vitest';
import { itAllure } from './helpers/allure-test.js';
import { findTemplateDir, listTemplateEntries } from '../src/utils/paths.js';
import { runFill } from '../src/commands/fill.js';
import { runValidate } from '../src/commands/validate.js';

const ENV_KEY = 'OPEN_AGREEMENTS_CONTENT_ROOTS';
const originalEnv = process.env[ENV_KEY];
const tempDirs: string[] = [];
const it = itAllure.epic('Platform & Distribution');
const ROOT = new URL('..', import.meta.url).pathname;
const BIN = join(ROOT, 'bin/open-agreements.js');
const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }

  if (originalEnv === undefined) {
    delete process.env[ENV_KEY];
  } else {
    process.env[ENV_KEY] = originalEnv;
  }
});

function buildMinimalDocx(documentText: string): Buffer {
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

  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    `<w:document xmlns:w="${W_NS}"><w:body><w:p><w:r><w:t>${documentText}</w:t></w:r></w:p></w:body></w:document>`;

  const zip = new AdmZip();
  zip.addFile('[Content_Types].xml', Buffer.from(contentTypes, 'utf-8'));
  zip.addFile('_rels/.rels', Buffer.from(rels, 'utf-8'));
  zip.addFile('word/_rels/document.xml.rels', Buffer.from(wordRels, 'utf-8'));
  zip.addFile('word/document.xml', Buffer.from(xml, 'utf-8'));
  return zip.toBuffer();
}

function writeOverrideTemplate(root: string, templateId = 'override-only-template'): string {
  const templateDir = join(root, 'templates', templateId);
  mkdirSync(templateDir, { recursive: true });
  writeFileSync(
    join(templateDir, 'metadata.yaml'),
    [
      `name: ${templateId}`,
      'description: Override template',
      'source_url: https://example.com/override-template.docx',
      'version: "1.0"',
      'license: CC-BY-4.0',
      'allow_derivatives: true',
      'attribution_text: Example attribution',
      'fields:',
      '  - name: company_name',
      '    type: string',
      '    description: Company name',
      'required_fields:',
      '  - company_name',
      '',
    ].join('\n'),
    'utf-8',
  );
  writeFileSync(join(templateDir, 'template.docx'), buildMinimalDocx('Hello {company_name}'));
  return templateDir;
}

describe('content root overrides', () => {
  it.openspec('OA-067')('uses bundled content roots when no override env var is set', () => {
    delete process.env[ENV_KEY];
    const bundled = findTemplateDir('common-paper-mutual-nda');
    expect(bundled).toBeTruthy();
    expect(bundled).toContain('templates/common-paper-mutual-nda');
  });

  it.openspec('OA-068')('discovers additional templates from OPEN_AGREEMENTS_CONTENT_ROOTS', () => {
    const root = mkdtempSync(join(tmpdir(), 'oa-content-roots-'));
    tempDirs.push(root);

    const customTemplateDir = writeOverrideTemplate(root, 'custom-template');

    process.env[ENV_KEY] = root;

    expect(findTemplateDir('custom-template')).toBe(customTemplateDir);
    const entries = listTemplateEntries();
    expect(entries.some((entry) => entry.id === 'custom-template')).toBe(true);
    expect(entries.some((entry) => entry.id === 'common-paper-mutual-nda')).toBe(true);
  });

  it.openspec('OA-069')('deduplicates IDs by precedence with env roots first', () => {
    const root = mkdtempSync(join(tmpdir(), 'oa-content-roots-priority-'));
    tempDirs.push(root);

    const overriddenId = 'common-paper-mutual-nda';
    const overrideDir = join(root, 'templates', overriddenId);
    mkdirSync(overrideDir, { recursive: true });

    process.env[ENV_KEY] = root;

    const entries = listTemplateEntries();
    const match = entries.find((entry) => entry.id === overriddenId);

    expect(match).toBeDefined();
    expect(match!.dir).toBe(overrideDir);
  });

  it.openspec('OA-070')('fills an agreement that exists only in an override root', async () => {
    const root = mkdtempSync(join(tmpdir(), 'oa-content-roots-fill-'));
    tempDirs.push(root);
    writeOverrideTemplate(root, 'override-fill-template');
    process.env[ENV_KEY] = root;

    const outputPath = join(root, 'override-filled.docx');
    await runFill({
      template: 'override-fill-template',
      output: outputPath,
      values: { company_name: 'Acme Corp' },
    });

    expect(existsSync(outputPath)).toBe(true);
  });

  it.openspec('OA-071')('list --json includes override-only template entries', () => {
    const root = mkdtempSync(join(tmpdir(), 'oa-content-roots-list-'));
    tempDirs.push(root);
    writeOverrideTemplate(root, 'override-list-template');

    const output = execFileSync('node', [BIN, 'list', '--json'], {
      cwd: ROOT,
      encoding: 'utf-8',
      env: {
        ...process.env,
        [ENV_KEY]: root,
      },
    });
    const parsed = JSON.parse(output) as {
      items: Array<{ name: string }>;
    };
    expect(parsed.items.some((item) => item.name === 'override-list-template')).toBe(true);
  });

  it.openspec('OA-072')('validate single ID resolves from configured override roots', () => {
    const root = mkdtempSync(join(tmpdir(), 'oa-content-roots-validate-'));
    tempDirs.push(root);
    writeOverrideTemplate(root, 'override-validate-template');
    process.env[ENV_KEY] = root;

    expect(() => runValidate({ template: 'override-validate-template' })).not.toThrow();
  });
});
