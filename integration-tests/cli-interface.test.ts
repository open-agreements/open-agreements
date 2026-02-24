import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import AdmZip from 'adm-zip';
import { afterEach, describe, expect } from 'vitest';
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

const EMPLOYMENT_OFFER_REQUIRED_VALUES: Record<string, string> = {
  employer_name: 'Acme, Inc.',
  employee_name: 'Taylor Developer',
  position_title: 'Senior Software Engineer',
  employment_type: 'full-time',
  start_date: '2026-03-01',
  base_salary: '$220,000 annualized',
  work_location: 'Remote (United States)',
  governing_law: 'California',
  offer_expiration_date: '2026-02-28',
};

const EMPLOYEE_IP_REQUIRED_VALUES: Record<string, string> = {
  company_name: 'Acme, Inc.',
  employee_name: 'Taylor Developer',
  effective_date: '2026-03-01',
  confidential_information_definition: 'all non-public technical and business information',
  return_of_materials_timing: 'within 5 business days of termination',
  governing_law: 'California',
  venue: 'state and federal courts in San Francisco County, California',
};

const CONFIDENTIALITY_ACK_REQUIRED_VALUES: Record<string, string> = {
  company_name: 'Acme, Inc.',
  employee_name: 'Taylor Developer',
  policy_effective_date: '2026-03-01',
  approved_tools_scope: 'company-managed systems and approved productivity tooling',
  data_access_scope: 'least-privilege access for assigned job duties',
  security_reporting_contact: 'security@acme.example',
  acknowledgement_date: '2026-03-01',
  signatory_name: 'Taylor Developer',
};

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
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

function readJsonFile(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf-8'));
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

  it.openspec('OA-155')('fill command renders output DOCX for employment offer template', () => {
    const outDir = mkdtempSync(join(tmpdir(), 'oa-cli-employment-fill-'));
    tempDirs.push(outDir);
    const outputPath = join(outDir, 'employment-offer.docx');

    const args = [
      'fill',
      'openagreements-employment-offer-letter',
      '-o',
      outputPath,
      ...Object.entries(EMPLOYMENT_OFFER_REQUIRED_VALUES).flatMap(([key, value]) => ['--set', `${key}=${value}`]),
    ];

    runCli(args);
    expect(existsSync(outputPath)).toBe(true);
  });

  it.openspec('OA-155')('fill command renders output DOCX for employee IP template', () => {
    const outDir = mkdtempSync(join(tmpdir(), 'oa-cli-employment-ip-fill-'));
    tempDirs.push(outDir);
    const outputPath = join(outDir, 'employment-ip.docx');

    const args = [
      'fill',
      'openagreements-employee-ip-inventions-assignment',
      '-o',
      outputPath,
      ...Object.entries(EMPLOYEE_IP_REQUIRED_VALUES).flatMap(([key, value]) => ['--set', `${key}=${value}`]),
    ];

    runCli(args);
    expect(existsSync(outputPath)).toBe(true);
  });

  it.openspec('OA-155')('fill command renders output DOCX for confidentiality acknowledgement template', () => {
    const outDir = mkdtempSync(join(tmpdir(), 'oa-cli-employment-ack-fill-'));
    tempDirs.push(outDir);
    const outputPath = join(outDir, 'employment-confidentiality-ack.docx');

    const args = [
      'fill',
      'openagreements-employment-confidentiality-acknowledgement',
      '-o',
      outputPath,
      ...Object.entries(CONFIDENTIALITY_ACK_REQUIRED_VALUES).flatMap(([key, value]) => ['--set', `${key}=${value}`]),
    ];

    runCli(args);
    expect(existsSync(outputPath)).toBe(true);
  });

  it.openspec('OA-156')('fill command can emit employment memo JSON with disclaimer and jurisdiction warning when rule matches', () => {
    const outDir = mkdtempSync(join(tmpdir(), 'oa-cli-employment-memo-json-'));
    tempDirs.push(outDir);

    const outputPath = join(outDir, 'employment-ip.docx');
    const memoJsonPath = join(outDir, 'employment-ip.memo.json');

    const args = [
      'fill',
      'openagreements-employee-ip-inventions-assignment',
      '-o',
      outputPath,
      '--memo',
      'json',
      '--memo-json',
      memoJsonPath,
      '--memo-jurisdiction',
      'California',
      ...Object.entries(EMPLOYEE_IP_REQUIRED_VALUES).flatMap(([key, value]) => ['--set', `${key}=${value}`]),
    ];

    runCli(args);

    expect(existsSync(outputPath)).toBe(true);
    expect(existsSync(memoJsonPath)).toBe(true);

    const memo = readJsonFile(memoJsonPath) as {
      disclaimer: string;
      findings: Array<{ category: string; summary: string }>;
    };

    expect(memo.disclaimer).toContain('not legal advice');
    expect(memo.findings.some((finding) => finding.category === 'jurisdiction_warning')).toBe(true);

    const memoText = JSON.stringify(memo).toLowerCase();
    expect(memoText).not.toContain('we recommend');
    expect(memoText).not.toContain('you should');
    expect(memoText).not.toContain('best strategy');
  });

  it.openspec('OA-156')('fill command does not fabricate jurisdiction warnings when no rule matches', () => {
    const outDir = mkdtempSync(join(tmpdir(), 'oa-cli-employment-memo-no-match-'));
    tempDirs.push(outDir);

    const outputPath = join(outDir, 'employment-offer.docx');
    const memoJsonPath = join(outDir, 'employment-offer.memo.json');

    const args = [
      'fill',
      'openagreements-employment-offer-letter',
      '-o',
      outputPath,
      '--memo',
      'json',
      '--memo-json',
      memoJsonPath,
      '--memo-jurisdiction',
      'Texas',
      ...Object.entries({
        ...EMPLOYMENT_OFFER_REQUIRED_VALUES,
        governing_law: 'Texas',
      }).flatMap(([key, value]) => ['--set', `${key}=${value}`]),
    ];

    runCli(args);

    expect(existsSync(outputPath)).toBe(true);
    expect(existsSync(memoJsonPath)).toBe(true);

    const memo = readJsonFile(memoJsonPath) as {
      disclaimer: string;
      findings: Array<{ category: string }>;
    };

    expect(memo.disclaimer).toContain('not legal advice');
    expect(memo.findings.some((finding) => finding.category === 'jurisdiction_warning')).toBe(false);
  });

  it.openspec('OA-156')('fill command can emit employment memo Markdown with disclaimer', () => {
    const outDir = mkdtempSync(join(tmpdir(), 'oa-cli-employment-memo-md-'));
    tempDirs.push(outDir);

    const outputPath = join(outDir, 'employment-ack.docx');
    const memoMarkdownPath = join(outDir, 'employment-ack.memo.md');

    const args = [
      'fill',
      'openagreements-employment-confidentiality-acknowledgement',
      '-o',
      outputPath,
      '--memo',
      'markdown',
      '--memo-md',
      memoMarkdownPath,
      ...Object.entries(CONFIDENTIALITY_ACK_REQUIRED_VALUES).flatMap(([key, value]) => ['--set', `${key}=${value}`]),
    ];

    runCli(args);

    expect(existsSync(outputPath)).toBe(true);
    expect(existsSync(memoMarkdownPath)).toBe(true);

    const markdown = readFileSync(memoMarkdownPath, 'utf-8').toLowerCase();
    expect(markdown).toContain('## disclaimer');
    expect(markdown).toContain('not legal advice');
    expect(markdown).not.toContain('we recommend');
    expect(markdown).not.toContain('you should');
    expect(markdown).not.toContain('best strategy');
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
