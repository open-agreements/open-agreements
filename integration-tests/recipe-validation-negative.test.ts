import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect } from 'vitest';
import { itAllure } from './helpers/allure-test.js';
import { validateRecipe } from '../src/core/validation/recipe.js';

const tempDirs: string[] = [];
const it = itAllure.epic('Compliance & Governance');

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function writeMetadata(recipeDir: string): void {
  writeFileSync(
    join(recipeDir, 'metadata.yaml'),
    [
      'name: Fixture Recipe',
      'source_url: https://example.com/source.docx',
      'source_version: "1.0"',
      'license_note: Fixture license note',
      'fields:',
      '  - name: company_name',
      '    type: string',
      '    description: Company',
      'required_fields:',
      '  - company_name',
      '',
    ].join('\n'),
    'utf-8'
  );
}

describe('validateRecipe negative scenarios', () => {
  it('fails when metadata.yaml is invalid', () => {
    const recipeDir = mkdtempSync(join(tmpdir(), 'oa-recipe-invalid-metadata-'));
    tempDirs.push(recipeDir);
    writeFileSync(join(recipeDir, 'metadata.yaml'), 'name: Broken Recipe', 'utf-8');

    const result = validateRecipe(recipeDir, 'fixture-recipe');

    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toContain('metadata:');
  });

  it('treats metadata-only recipes as strict-mode errors', () => {
    const recipeDir = mkdtempSync(join(tmpdir(), 'oa-recipe-strict-scaffold-'));
    tempDirs.push(recipeDir);
    writeMetadata(recipeDir);

    const result = validateRecipe(recipeDir, 'fixture-recipe', { strict: true });

    expect(result.valid).toBe(false);
    expect(result.scaffold).toBe(true);
    expect(result.errors.join(' ')).toContain('Scaffold recipe (metadata-only): not runnable');
  });

  it.openspec('OA-RCP-016')('rejects committed DOCX files in recipe directories', () => {
    const recipeDir = mkdtempSync(join(tmpdir(), 'oa-recipe-docx-'));
    tempDirs.push(recipeDir);

    writeMetadata(recipeDir);
    writeFileSync(join(recipeDir, 'template.docx'), Buffer.from('fake-docx'));

    const result = validateRecipe(recipeDir, 'fixture-recipe');
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toContain('Copyrighted .docx file(s) found');
  });

  it.openspec('OA-RCP-018')('warns when replacement targets are not in metadata fields', () => {
    const recipeDir = mkdtempSync(join(tmpdir(), 'oa-recipe-schema-'));
    tempDirs.push(recipeDir);

    writeMetadata(recipeDir);
    writeFileSync(
      join(recipeDir, 'replacements.json'),
      JSON.stringify({ '[Company Name]': '{company_name_missing}' }, null, 2),
      'utf-8'
    );

    const result = validateRecipe(recipeDir, 'fixture-recipe');
    expect(result.valid).toBe(true);
    expect(result.warnings.join(' ')).toContain('Replacement target {company_name_missing} not found in metadata fields');
  });

  it.openspec('OA-RCP-027')('rejects unsafe non-identifier replacement tags', () => {
    const recipeDir = mkdtempSync(join(tmpdir(), 'oa-recipe-unsafe-tag-'));
    tempDirs.push(recipeDir);

    writeMetadata(recipeDir);
    writeFileSync(
      join(recipeDir, 'replacements.json'),
      JSON.stringify({ '[Company Name]': '{#if hacked}' }, null, 2),
      'utf-8'
    );

    const result = validateRecipe(recipeDir, 'fixture-recipe');
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toContain('unsafe tag');
  });

  it('rejects replacements.json when it is not a JSON object', () => {
    const recipeDir = mkdtempSync(join(tmpdir(), 'oa-recipe-replacements-object-'));
    tempDirs.push(recipeDir);

    writeMetadata(recipeDir);
    writeFileSync(join(recipeDir, 'replacements.json'), '1', 'utf-8');

    const result = validateRecipe(recipeDir, 'fixture-recipe');

    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toContain('replacements.json must be a JSON object');
  });

  it('rejects replacement value shape and infinite loop patterns', () => {
    const recipeDir = mkdtempSync(join(tmpdir(), 'oa-recipe-replacement-shape-'));
    tempDirs.push(recipeDir);

    writeMetadata(recipeDir);
    writeFileSync(
      join(recipeDir, 'replacements.json'),
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

    const result = validateRecipe(recipeDir, 'fixture-recipe');

    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toContain('value for "[Not String]" must be a string');
    expect(result.errors.join(' ')).toContain('must contain at least one {identifier} tag');
    expect(result.errors.join(' ')).toContain('contains the key itself');
    expect(result.errors.join(' ')).toContain('contains the search text');
  });

  it('rejects replacements.json parse failures', () => {
    const recipeDir = mkdtempSync(join(tmpdir(), 'oa-recipe-replacements-parse-'));
    tempDirs.push(recipeDir);

    writeMetadata(recipeDir);
    writeFileSync(join(recipeDir, 'replacements.json'), '{invalid json', 'utf-8');

    const result = validateRecipe(recipeDir, 'fixture-recipe');

    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toContain('replacements.json:');
  });

  it.openspec('OA-RCP-025')('rejects computed profiles with unsupported predicate operators', () => {
    const recipeDir = mkdtempSync(join(tmpdir(), 'oa-recipe-computed-op-'));
    tempDirs.push(recipeDir);

    writeMetadata(recipeDir);
    writeFileSync(
      join(recipeDir, 'replacements.json'),
      JSON.stringify({ '[Company Name]': '{company_name}' }, null, 2),
      'utf-8'
    );
    writeFileSync(
      join(recipeDir, 'computed.json'),
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

    const result = validateRecipe(recipeDir, 'fixture-recipe');
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toContain('computed.json');
  });

  it.openspec('OA-RCP-027')('rejects invalid normalize.json configuration', () => {
    const recipeDir = mkdtempSync(join(tmpdir(), 'oa-recipe-normalize-'));
    tempDirs.push(recipeDir);

    writeMetadata(recipeDir);
    writeFileSync(
      join(recipeDir, 'replacements.json'),
      JSON.stringify({ '[Company Name]': '{company_name}' }, null, 2),
      'utf-8'
    );
    writeFileSync(
      join(recipeDir, 'normalize.json'),
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

    const result = validateRecipe(recipeDir, 'fixture-recipe');
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toContain('normalize.json');
  });

  it.openspec('OA-RCP-027')('rejects invalid clean.json configuration', () => {
    const recipeDir = mkdtempSync(join(tmpdir(), 'oa-recipe-clean-invalid-'));
    tempDirs.push(recipeDir);

    writeMetadata(recipeDir);
    writeFileSync(
      join(recipeDir, 'replacements.json'),
      JSON.stringify({ '[Company Name]': '{company_name}' }, null, 2),
      'utf-8'
    );
    writeFileSync(
      join(recipeDir, 'clean.json'),
      JSON.stringify({ removeFootnotes: 'invalid' }, null, 2),
      'utf-8'
    );

    const result = validateRecipe(recipeDir, 'fixture-recipe');

    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toContain('clean.json');
  });
});
