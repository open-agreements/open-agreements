import { afterEach, describe, expect, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  allureJsonAttachment,
  itAllure,
} from './helpers/allure-test.js';

const itFilling = itAllure.epic('Filling & Rendering');
const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
  vi.restoreAllMocks();
  vi.resetModules();
});

function createRecipeFixture() {
  const root = mkdtempSync(join(tmpdir(), 'oa-recipe-index-'));
  tempDirs.push(root);

  writeFileSync(
    join(root, 'metadata.yaml'),
    [
      'name: Fixture Recipe',
      'source_url: https://example.com/source.docx',
      'source_version: "1.0"',
      'license_note: Example recipe license',
      'fields:',
      '  - name: company_name',
      '    type: string',
      '    description: Company name',
      'required_fields:',
      '  - company_name',
      '',
    ].join('\n'),
    'utf-8'
  );

  writeFileSync(
    join(root, 'replacements.json'),
    JSON.stringify({ '[Company Name]': '{company_name}' }, null, 2),
    'utf-8'
  );

  return root;
}

describe('runRecipe', () => {
  itFilling.openspec('OA-013')('forwards requiredFieldNames when inputPath is supplied', async () => {
    const recipeDir = createRecipeFixture();

    const runFillPipelineMock = vi.fn(async ({ outputPath }: { outputPath: string }) => ({
      outputPath,
      fieldsUsed: ['company_name'],
      stages: {
        cleaned: '/tmp/cleaned.docx',
        patched: '/tmp/patched.docx',
        filled: '/tmp/filled.docx',
      },
    }));

    vi.doMock('../src/utils/paths.js', () => ({
      resolveRecipeDir: () => recipeDir,
    }));

    vi.doMock('../src/core/unified-pipeline.js', () => ({
      runFillPipeline: runFillPipelineMock,
    }));

    const { runRecipe } = await import('../src/core/recipe/index.js');

    const result = await runRecipe({
      recipeId: 'fixture-recipe',
      inputPath: '/tmp/input.docx',
      outputPath: '/tmp/output.docx',
      values: { company_name: 'Acme Corp' },
    });

    await allureJsonAttachment('runRecipe-forwarding.json', {
      pipelineCall: runFillPipelineMock.mock.calls[0]?.[0],
      result,
    });

    expect(runFillPipelineMock).toHaveBeenCalledTimes(1);
    expect(runFillPipelineMock.mock.calls[0][0]).toMatchObject({
      inputPath: '/tmp/input.docx',
      outputPath: '/tmp/output.docx',
      requiredFieldNames: ['company_name'],
      values: { company_name: 'Acme Corp' },
    });
    expect(result.fieldsUsed).toEqual(['company_name']);
  });

  itFilling.openspec('OA-012')('uses downloader path when inputPath is omitted', async () => {
    const recipeDir = createRecipeFixture();
    const ensureSourceDocxMock = vi.fn(async () => '/tmp/downloaded-source.docx');

    const runFillPipelineMock = vi.fn(async ({ outputPath }: { outputPath: string }) => ({
      outputPath,
      fieldsUsed: ['company_name'],
      stages: {
        cleaned: '/tmp/cleaned.docx',
        patched: '/tmp/patched.docx',
        filled: '/tmp/filled.docx',
      },
    }));

    vi.doMock('../src/utils/paths.js', () => ({
      resolveRecipeDir: () => recipeDir,
    }));

    vi.doMock('../src/core/recipe/downloader.js', () => ({
      ensureSourceDocx: ensureSourceDocxMock,
    }));

    vi.doMock('../src/core/unified-pipeline.js', () => ({
      runFillPipeline: runFillPipelineMock,
    }));

    const { runRecipe } = await import('../src/core/recipe/index.js');

    await runRecipe({
      recipeId: 'fixture-recipe',
      outputPath: '/tmp/output.docx',
      values: { company_name: 'Acme Corp' },
    });

    expect(ensureSourceDocxMock).toHaveBeenCalledWith('fixture-recipe', expect.any(Object));
    expect(runFillPipelineMock.mock.calls[0][0]).toMatchObject({
      inputPath: '/tmp/downloaded-source.docx',
    });
  });
});
