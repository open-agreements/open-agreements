import { afterEach, describe, expect, vi } from 'vitest';
import {
  allureJsonAttachment,
  allureStep,
  itAllure,
} from './helpers/allure-test.js';

interface ValidateHarnessOptions {
  listTemplateEntries?: Array<{ id: string; dir: string }>;
  listExternalEntries?: Array<{ id: string; dir: string }>;
  listRecipeEntries?: Array<{ id: string; dir: string }>;
  findTemplateDir?: string | undefined;
  findExternalDir?: string | undefined;
  findRecipeDir?: string | undefined;
}

interface ValidateHarness {
  runValidate: (args: { template?: string; strict?: boolean }) => void;
  spies: {
    validateMetadata: ReturnType<typeof vi.fn>;
    validateTemplate: ReturnType<typeof vi.fn>;
    validateLicense: ReturnType<typeof vi.fn>;
    validateExternal: ReturnType<typeof vi.fn>;
    validateRecipe: ReturnType<typeof vi.fn>;
    listTemplateEntries: ReturnType<typeof vi.fn>;
    listExternalEntries: ReturnType<typeof vi.fn>;
    listRecipeEntries: ReturnType<typeof vi.fn>;
    findTemplateDir: ReturnType<typeof vi.fn>;
    findExternalDir: ReturnType<typeof vi.fn>;
    findRecipeDir: ReturnType<typeof vi.fn>;
  };
}

const it = itAllure.epic('Verification & Drift');

afterEach(() => {
  vi.unmock('../src/core/metadata.js');
  vi.unmock('../src/core/validation/template.js');
  vi.unmock('../src/core/validation/license.js');
  vi.unmock('../src/core/validation/external.js');
  vi.unmock('../src/core/validation/recipe.js');
  vi.unmock('../src/utils/paths.js');
  vi.restoreAllMocks();
  vi.resetModules();
});

async function loadValidateHarness(opts: ValidateHarnessOptions = {}): Promise<ValidateHarness> {
  vi.resetModules();

  const validateMetadata = vi.fn(() => ({ valid: true, errors: [] as string[] }));
  const validateTemplate = vi.fn(() => ({ valid: true, errors: [] as string[], warnings: ['template warning'] }));
  const validateLicense = vi.fn(() => ({ valid: true, errors: [] as string[] }));
  const validateExternal = vi.fn(() => ({ valid: true, errors: [] as string[], warnings: ['external warning'] }));
  const validateRecipe = vi.fn(() => ({ valid: true, errors: [] as string[], warnings: ['recipe warning'], scaffold: false }));

  const listTemplateEntries = vi.fn(() => opts.listTemplateEntries ?? [{ id: 'tmpl-1', dir: '/content/templates/tmpl-1' }]);
  const listExternalEntries = vi.fn(() => opts.listExternalEntries ?? [{ id: 'ext-1', dir: '/content/external/ext-1' }]);
  const listRecipeEntries = vi.fn(() => opts.listRecipeEntries ?? [{ id: 'rcp-1', dir: '/content/recipes/rcp-1' }]);

  const findTemplateDir = vi.fn(() => opts.findTemplateDir);
  const findExternalDir = vi.fn(() => opts.findExternalDir);
  const findRecipeDir = vi.fn(() => opts.findRecipeDir);

  vi.doMock('../src/core/metadata.js', () => ({
    validateMetadata,
  }));

  vi.doMock('../src/core/validation/template.js', () => ({
    validateTemplate,
  }));

  vi.doMock('../src/core/validation/license.js', () => ({
    validateLicense,
  }));

  vi.doMock('../src/core/validation/external.js', () => ({
    validateExternal,
  }));

  vi.doMock('../src/core/validation/recipe.js', () => ({
    validateRecipe,
  }));

  vi.doMock('../src/utils/paths.js', () => ({
    listTemplateEntries,
    listExternalEntries,
    listRecipeEntries,
    findTemplateDir,
    findExternalDir,
    findRecipeDir,
  }));

  const module = await import('../src/commands/validate.js');

  return {
    runValidate: module.runValidate,
    spies: {
      validateMetadata,
      validateTemplate,
      validateLicense,
      validateExternal,
      validateRecipe,
      listTemplateEntries,
      listExternalEntries,
      listRecipeEntries,
      findTemplateDir,
      findExternalDir,
      findRecipeDir,
    },
  };
}

