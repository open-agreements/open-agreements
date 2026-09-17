import { execFileSync } from 'node:child_process';
import { afterEach, describe, expect } from 'vitest';
import { itAllure } from './helpers/allure-test.js';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import AdmZip from 'adm-zip';
import { seconds } from './helpers/timeouts.js';
import {
  acquirePackageArtifactLock,
  type PackageArtifactLock,
} from './helpers/package-artifact-lock.js';

const it = itAllure.epic('Platform & Distribution').withLabels({ feature: 'Declarative contracts' });

const ROOT = new URL('..', import.meta.url).pathname;
const BIN = join(ROOT, 'bin/open-agreements.js');
const tempDirs: string[] = [];

const PRIVACY_VALUES = {
  business_legal_name: 'Declarative Fixtures, Inc.',
  business_contact_email: 'privacy@declarative-fixtures.example',
  business_postal_address: '1 Canonical Way, Austin, Texas 78701',
  privacy_request_url: 'https://declarative-fixtures.example/privacy-request',
  appeal_request_url: 'https://declarative-fixtures.example/privacy-appeal',
  policy_effective_date: 'March 11, 2026',
  policy_last_updated: 'March 11, 2026',
  personal_data_categories: 'account details and service-usage data',
  sensitive_data_categories: 'precise geolocation',
  processing_purposes: 'provide the service',
  third_party_categories: 'cloud hosting providers',
  data_sources: 'directly from consumers',
};

