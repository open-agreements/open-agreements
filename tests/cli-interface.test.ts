import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import AdmZip from 'adm-zip';
import { afterEach, beforeAll, describe, expect } from 'vitest';
import { itAllure } from './helpers/allure-test.js';

const ROOT = new URL('..', import.meta.url).pathname;
const BIN = join(ROOT, 'bin/open-agreements.js');
const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const it = itAllure.epic('Platform & Distribution');

const tempDirs: string[] = [];

const COMMON_PAPER_REQUIRED_VALUES: Record<string, string> = {
  purpose: 'Evaluate partnership',
  effective_date: '2026-02-10',
  mnda_term: '1 year(s)',
  confidentiality_term: '1 year(s)',
  confidentiality_term_start: 'Effective Date',
  governing_law: 'Delaware',
  jurisdiction: 'courts located in New Castle County, Delaware',
  changes_to_standard_terms: 'None.',
};

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

beforeAll(() => {
  execFileSync('npm', ['run', 'build'], {
    cwd: ROOT,
    encoding: 'utf-8',
    timeout: 60_000,
  });
});

function runCli(args: string[], env?: NodeJS.ProcessEnv): string {
  return execFileSync('node', [BIN, ...args], {
    cwd: ROOT,
    encoding: 'utf-8',
    env: {
      ...process.env,
      ...env,
    },
  });
}

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

describe('CLI interface behavior', () => {
  it.openspec(['OA-034', 'OA-046'])('fill command renders output DOCX from template values', () => {
    const outDir = mkdtempSync(join(tmpdir(), 'oa-cli-fill-'));
    tempDirs.push(outDir);
    const outputPath = join(outDir, 'mutual-nda.docx');

    const args = [
      'fill',
      'common-paper-mutual-nda',
      '-o',
      outputPath,
      ...Object.entries(COMMON_PAPER_REQUIRED_VALUES).flatMap(([key, value]) => ['--set', `${key}=${value}`]),
    ];

    runCli(args);
    expect(existsSync(outputPath)).toBe(true);
  });

  it.openspec('OA-035')('fill command reports missing required fields', () => {
    const outDir = mkdtempSync(join(tmpdir(), 'oa-cli-missing-'));
    tempDirs.push(outDir);
    const outputPath = join(outDir, 'missing-fields.docx');

    expect(() => runCli(['fill', 'common-paper-mutual-nda', '-o', outputPath, '--set', 'purpose=Only purpose'])).toThrow(
      /Missing required fields/
    );
  });

  it.openspec('OA-041')('fill command blocks templates marked allow_derivatives=false', () => {
    const root = mkdtempSync(join(tmpdir(), 'oa-cli-license-'));
    tempDirs.push(root);
    const templateDir = join(root, 'templates', 'restricted-template');
    mkdirSync(templateDir, { recursive: true });

    writeFileSync(
      join(templateDir, 'metadata.yaml'),
      [
        'name: Restricted Template',
        'description: Internal template',
        'source_url: https://example.com/restricted.docx',
        'version: "1.0"',
        'license: CC-BY-ND-4.0',
        'allow_derivatives: false',
        'attribution_text: Example attribution',
        'fields:',
        '  - name: party_name',
        '    type: string',
        '    description: Party',
        'required_fields:',
        '  - party_name',
        '',
      ].join('\n'),
      'utf-8'
    );
    writeFileSync(join(templateDir, 'template.docx'), buildMinimalDocx('Hello {party_name}'));

    const outputPath = join(root, 'out.docx');

    expect(() =>
      runCli(
        ['fill', 'restricted-template', '-o', outputPath, '--set', 'party_name=Acme Corp'],
        { OPEN_AGREEMENTS_CONTENT_ROOTS: root }
      )
    ).toThrow(/allow_derivatives=false/);
  });

  it.openspec('OA-047')('list command shows templates in human-readable output', () => {
    const output = runCli(['list']);
    expect(output).toContain('common-paper-mutual-nda');
    expect(output).toContain('License');
  });
});
