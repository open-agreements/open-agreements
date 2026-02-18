import { afterEach, describe, expect, vi } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  allureJsonAttachment,
  itAllure,
} from '../../../integration-tests/helpers/allure-test.js';

const itFilling = itAllure.epic('Filling & Rendering');
const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
  vi.restoreAllMocks();
  vi.resetModules();
});

function createRecipeFixture(options?: { computedProfile?: unknown; normalizeConfig?: unknown }) {
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

  if (options?.computedProfile) {
    writeFileSync(
      join(root, 'computed.json'),
      `${JSON.stringify(options.computedProfile, null, 2)}\n`,
      'utf-8'
    );
  }

  if (options?.normalizeConfig) {
    writeFileSync(
      join(root, 'normalize.json'),
      `${JSON.stringify(options.normalizeConfig, null, 2)}\n`,
      'utf-8'
    );
  }

  return root;
}

describe('runRecipe', () => {
  itFilling.openspec(['OA-013', 'OA-061'])('forwards requiredFieldNames when inputPath is supplied', async () => {
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

    vi.doMock('../../utils/paths.js', () => ({
      resolveRecipeDir: () => recipeDir,
    }));

    vi.doMock('../unified-pipeline.js', () => ({
      runFillPipeline: runFillPipelineMock,
    }));

    const { runRecipe } = await import('./index.js');

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

  itFilling.openspec(['OA-062', 'OA-064'])('applies computed rules and captures pass-level trace', async () => {
    const computedProfile = {
      version: '1.0',
      max_passes: 3,
      rules: [
        {
          id: 'derive-dispute-track-courts',
          when_all: [{ field: 'dispute_resolution_mode', op: 'eq', value: 'courts' }],
          set_audit: { dispute_resolution_track: 'courts' },
        },
        {
          id: 'derive-governing-law-baseline',
          set_audit: { governing_law_state: 'delaware' },
        },
        {
          id: 'derive-forum-governing-mismatch',
          when_all: [
            { field: 'dispute_resolution_track', op: 'eq', value: 'courts' },
            { field: 'state_lower', op: 'neq', value: 'delaware' },
          ],
          set_audit: { forum_governing_law_alignment: 'mismatch' },
        },
        {
          id: 'derive-judicial-district-default-california',
          when_all: [
            { field: 'dispute_resolution_track', op: 'eq', value: 'courts' },
            { field: 'state_lower', op: 'eq', value: 'california' },
            { field: 'judicial_district', op: 'falsy' },
          ],
          set_fill: { judicial_district: 'Northern District of California' },
        },
      ],
    };
    const recipeDir = createRecipeFixture({ computedProfile });
    const computedOutPath = join(recipeDir, 'computed-output.json');

    const runFillPipelineMock = vi.fn(async ({ outputPath }: { outputPath: string }) => ({
      outputPath,
      fieldsUsed: ['company_name'],
      stages: {
        cleaned: '/tmp/cleaned.docx',
        patched: '/tmp/patched.docx',
        filled: '/tmp/filled.docx',
      },
    }));

    vi.doMock('../../utils/paths.js', () => ({
      resolveRecipeDir: () => recipeDir,
    }));

    vi.doMock('../unified-pipeline.js', () => ({
      runFillPipeline: runFillPipelineMock,
    }));

    const { runRecipe } = await import('./index.js');

    const result = await runRecipe({
      recipeId: 'fixture-recipe',
      inputPath: '/tmp/input.docx',
      outputPath: '/tmp/output.docx',
      values: {
        company_name: 'Acme Corp',
        dispute_resolution_mode: 'courts',
        state_lower: 'california',
      },
      computedOutPath,
    });

    const artifact = JSON.parse(readFileSync(computedOutPath, 'utf-8')) as Record<string, unknown>;
    await allureJsonAttachment('runRecipe-computed-artifact.json', artifact);

    expect(runFillPipelineMock).toHaveBeenCalledTimes(1);
    expect(runFillPipelineMock.mock.calls[0][0]).toMatchObject({
      values: expect.objectContaining({
        company_name: 'Acme Corp',
        dispute_resolution_mode: 'courts',
        state_lower: 'california',
        judicial_district: 'Northern District of California',
      }),
    });

    expect(artifact).toMatchObject({
      recipe_id: 'fixture-recipe',
      profile_present: true,
      derived_audit_values: {
        dispute_resolution_track: 'courts',
        governing_law_state: 'delaware',
        forum_governing_law_alignment: 'mismatch',
      },
      derived_fill_values: {
        judicial_district: 'Northern District of California',
      },
    });
    expect(Array.isArray(artifact.passes)).toBe(true);
    expect(result.computedOutPath).toBe(computedOutPath);
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

    vi.doMock('../../utils/paths.js', () => ({
      resolveRecipeDir: () => recipeDir,
    }));

    vi.doMock('./downloader.js', () => ({
      ensureSourceDocx: ensureSourceDocxMock,
    }));

    vi.doMock('../unified-pipeline.js', () => ({
      runFillPipeline: runFillPipelineMock,
    }));

    const { runRecipe } = await import('./index.js');

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

  itFilling('loads normalize.json rules and passes field values into post-process normalization', async () => {
    const recipeDir = createRecipeFixture({
      normalizeConfig: {
        paragraph_rules: [
          {
            id: 'fill-company-counsel-name',
            section_heading: 'Conditions of the Purchasers’ Obligations at Closing',
            paragraph_contains: 'The Purchasers shall have received from',
            replacements: {
              '[___________]': '{company_counsel_name}',
            },
            trim_unmatched_trailing_bracket: true,
          },
        ],
      },
    });

    const normalizeMock = vi.fn(async () => ({
      unbracketedSegments: 0,
      removedSegments: 0,
      removedParagraphs: 0,
      normalizedParagraphs: 0,
      declarativeRuleApplications: 1,
    }));

    const runFillPipelineMock = vi.fn(async ({ outputPath, postProcess }: { outputPath: string; postProcess?: (p: string) => Promise<void> }) => {
      if (postProcess) {
        await postProcess(outputPath);
      }
      return {
        outputPath,
        fieldsUsed: ['company_name', 'company_counsel_name'],
        stages: {
          cleaned: '/tmp/cleaned.docx',
          patched: '/tmp/patched.docx',
          filled: '/tmp/filled.docx',
        },
      };
    });

    vi.doMock('../../utils/paths.js', () => ({
      resolveRecipeDir: () => recipeDir,
    }));

    vi.doMock('./bracket-normalizer.js', () => ({
      normalizeBracketArtifacts: normalizeMock,
    }));

    vi.doMock('../unified-pipeline.js', () => ({
      runFillPipeline: runFillPipelineMock,
    }));

    const { runRecipe } = await import('./index.js');

    await runRecipe({
      recipeId: 'fixture-recipe',
      inputPath: '/tmp/input.docx',
      outputPath: '/tmp/output.docx',
      values: { company_name: 'Acme Corp', company_counsel_name: 'Cooley LLP' },
      normalizeBracketArtifacts: true,
    });

    expect(normalizeMock).toHaveBeenCalledTimes(1);
    expect(normalizeMock.mock.calls[0]).toEqual([
      '/tmp/output.docx',
      '/tmp/output.docx',
      {
        rules: [
          expect.objectContaining({
            id: 'fill-company-counsel-name',
          }),
        ],
        fieldValues: {
          company_name: 'Acme Corp',
          company_counsel_name: 'Cooley LLP',
        },
      },
    ]);
  });
});