describe('runValidate command coverage', () => {
  it('validates templates/external/recipes and prints PASSED in full mode', async () => {
    const harness = await loadValidateHarness();
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await allureStep('Run validation in full mode', async () => {
      harness.runValidate({ strict: true });
    });

    await allureJsonAttachment('validate-full-mode-pass.json', {
      metadataCalls: harness.spies.validateMetadata.mock.calls,
      templateCalls: harness.spies.validateTemplate.mock.calls,
      licenseCalls: harness.spies.validateLicense.mock.calls,
      externalCalls: harness.spies.validateExternal.mock.calls,
      recipeCalls: harness.spies.validateRecipe.mock.calls,
      logs: logSpy.mock.calls.map((call) => String(call[0])),
    });

    expect(harness.spies.validateMetadata).toHaveBeenCalledTimes(1);
    expect(harness.spies.validateTemplate).toHaveBeenCalledTimes(1);
    expect(harness.spies.validateLicense).toHaveBeenCalledTimes(1);
    expect(harness.spies.validateExternal).toHaveBeenCalledTimes(1);
    expect(harness.spies.validateRecipe).toHaveBeenCalledTimes(1);
    expect(logSpy.mock.calls.some((call) => String(call[0]).includes('Validation PASSED'))).toBe(true);
  });

  it('prints FAILED and exits non-zero when any validator reports errors', async () => {
    const harness = await loadValidateHarness();

    harness.spies.validateMetadata.mockReturnValueOnce({
      valid: false,
      errors: ['missing metadata field'],
    });

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`EXIT_${code ?? 0}`);
    }) as never);

    expect(() => harness.runValidate({})).toThrow('EXIT_1');

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith('Validation FAILED');
  });

  it('prints No templates found and still passes when no entries exist', async () => {
    const harness = await loadValidateHarness({
      listTemplateEntries: [],
      listExternalEntries: [],
      listRecipeEntries: [],
    });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    harness.runValidate({});

    expect(logSpy.mock.calls.some((call) => String(call[0]).includes('No templates found.'))).toBe(true);
    expect(logSpy.mock.calls.some((call) => String(call[0]).includes('Validation PASSED'))).toBe(true);
  });

  it('validates a single template and bypasses external/recipe validators', async () => {
    const harness = await loadValidateHarness({
      findTemplateDir: '/content/templates/tmpl-single',
      findExternalDir: '/content/external/ext-single',
      findRecipeDir: '/content/recipes/rcp-single',
    });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    harness.runValidate({ template: 'tmpl-single' });

    await allureJsonAttachment('validate-single-template.json', {
      templateCalls: harness.spies.validateTemplate.mock.calls,
      externalCalls: harness.spies.validateExternal.mock.calls,
      recipeCalls: harness.spies.validateRecipe.mock.calls,
      logs: logSpy.mock.calls.map((call) => String(call[0])),
    });

    expect(harness.spies.validateTemplate).toHaveBeenCalledTimes(1);
    expect(harness.spies.validateExternal).not.toHaveBeenCalled();
    expect(harness.spies.validateRecipe).not.toHaveBeenCalled();
    expect(logSpy.mock.calls.some((call) => String(call[0]).includes('Validation PASSED'))).toBe(true);
  });

  it('fails single external validation when external validator returns invalid', async () => {
    const harness = await loadValidateHarness({
      findTemplateDir: undefined,
      findExternalDir: '/content/external/ext-single',
      findRecipeDir: '/content/recipes/rcp-single',
    });

    harness.spies.validateExternal.mockReturnValueOnce({
      valid: false,
      errors: ['source hash mismatch'],
      warnings: [],
    });

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`EXIT_${code ?? 0}`);
    }) as never);

    expect(() => harness.runValidate({ template: 'ext-single' })).toThrow('EXIT_1');

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith('Validation FAILED');
    expect(harness.spies.validateRecipe).not.toHaveBeenCalled();
  });

  it('handles recipe scaffold output and not-found template errors in single mode', async () => {
    const recipeHarness = await loadValidateHarness({
      findTemplateDir: undefined,
      findExternalDir: undefined,
      findRecipeDir: '/content/recipes/rcp-single',
    });

    recipeHarness.spies.validateRecipe.mockReturnValueOnce({
      valid: true,
      errors: [],
      warnings: ['recipe warning'],
      scaffold: true,
    });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    recipeHarness.runValidate({ template: 'rcp-single', strict: true });

    expect(logSpy.mock.calls.some((call) => String(call[0]).includes('PASS (scaffold)'))).toBe(true);

    vi.restoreAllMocks();

    const missingHarness = await loadValidateHarness({
      findTemplateDir: undefined,
      findExternalDir: undefined,
      findRecipeDir: undefined,
    });

    const missingErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`EXIT_${code ?? 0}`);
    }) as never);

    expect(() => missingHarness.runValidate({ template: 'does-not-exist' })).toThrow('EXIT_1');

    await allureJsonAttachment('validate-single-not-found.json', {
      stderr: missingErrorSpy.mock.calls.map((call) => String(call[0])),
    });

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(missingErrorSpy).toHaveBeenCalledWith(
      'Agreement "does-not-exist" not found in templates, external, or recipes.'
    );
  });
});
