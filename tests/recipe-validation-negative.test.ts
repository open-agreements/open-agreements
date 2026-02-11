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
      '    required: true',
      '',
    ].join('\n'),
    'utf-8'
  );
}

describe('validateRecipe negative scenarios', () => {
  it.openspec('OA-031')('rejects committed DOCX files in recipe directories', () => {
    const recipeDir = mkdtempSync(join(tmpdir(), 'oa-recipe-docx-'));
    tempDirs.push(recipeDir);

    writeMetadata(recipeDir);
    writeFileSync(join(recipeDir, 'template.docx'), Buffer.from('fake-docx'));

    const result = validateRecipe(recipeDir, 'fixture-recipe');
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toContain('Copyrighted .docx file(s) found');
  });

  it.openspec('OA-033')('warns when replacement targets are not in schema', () => {
    const recipeDir = mkdtempSync(join(tmpdir(), 'oa-recipe-schema-'));
    tempDirs.push(recipeDir);

    writeMetadata(recipeDir);
    writeFileSync(
      join(recipeDir, 'replacements.json'),
      JSON.stringify({ '[Company Name]': '{company_name_missing}' }, null, 2),
      'utf-8'
    );
    writeFileSync(
      join(recipeDir, 'schema.json'),
      JSON.stringify({ fields: [{ name: 'company_name', type: 'string' }] }, null, 2),
      'utf-8'
    );

    const result = validateRecipe(recipeDir, 'fixture-recipe');
    expect(result.valid).toBe(true);
    expect(result.warnings.join(' ')).toContain('Replacement target {company_name_missing} not found in schema.json');
  });
});
