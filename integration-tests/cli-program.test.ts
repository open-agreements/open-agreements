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
const runChecklistCreateMock = vi.fn();
const runChecklistRenderMock = vi.fn();
const runChecklistPatchValidateMock = vi.fn();
const runChecklistPatchApplyMock = vi.fn();

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

vi.mock('../src/commands/checklist.js', () => ({
  runChecklistCreate: runChecklistCreateMock,
  runChecklistRender: runChecklistRenderMock,
  runChecklistPatchValidate: runChecklistPatchValidateMock,
  runChecklistPatchApply: runChecklistPatchApplyMock,
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
      const argv = [
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
      ];

      await allureStep('Given fill argv includes --data and --set overrides', async () => {
        await allureJsonAttachment('cli-fill-argv.json', argv);
      });

      const program = createProgram();
      await allureStep('When fill argv is parsed', async () => {
        await program.parseAsync(argv);
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

      await allureStep('Then runFill is called exactly once', async () => {
        expect(runFillMock).toHaveBeenCalledTimes(1);
      });

      await allureStep('And runFill receives merged values payload', async () => {
        expect(call).toEqual({
          template: 'common-paper-mutual-nda',
          output: '/tmp/out.docx',
          values: {
            company_name: 'Data Co',
            purpose: 'Override Purpose',
            effective_date: '2026-02-12',
          },
        });
      });
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  itPlatform('parses fill memo flags into runFill payload', async () => {
    const argv = [
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
    ];

    await allureStep('Given fill argv includes memo options', async () => {
      await allureJsonAttachment('cli-fill-memo-argv.json', argv);
    });

    const program = createProgram();
    await allureStep('When fill memo argv is parsed', async () => {
      await program.parseAsync(argv);
    });

    await allureJsonAttachment('cli-fill-memo-forwarded-call.json', runFillMock.mock.calls[0]?.[0]);

    await allureStep('Then runFill is called exactly once', async () => {
      expect(runFillMock).toHaveBeenCalledTimes(1);
    });

    await allureStep('And runFill receives memo configuration in payload', async () => {
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
  });

  itPlatform('rejects invalid --set values without key=value format', async () => {
    const argv = [
      'node',
      'open-agreements',
      'fill',
      'common-paper-mutual-nda',
      '--set',
      '=missingKey',
    ];

    await allureStep('Given fill argv includes malformed --set value', async () => {
      await allureJsonAttachment('cli-fill-invalid-set-argv.json', argv);
    });

    const program = createProgram();

    await allureStep('When malformed --set argv is parsed, parser rejects with format error', async () => {
      await expect(program.parseAsync(argv)).rejects.toThrow('Invalid --set format: "=missingKey"');
    });

    await allureStep('Then runFill is not called', async () => {
      expect(runFillMock).not.toHaveBeenCalled();
    });
  });

  itPlatform('rejects invalid --memo format values', async () => {
    const argv = [
      'node',
      'open-agreements',
      'fill',
      'openagreements-employment-offer-letter',
      '--memo',
      'xml',
    ];

    await allureStep('Given fill argv includes unsupported --memo format', async () => {
      await allureJsonAttachment('cli-fill-invalid-memo-argv.json', argv);
    });

    const program = createProgram();

    await allureStep('When invalid --memo format is parsed, parser rejects', async () => {
      await expect(program.parseAsync(argv)).rejects.toThrow('Invalid --memo format: "xml"');
    });
  });

  itPlatform.openspec('OA-047')('forwards list flags to runList', async () => {
    const argv = [
      'node',
      'open-agreements',
      'list',
      '--json',
      '--json-strict',
      '--templates-only',
    ];

    await allureStep('Given list argv includes json/json-strict/templates-only flags', async () => {
      await allureJsonAttachment('cli-list-argv.json', argv);
    });

    await allureStep('When list argv runs through runCli', async () => {
      await runCli(argv);
    });

    await allureJsonAttachment('cli-list-forwarded-call.json', runListMock.mock.calls[0]?.[0]);

    await allureStep('Then runList receives forwarded flags', async () => {
      expect(runListMock).toHaveBeenCalledWith({
        json: true,
        jsonStrict: true,
        templatesOnly: true,
      });
    });
  });

  itPlatform('forwards validate and scan commands', async () => {
    const validateArgv = ['node', 'open-agreements', 'validate', 'common-paper-mutual-nda', '--strict'];
    const scanArgv = ['node', 'open-agreements', 'scan', 'input.docx', '--output-replacements', 'replacements.json'];

    await allureStep('Given validate and scan argv payloads', async () => {
      await allureJsonAttachment('cli-validate-scan-argv.json', {
        validateArgv,
        scanArgv,
      });
    });

    await allureStep('When validate and scan commands are executed via runCli', async () => {
      await runCli(validateArgv);
      await runCli(scanArgv);
    });

    await allureJsonAttachment('cli-validate-forwarded-call.json', runValidateMock.mock.calls[0]?.[0]);
    await allureJsonAttachment('cli-scan-forwarded-call.json', runScanMock.mock.calls[0]?.[0]);

    await allureStep('Then validate command forwards template and strict flag', async () => {
      expect(runValidateMock).toHaveBeenCalledWith({ template: 'common-paper-mutual-nda', strict: true });
    });

    await allureStep('And scan command forwards input and output replacements path', async () => {
      expect(runScanMock).toHaveBeenCalledWith({ input: 'input.docx', outputReplacements: 'replacements.json' });
    });
  });

  itPlatform('forwards recipe subcommands to recipe command handlers', async () => {
    const recipeRunArgv = [
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
    ];

    const recipeCleanArgv = [
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
    ];

    const recipePatchArgv = [
      'node',
      'open-agreements',
      'recipe',
      'patch',
      'clean.docx',
      '--output',
      'patched.docx',
      '--recipe',
      'nvca-voting-agreement',
    ];

    await allureStep('Given recipe run/clean/patch argv payloads', async () => {
      await allureJsonAttachment('cli-recipe-argv.json', {
        recipeRunArgv,
        recipeCleanArgv,
        recipePatchArgv,
      });
    });

    await allureStep('When recipe subcommands are executed', async () => {
      await runCli(recipeRunArgv);
      await runCli(recipeCleanArgv);
      await runCli(recipePatchArgv);
    });

    await allureJsonAttachment('cli-recipe-forwarded-calls.json', {
      run: runRecipeCommandMock.mock.calls[0]?.[0],
      clean: runRecipeCleanMock.mock.calls[0]?.[0],
      patch: runRecipePatchMock.mock.calls[0]?.[0],
    });

    await allureStep('Then recipe run command payload is forwarded correctly', async () => {
      expect(runRecipeCommandMock).toHaveBeenCalledWith({
        recipeId: 'nvca-voting-agreement',
        input: 'input.docx',
        output: 'out.docx',
        data: 'values.json',
        computedOut: 'computed.json',
        keepIntermediate: true,
        normalizeBrackets: true,
      });
    });

    await allureStep('And recipe clean command payload is forwarded correctly', async () => {
      expect(runRecipeCleanMock).toHaveBeenCalledWith({
        input: 'raw.docx',
        output: 'clean.docx',
        recipe: 'nvca-voting-agreement',
        extractGuidance: 'guidance.json',
      });
    });

    await allureStep('And recipe patch command payload is forwarded correctly', async () => {
      expect(runRecipePatchMock).toHaveBeenCalledWith({
        input: 'clean.docx',
        output: 'patched.docx',
        recipe: 'nvca-voting-agreement',
      });
    });
  });

  itPlatform('forwards checklist patch validate/apply subcommands', async () => {
    const patchValidateArgv = [
      'node',
      'open-agreements',
      'checklist',
      'patch-validate',
      '--state',
      'state.json',
      '--patch',
      'patch.json',
      '--output',
      'validate-result.json',
      '--validation-store',
      '.tmp/validation-store.json',
    ];

    const patchApplyArgv = [
      'node',
      'open-agreements',
      'checklist',
      'patch-apply',
      '--state',
      'state.json',
      '--request',
      'apply-request.json',
      '--output',
      'apply-result.json',
      '--validation-store',
      '.tmp/validation-store.json',
      '--applied-store',
      '.tmp/applied-store.json',
      '--proposed-store',
      '.tmp/proposed-store.json',
    ];

    await allureStep('Given checklist patch validate/apply argv payloads', async () => {
      await allureJsonAttachment('cli-checklist-patch-argv.json', {
        patchValidateArgv,
        patchApplyArgv,
      });
    });

    await allureStep('When checklist patch subcommands are executed', async () => {
      await runCli(patchValidateArgv);
      await runCli(patchApplyArgv);
    });

    await allureJsonAttachment('cli-checklist-patch-forwarded-calls.json', {
      patchValidate: runChecklistPatchValidateMock.mock.calls[0]?.[0],
      patchApply: runChecklistPatchApplyMock.mock.calls[0]?.[0],
    });

    await allureStep('Then patch-validate forwards expected file paths', async () => {
      expect(runChecklistPatchValidateMock).toHaveBeenCalledWith({
        state: 'state.json',
        patch: 'patch.json',
        output: 'validate-result.json',
        validationStore: '.tmp/validation-store.json',
      });
    });

    await allureStep('And patch-apply forwards expected file paths', async () => {
      expect(runChecklistPatchApplyMock).toHaveBeenCalledWith({
        state: 'state.json',
        request: 'apply-request.json',
        output: 'apply-result.json',
        validationStore: '.tmp/validation-store.json',
        appliedStore: '.tmp/applied-store.json',
        proposedStore: '.tmp/proposed-store.json',
      });
    });
  });
});
