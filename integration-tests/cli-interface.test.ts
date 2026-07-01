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

// The employee-IP template was renamed to the Confidentiality & Invention
// Assignment Agreement (CIIAA, #1249). Its field set changed: no
// `confidential_information_definition`; instead explicit prior-inventions and
// company-signatory fields. `prior_inventions_disclosure: 'None'` with
// California governing law also trips the CA inventions-carveout jurisdiction
// rule (memo test below).
const EMPLOYEE_IP_REQUIRED_VALUES: Record<string, string> = {
  company_name: 'Acme, Inc.',
  company_signatory_name: 'Jordan Founder',
  company_signatory_title: 'Chief Executive Officer',
  employee_name: 'Taylor Developer',
  effective_date: '2026-03-01',
  prior_inventions_disclosure: 'None',
  return_of_materials_timing: 'within 5 business days of termination',
  governing_law: 'California',
  venue: 'state and federal courts in San Francisco County, California',
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
  it('fill command renders output DOCX from template values', () => {
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

  it('fill command renders output DOCX for employment offer template', () => {
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

  it('fill command renders output DOCX for CIIAA template', () => {
    const outDir = mkdtempSync(join(tmpdir(), 'oa-cli-employment-ip-fill-'));
    tempDirs.push(outDir);
    const outputPath = join(outDir, 'employment-ip.docx');

    const args = [
      'fill',
      'openagreements-confidentiality-invention-assignment-agreement',
      '-o',
      outputPath,
      ...Object.entries(EMPLOYEE_IP_REQUIRED_VALUES).flatMap(([key, value]) => ['--set', `${key}=${value}`]),
    ];

    runCli(args);
    expect(existsSync(outputPath)).toBe(true);
  });

  it('fill command can emit employment memo JSON with disclaimer and jurisdiction warning when rule matches', () => {
    const outDir = mkdtempSync(join(tmpdir(), 'oa-cli-employment-memo-json-'));
    tempDirs.push(outDir);

    const outputPath = join(outDir, 'employment-ip.docx');
    const memoJsonPath = join(outDir, 'employment-ip.memo.json');

    const args = [
      'fill',
      'openagreements-confidentiality-invention-assignment-agreement',
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

  it('fill command does not fabricate jurisdiction warnings when no rule matches', () => {
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

  it('fill command can emit employment memo Markdown with disclaimer', () => {
    const outDir = mkdtempSync(join(tmpdir(), 'oa-cli-employment-memo-md-'));
    tempDirs.push(outDir);

    const outputPath = join(outDir, 'employment-ciiaa.docx');
    const memoMarkdownPath = join(outDir, 'employment-ciiaa.memo.md');

    const args = [
      'fill',
      'openagreements-confidentiality-invention-assignment-agreement',
      '-o',
      outputPath,
      '--memo',
      'markdown',
      '--memo-md',
      memoMarkdownPath,
      ...Object.entries(EMPLOYEE_IP_REQUIRED_VALUES).flatMap(([key, value]) => ['--set', `${key}=${value}`]),
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

  it('fill command warns about missing priority fields but continues', () => {
    const outDir = mkdtempSync(join(tmpdir(), 'oa-cli-missing-'));
    tempDirs.push(outDir);
    const outputPath = join(outDir, 'missing-fields.docx');

    // Fill now proceeds with a warning instead of throwing
    runCli(['fill', 'common-paper-mutual-nda', '-o', outputPath, '--set', 'purpose=Only purpose']);

    expect(existsSync(outputPath)).toBe(true);
  });

  it('fill command rejects a no-derivatives form lacking external source provenance', () => {
    // Since #1249 a slug's kind is DERIVED from metadata: allow_derivatives=false
    // classifies it as an `external` (no-derivatives) template, so it is filled
    // through the external pipeline rather than the derivable-template path. That
    // pipeline requires source provenance (`source_sha256`); a no-derivatives
    // form without it is rejected — no-derivatives content cannot be casually
    // filled/derived as if it were a first-party template.
    const root = mkdtempSync(join(tmpdir(), 'oa-cli-license-'));
    tempDirs.push(root);
    const templateDir = join(root, 'templates', 'restricted-cc-by-nd-4.0', 'restricted-template');
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
        'priority_fields:',
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
    ).toThrow(/source_sha256/);
  });

  it('list command shows templates in human-readable output', () => {
    const output = runCli(['list']);
    expect(output).toContain('common-paper-mutual-nda');
    expect(output).toContain('License');
  });
});
