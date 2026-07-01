import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect } from 'vitest';
import { itAllure } from './helpers/allure-test.js';
import { validateFieldSelector } from '../src/core/validation/field-selector.js';

const tempDirs: string[] = [];
const it = itAllure.epic('Compliance & Governance');

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function writeMetadata(fieldSelectorDir: string): void {
  writeFileSync(
    join(fieldSelectorDir, 'metadata.yaml'),
    [
      'name: Fixture FieldSelector',
      'source_url: https://example.com/source.docx',
      'source_version: "1.0"',
      'license_note: Fixture license note',
      'fields:',
      '  - name: company_name',
      '    type: string',
      '    description: Company',
      'priority_fields:',
      '  - company_name',
      '',
    ].join('\n'),
    'utf-8'
  );
}

describe('validateFieldSelector negative scenarios', () => {
  it('fails when metadata.yaml is invalid', () => {
    const fieldSelectorDir = mkdtempSync(join(tmpdir(), 'oa-field-selector-invalid-metadata-'));
    tempDirs.push(fieldSelectorDir);
    writeFileSync(join(fieldSelectorDir, 'metadata.yaml'), 'name: Broken FieldSelector', 'utf-8');

    const result = validateFieldSelector(fieldSelectorDir, 'fixture-fieldSelector');

    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toContain('metadata:');
  });

  it('treats metadata-only fieldSelectors as strict-mode errors', () => {
    const fieldSelectorDir = mkdtempSync(join(tmpdir(), 'oa-field-selector-strict-scaffold-'));
    tempDirs.push(fieldSelectorDir);
    writeMetadata(fieldSelectorDir);

    const result = validateFieldSelector(fieldSelectorDir, 'fixture-fieldSelector', { strict: true });

    expect(result.valid).toBe(false);
    expect(result.scaffold).toBe(true);
    expect(result.errors.join(' ')).toContain('Scaffold fieldSelector (metadata-only): not runnable');
  });

  it('rejects committed DOCX files in fieldSelector directories', () => {
    const fieldSelectorDir = mkdtempSync(join(tmpdir(), 'oa-field-selector-docx-'));
    tempDirs.push(fieldSelectorDir);

    writeMetadata(fieldSelectorDir);
    writeFileSync(join(fieldSelectorDir, 'template.docx'), Buffer.from('fake-docx'));

    const result = validateFieldSelector(fieldSelectorDir, 'fixture-fieldSelector');
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toContain('Copyrighted .docx file(s) found');
  });

  it('warns when replacement targets are not in metadata fields', () => {
    const fieldSelectorDir = mkdtempSync(join(tmpdir(), 'oa-field-selector-schema-'));
    tempDirs.push(fieldSelectorDir);

    writeMetadata(fieldSelectorDir);
    writeFileSync(
      join(fieldSelectorDir, 'replacements.json'),
      JSON.stringify({ '[Company Name]': '{company_name_missing}' }, null, 2),
      'utf-8'
    );

    const result = validateFieldSelector(fieldSelectorDir, 'fixture-fieldSelector');
    expect(result.valid).toBe(true);
    expect(result.warnings.join(' ')).toContain('Replacement target {company_name_missing} not found in metadata fields');
  });

  it('rejects unsafe non-identifier replacement tags', () => {
    const fieldSelectorDir = mkdtempSync(join(tmpdir(), 'oa-field-selector-unsafe-tag-'));
    tempDirs.push(fieldSelectorDir);

    writeMetadata(fieldSelectorDir);
    writeFileSync(
      join(fieldSelectorDir, 'replacements.json'),
      JSON.stringify({ '[Company Name]': '{#if hacked}' }, null, 2),
      'utf-8'
    );

    const result = validateFieldSelector(fieldSelectorDir, 'fixture-fieldSelector');
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toContain('unsafe tag');
  });

  it('rejects replacements.json when it is not a JSON object', () => {
    const fieldSelectorDir = mkdtempSync(join(tmpdir(), 'oa-field-selector-replacements-object-'));
    tempDirs.push(fieldSelectorDir);

    writeMetadata(fieldSelectorDir);
    writeFileSync(join(fieldSelectorDir, 'replacements.json'), '1', 'utf-8');

    const result = validateFieldSelector(fieldSelectorDir, 'fixture-fieldSelector');

    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toContain('replacements.json must be a JSON object');
  });

  it('rejects replacement value shape and infinite loop patterns', () => {
    const fieldSelectorDir = mkdtempSync(join(tmpdir(), 'oa-field-selector-replacement-shape-'));
    tempDirs.push(fieldSelectorDir);

    writeMetadata(fieldSelectorDir);
    writeFileSync(
      join(fieldSelectorDir, 'replacements.json'),
      JSON.stringify(
        {
          '[Not String]': 123,
          '[No Tags]': 'literal value',
          '[Loop]': '[Loop] {company_name}',
          'Label > [Company Name]': '{company_name} [Company Name]',
        },
        null,
        2
      ),
      'utf-8'
    );

    const result = validateFieldSelector(fieldSelectorDir, 'fixture-fieldSelector');

    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toContain('value for "[Not String]" must be a string');
    expect(result.errors.join(' ')).toContain('must contain at least one {identifier} tag');
    expect(result.errors.join(' ')).toContain('contains the key itself');
    expect(result.errors.join(' ')).toContain('contains the search text');
  });

  it('rejects replacements.json parse failures', () => {
    const fieldSelectorDir = mkdtempSync(join(tmpdir(), 'oa-field-selector-replacements-parse-'));
    tempDirs.push(fieldSelectorDir);

    writeMetadata(fieldSelectorDir);
    writeFileSync(join(fieldSelectorDir, 'replacements.json'), '{invalid json', 'utf-8');

    const result = validateFieldSelector(fieldSelectorDir, 'fixture-fieldSelector');

    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toContain('replacements.json:');
  });

  it('rejects computed profiles with unsupported predicate operators', () => {
    const fieldSelectorDir = mkdtempSync(join(tmpdir(), 'oa-field-selector-computed-op-'));
    tempDirs.push(fieldSelectorDir);

    writeMetadata(fieldSelectorDir);
    writeFileSync(
      join(fieldSelectorDir, 'replacements.json'),
      JSON.stringify({ '[Company Name]': '{company_name}' }, null, 2),
      'utf-8'
    );
    writeFileSync(
      join(fieldSelectorDir, 'computed.json'),
      JSON.stringify(
        {
          version: '1.0',
          rules: [
            {
              id: 'bad-op',
              when_all: [{ field: 'company_name', op: 'greater_than', value: 'A' }],
              set_audit: { invalid: true },
            },
          ],
        },
        null,
        2
      ),
      'utf-8'
    );

    const result = validateFieldSelector(fieldSelectorDir, 'fixture-fieldSelector');
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toContain('computed.json');
  });

  it('rejects invalid normalize.json configuration', () => {
    const fieldSelectorDir = mkdtempSync(join(tmpdir(), 'oa-field-selector-normalize-'));
    tempDirs.push(fieldSelectorDir);

    writeMetadata(fieldSelectorDir);
    writeFileSync(
      join(fieldSelectorDir, 'replacements.json'),
      JSON.stringify({ '[Company Name]': '{company_name}' }, null, 2),
      'utf-8'
    );
    writeFileSync(
      join(fieldSelectorDir, 'normalize.json'),
      JSON.stringify(
        {
          paragraph_rules: [
            {
              id: 'bad-rule',
              section_heading: 'Qualifications',
              // paragraph_contains is required
            },
          ],
        },
        null,
        2
      ),
      'utf-8'
    );

    const result = validateFieldSelector(fieldSelectorDir, 'fixture-fieldSelector');
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toContain('normalize.json');
  });

  it('rejects invalid clean.json configuration', () => {
    const fieldSelectorDir = mkdtempSync(join(tmpdir(), 'oa-field-selector-clean-invalid-'));
    tempDirs.push(fieldSelectorDir);

    writeMetadata(fieldSelectorDir);
    writeFileSync(
      join(fieldSelectorDir, 'replacements.json'),
      JSON.stringify({ '[Company Name]': '{company_name}' }, null, 2),
      'utf-8'
    );
    writeFileSync(
      join(fieldSelectorDir, 'clean.json'),
      JSON.stringify({ removeFootnotes: 'invalid' }, null, 2),
      'utf-8'
    );

    const result = validateFieldSelector(fieldSelectorDir, 'fixture-fieldSelector');

    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toContain('clean.json');
  });
});
