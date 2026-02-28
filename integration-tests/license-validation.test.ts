import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect } from 'vitest';
import { validateLicense } from '../src/core/validation/license.js';
import { itAllure } from './helpers/allure-test.js';

const it = itAllure.epic('Compliance & Governance');
const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function createMetadataDir(license: string, attributionText: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'oa-license-validate-'));
  tempDirs.push(dir);
  writeFileSync(
    join(dir, 'metadata.yaml'),
    [
      'name: License Fixture',
      'source_url: https://example.com/template.docx',
      'version: "1.0"',
      `license: ${license}`,
      'allow_derivatives: true',
      `attribution_text: "${attributionText}"`,
      'fields:',
      '  - name: company_name',
      '    type: string',
      '    description: Company',
      'required_fields: []',
      '',
    ].join('\n'),
    'utf-8'
  );
  return dir;
}

describe('validateLicense', () => {
  it('returns metadata-load failures as validation errors', () => {
    const missingDir = mkdtempSync(join(tmpdir(), 'oa-license-missing-'));
    tempDirs.push(missingDir);

    const result = validateLicense(missingDir, 'missing-template');

    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('Failed to load metadata');
  });

  it.openspec('OA-DST-003')('requires attribution text for CC-BY family licenses', () => {
    const dir = createMetadataDir('CC-BY-ND-4.0', '   ');

    const result = validateLicense(dir, 'fixture-template');

    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toContain('requires attribution_text to be non-empty');
  });

  it('accepts non-attribution licenses without additional errors', () => {
    const dir = createMetadataDir('CC0-1.0', '');

    const result = validateLicense(dir, 'fixture-template');

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });
});