function docxText(path: string): string {
  const zip = new AdmZip(readFileSync(path));
  return zip
    .getEntries()
    .filter((entry) => /^word\/(document|header\d+|footer\d+)\.xml$/.test(entry.entryName))
    .map((entry) => entry.getData().toString('utf8'))
    .join(' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(?:x[\dA-Fa-f]+|\d+);/g, ' ')
    .replace(/\s+/g, ' ');
}

function writeValues(dir: string, values: Record<string, unknown>): string {
  const path = join(dir, 'values.json');
  writeFileSync(path, `${JSON.stringify(values, null, 2)}\n`);
  return path;
}

function runCli(bin: string, cwd: string, args: string[]): string {
  return execFileSync('node', [bin, ...args], {
    cwd,
    encoding: 'utf8',
    timeout: seconds(45),
    maxBuffer: 16 * 1024 * 1024,
  });
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('declarative CLI rendering', () => {
  it('honors source-only privacy gates and rejects a non-canonical template', () => {
    const dir = mkdtempSync(join(tmpdir(), 'oa-declarative-cli-'));
    tempDirs.push(dir);
    const valuesPath = writeValues(dir, {
      ...PRIVACY_VALUES,
      // These facts are intentionally canonical-source-only, rather than public
      // metadata fields. The --declarative path must accept and compute them.
      covered_by_comprehensive_privacy_act: false,
      covered_by_limited_scope_notice_regime: false,
      honors_universal_opt_out_signal: false,
      processes_sensitive_data: true,
      sells_personal_data: true,
      processes_for_targeted_advertising: true,
      processes_for_profiling: true,
      has_minor_users: true,
      sells_sensitive_personal_data: true,
      collects_biometric_identifiers: false,
      collects_consumer_health_data: false,
      is_website_operator: false,
      has_known_child_users: false,
      is_data_broker: false,
    });
    const output = join(dir, 'privacy.docx');

    runCli(BIN, ROOT, [
      'fill',
      'openagreements-privacy-policy',
      '--declarative',
      '--data',
      valuesPath,
      '--output',
      output,
    ]);

    expect(existsSync(output)).toBe(true);
    const text = docxText(output);
    expect(text).toContain('Declarative Fixtures, Inc.');
    expect(text).toContain('Minors');
    expect(text).toContain('NOTICE: We may sell your sensitive personal data.');
    expect(text).not.toContain('Sale of Data and Targeted Advertising');
    expect(text).not.toContain('Universal Opt-Out Signals');
    expect(text).not.toContain('Sensitive Data Consent');

    const unsupportedOutput = join(dir, 'unsupported.docx');
    expect(() => runCli(BIN, ROOT, [
      'fill',
      'common-paper-mutual-nda',
      '--declarative',
      '--output',
      unsupportedOutput,
    ])).toThrow();
    expect(existsSync(unsupportedOutput)).toBe(false);
  }, seconds(75));

  it('preserves each board member\'s independent signing date', () => {
    const dir = mkdtempSync(join(tmpdir(), 'oa-declarative-board-'));
    tempDirs.push(dir);
    const valuesPath = writeValues(dir, {
      company_name: 'Independent Dates, Inc.',
      effective_date: '2026-03-01',
      purchase_amount: '750,000',
      board_members: [
        { name: 'Avery Director', signing_date: '2026-03-02' },
        { name: 'Blake Director', signing_date: '2026-03-19' },
      ],
    });
    const output = join(dir, 'board-consent.docx');

    runCli(BIN, ROOT, [
      'fill',
      'openagreements-board-consent-safe',
      '--declarative',
      '--data',
      valuesPath,
      '--output',
      output,
    ]);

    const text = docxText(output);
    expect(text).toContain('Independent Dates, Inc.');
    expect(text).toContain('Avery Director');
    expect(text).toContain('Blake Director');
    expect(text).toContain('March 2, 2026');
    expect(text).toContain('March 19, 2026');
  }, seconds(75));

  it('runs declarative privacy rendering from an installed packed package without source or lockfile', async () => {
    const packageArtifactLock: PackageArtifactLock = await acquirePackageArtifactLock(ROOT);
    const sandbox = mkdtempSync(join(tmpdir(), 'oa-declarative-package-'));
    let tarball = '';
    try {
      tarball = execFileSync('npm', ['pack', '--ignore-scripts', '--silent'], {
        cwd: ROOT,
        encoding: 'utf8',
        timeout: seconds(60),
      }).trim().split('\n').at(-1) ?? '';
      expect(tarball).not.toBe('');

      execFileSync('npm', ['init', '-y'], { cwd: sandbox, encoding: 'utf8', timeout: seconds(15) });
      execFileSync('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', join(ROOT, tarball)], {
        cwd: sandbox,
        encoding: 'utf8',
        timeout: seconds(120),
      });

      const installed = join(sandbox, 'node_modules', 'open-agreements');
      expect(existsSync(join(installed, 'src'))).toBe(false);
      expect(existsSync(join(installed, 'package-lock.json'))).toBe(false);
      expect(existsSync(join(installed, 'dist', 'core', 'original-contract.js'))).toBe(true);

      const valuesPath = writeValues(sandbox, {
        ...PRIVACY_VALUES,
        covered_by_comprehensive_privacy_act: true,
        covered_by_limited_scope_notice_regime: false,
        honors_universal_opt_out_signal: true,
        processes_sensitive_data: true,
        sells_personal_data: true,
        processes_for_targeted_advertising: false,
        processes_for_profiling: false,
        has_minor_users: false,
        sells_sensitive_personal_data: false,
        collects_biometric_identifiers: false,
        collects_consumer_health_data: false,
        is_website_operator: false,
        has_known_child_users: false,
        is_data_broker: false,
      });
      const output = join(sandbox, 'installed-privacy.docx');
      runCli(join(installed, 'bin', 'open-agreements.js'), sandbox, [
        'fill',
        'openagreements-privacy-policy',
        '--declarative',
        '--data',
        valuesPath,
        '--output',
        output,
      ]);

      const text = docxText(output);
      expect(text).toContain('Declarative Fixtures, Inc.');
      expect(text).toContain('Sale of Data and Targeted Advertising');
      expect(text).toContain('Universal Opt-Out Signals');
      expect(text).toContain('We obtain your opt-in consent before collecting or processing');
    } finally {
      if (tarball) rmSync(join(ROOT, tarball), { force: true });
      rmSync(sandbox, { recursive: true, force: true });
      packageArtifactLock.release();
    }
  }, seconds(210));
});
