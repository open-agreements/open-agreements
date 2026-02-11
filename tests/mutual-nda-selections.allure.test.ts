import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { fillTemplate } from '../src/core/engine.js';
import { extractAllText } from '../src/core/recipe/verifier.js';
import { getTemplatesDir } from '../src/utils/paths.js';

declare const allure: any;

const TEST_CAPABILITY = 'open-agreements';
const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function mutualNdaTemplateDir(): string {
  return join(getTemplatesDir(), 'common-paper-mutual-nda');
}

async function tagScenario(story: string, description: string): Promise<void> {
  await allure.epic('OpenSpec Traceability');
  await allure.feature(TEST_CAPABILITY);
  await allure.story(story);
  await allure.severity('normal');
  await allure.description(description);
}

describe('common-paper-mutual-nda selections', () => {
  it('fixed-term flow removes non-selected options', async () => {
    await tagScenario(
      'Fixed term selection removes non-selected options',
      'Behavior-level assertion for the OpenSpec scenario.'
    );

    const tempDir = mkdtempSync(join(tmpdir(), 'oa-mnda-fixed-'));
    tempDirs.push(tempDir);
    const outputPath = join(tempDir, 'fixed-term.docx');

    await fillTemplate({
      templateDir: mutualNdaTemplateDir(),
      outputPath,
      values: {
        purpose: 'Evaluate partnership',
        effective_date: '2026-02-10',
        mnda_term: '1 year(s)',
        confidentiality_term: '1 year(s)',
        confidentiality_term_start: 'Effective Date',
        governing_law: 'Delaware',
        jurisdiction: 'courts located in New Castle County, Delaware',
        changes_to_standard_terms: 'None.',
      },
    });

    const text = extractAllText(outputPath);
    expect(text).toContain('Expires 1 year(s) from Effective Date.');
    expect(text).toContain('[ x ]Expires 1 year(s) from Effective Date.');
    expect(text).not.toContain('Continues until terminated in accordance with the terms of the MNDA.');
    expect(text).not.toContain('[ ]Expires 1 year(s) from Effective Date.');
    expect(text).toContain('1 year(s) from Effective Date');
    expect(text).toContain('[ x ]1 year(s) from Effective Date');
    expect(text).not.toContain('In perpetuity.');
  });

  it('perpetual flow marks selected options', async () => {
    await tagScenario(
      'Perpetual selection marks selected options',
      'Behavior-level assertion for the OpenSpec scenario.'
    );

    const tempDir = mkdtempSync(join(tmpdir(), 'oa-mnda-perpetual-'));
    tempDirs.push(tempDir);
    const outputPath = join(tempDir, 'perpetual.docx');

    await fillTemplate({
      templateDir: mutualNdaTemplateDir(),
      outputPath,
      values: {
        purpose: 'Evaluate partnership',
        effective_date: '2026-02-10',
        mnda_term: 'until terminated',
        confidentiality_term: 'In perpetuity',
        confidentiality_term_start: 'Effective Date',
        governing_law: 'Delaware',
        jurisdiction: 'courts located in New Castle County, Delaware',
        changes_to_standard_terms: 'None.',
      },
    });

    const text = extractAllText(outputPath);
    expect(text).toContain('[ x ]Continues until terminated in accordance with the terms of the MNDA.');
    expect(text).not.toContain('[ ]Continues until terminated in accordance with the terms of the MNDA.');
    expect(text).not.toContain('Expires until terminated from Effective Date.');
    expect(text).toContain('[ x ]In perpetuity.');
    expect(text).not.toContain('[ ]In perpetuity.');
    expect(text).not.toContain('until Confidential Information is no longer considered a trade secret under applicable laws.');
  });
});
