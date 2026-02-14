import { afterEach, describe, expect, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  allureJsonAttachment,
  allureStep,
  itAllure,
} from './helpers/allure-test.js';

const runFillMock = vi.fn();
const runValidateMock = vi.fn();
const runListMock = vi.fn();
const runRecipeCommandMock = vi.fn();
const runRecipeCleanMock = vi.fn();
const runRecipePatchMock = vi.fn();
const runScanMock = vi.fn();

vi.mock('../src/commands/fill.js', () => ({
  runFill: runFillMock,
}));

vi.mock('../src/commands/validate.js', () => ({
  runValidate: runValidateMock,
}));

vi.mock('../src/commands/list.js', () => ({
  runList: runListMock,
}));

vi.mock('../src/commands/recipe.js', () => ({
  runRecipeCommand: runRecipeCommandMock,
  runRecipeClean: runRecipeCleanMock,
  runRecipePatch: runRecipePatchMock,
}));

vi.mock('../src/commands/scan.js', () => ({
  runScan: runScanMock,
}));

const { createProgram, runCli } = await import('../src/cli/index.js');
const itPlatform = itAllure.epic('Platform & Distribution');

afterEach(() => {
  vi.clearAllMocks();
});

describe('CLI program wiring', () => {
  itPlatform.openspec('OA-046')('parses fill command data and set flags into runFill payload', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'oa-cli-program-'));
    const dataPath = join(tempDir, 'values.json');
    writeFileSync(dataPath, JSON.stringify({ company_name: 'Data Co', purpose: 'Data Purpose' }), 'utf-8');

    try {
      const program = createProgram();
      await allureStep('Parse fill command argv', async () => {
        await program.parseAsync([
          'node',
          'open-agreements',
          'fill',
          'common-paper-mutual-nda',
          '--data',
          dataPath,
          '--set',
          'purpose=Override Purpose',
          '--set',
          'effective_date=2026-02-12',
          '--output',
          '/tmp/out.docx',
        ]);
      });

      const call = runFillMock.mock.calls[0]?.[0];
      await allureJsonAttachment('cli-fill-expected-vs-actual.json', {
        expected: {
          template: 'common-paper-mutual-nda',
          output: '/tmp/out.docx',
          values: {
            company_name: 'Data Co',
            purpose: 'Override Purpose',
            effective_date: '2026-02-12',
          },
        },
        actual: call,
      });

      expect(runFillMock).toHaveBeenCalledTimes(1);
      expect(call).toEqual({
        template: 'common-paper-mutual-nda',
        output: '/tmp/out.docx',
        values: {
          company_name: 'Data Co',
          purpose: 'Override Purpose',
          effective_date: '2026-02-12',
        },
      });
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  itPlatform('parses fill memo flags into runFill payload', async () => {
    const program = createProgram();

    await allureStep('Parse fill command with memo options', async () => {
      await program.parseAsync([
        'node',
        'open-agreements',
        'fill',
        'openagreements-employment-offer-letter',
        '--set',
        'employer_name=Acme Inc.',
        '--memo',
        'both',
        '--memo-json',
        '/tmp/memo.json',
        '--memo-md',
        '/tmp/memo.md',
        '--memo-jurisdiction',
        'California',
        '--memo-baseline',
        'openagreements-employment-offer-letter',
      ]);
    });

    expect(runFillMock).toHaveBeenCalledTimes(1);
    expect(runFillMock).toHaveBeenCalledWith({
      template: 'openagreements-employment-offer-letter',
      output: undefined,
      values: {
        employer_name: 'Acme Inc.',
      },
      memo: {
        enabled: true,
        format: 'both',
        jsonOutputPath: '/tmp/memo.json',
        markdownOutputPath: '/tmp/memo.md',
        jurisdiction: 'California',
        baselineTemplateId: 'openagreements-employment-offer-letter',
      },
    });
  });

  itPlatform('rejects invalid --set values without key=value format', async () => {
    const program = createProgram();

    await expect(
      program.parseAsync([
        'node',
        'open-agreements',
        'fill',
        'common-paper-mutual-nda',
        '--set',
        '=missingKey',
      ])
    ).rejects.toThrow('Invalid --set format: "=missingKey"');

    expect(runFillMock).not.toHaveBeenCalled();
  });

  itPlatform('rejects invalid --memo format values', async () => {
    const program = createProgram();

    await expect(
      program.parseAsync([
        'node',
        'open-agreements',
        'fill',
        'openagreements-employment-offer-letter',
        '--memo',
        'xml',
      ])
    ).rejects.toThrow('Invalid --memo format: "xml"');
  });

  itPlatform.openspec('OA-047')('forwards list flags to runList', async () => {
    await runCli([
      'node',
      'open-agreements',
      'list',
      '--json',
      '--json-strict',
      '--templates-only',
    ]);

    expect(runListMock).toHaveBeenCalledWith({
      json: true,
      jsonStrict: true,
      templatesOnly: true,
    });
  });

  itPlatform('forwards validate and scan commands', async () => {
    await runCli(['node', 'open-agreements', 'validate', 'common-paper-mutual-nda', '--strict']);
    await runCli(['node', 'open-agreements', 'scan', 'input.docx', '--output-replacements', 'replacements.json']);

    expect(runValidateMock).toHaveBeenCalledWith({ template: 'common-paper-mutual-nda', strict: true });
    expect(runScanMock).toHaveBeenCalledWith({ input: 'input.docx', outputReplacements: 'replacements.json' });
  });

  itPlatform('forwards recipe subcommands to recipe command handlers', async () => {
    await runCli([
      'node',
      'open-agreements',
      'recipe',
      'run',
      'nvca-voting-agreement',
      '--input',
      'input.docx',
      '--output',
      'out.docx',
      '--data',
      'values.json',
      '--computed-out',
      'computed.json',
      '--keep-intermediate',
    ]);

    await runCli([
      'node',
      'open-agreements',
      'recipe',
      'clean',
      'raw.docx',
      '--output',
      'clean.docx',
      '--recipe',
      'nvca-voting-agreement',
      '--extract-guidance',
      'guidance.json',
    ]);

    await runCli([
      'node',
      'open-agreements',
      'recipe',
      'patch',
      'clean.docx',
      '--output',
      'patched.docx',
      '--recipe',
      'nvca-voting-agreement',
    ]);

    expect(runRecipeCommandMock).toHaveBeenCalledWith({
      recipeId: 'nvca-voting-agreement',
      input: 'input.docx',
      output: 'out.docx',
      data: 'values.json',
      computedOut: 'computed.json',
      keepIntermediate: true,
      normalizeBrackets: true,
    });

    expect(runRecipeCleanMock).toHaveBeenCalledWith({
      input: 'raw.docx',
      output: 'clean.docx',
      recipe: 'nvca-voting-agreement',
      extractGuidance: 'guidance.json',
    });

    expect(runRecipePatchMock).toHaveBeenCalledWith({
      input: 'clean.docx',
      output: 'patched.docx',
      recipe: 'nvca-voting-agreement',
    });
  });
});
