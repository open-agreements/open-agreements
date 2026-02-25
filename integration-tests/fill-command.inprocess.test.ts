import { afterEach, describe, expect, vi } from 'vitest';
import {
  allureJsonAttachment,
  allureStep,
  itAllure,
} from './helpers/allure-test.js';

interface FillHarnessOptions {
  templateDir?: string;
  externalDir?: string;
  recipeDir?: string;
  availableTemplateIds?: string[];
  availableExternalIds?: string[];
  availableRecipeIds?: string[];
  metadata?: {
    name: string;
    allow_derivatives: boolean;
    required_fields: string[];
  };
  fillError?: Error;
  externalError?: Error;
  recipeError?: Error;
}

interface FillHarness {
  runFill: (args: { template: string; output?: string; values: Record<string, string> }) => Promise<void>;
  spies: {
    findTemplateDir: ReturnType<typeof vi.fn>;
    findExternalDir: ReturnType<typeof vi.fn>;
    findRecipeDir: ReturnType<typeof vi.fn>;
    listTemplateIds: ReturnType<typeof vi.fn>;
    listExternalIds: ReturnType<typeof vi.fn>;
    listRecipeIds: ReturnType<typeof vi.fn>;
    loadMetadata: ReturnType<typeof vi.fn>;
    fillTemplate: ReturnType<typeof vi.fn>;
    runExternalFill: ReturnType<typeof vi.fn>;
    runRecipe: ReturnType<typeof vi.fn>;
  };
}

const itFilling = itAllure.epic('Filling & Rendering');
const itCompliance = itAllure.epic('Compliance & Governance');

async function loadFillHarness(opts: FillHarnessOptions = {}): Promise<FillHarness> {
  vi.resetModules();

  const findTemplateDir = vi.fn(() => opts.templateDir);
  const findExternalDir = vi.fn(() => opts.externalDir);
  const findRecipeDir = vi.fn(() => opts.recipeDir);
  const listTemplateIds = vi.fn(() => opts.availableTemplateIds ?? []);
  const listExternalIds = vi.fn(() => opts.availableExternalIds ?? []);
  const listRecipeIds = vi.fn(() => opts.availableRecipeIds ?? []);

  const loadMetadata = vi.fn(() => opts.metadata ?? {
    name: 'Mock Template',
    allow_derivatives: true,
    required_fields: ['company_name'],
  });

  const fillTemplate = vi.fn(async ({ outputPath }: { outputPath: string }) => {
    if (opts.fillError) throw opts.fillError;
    return {
      metadata: { name: 'Mock Template' },
      outputPath,
      fieldsUsed: ['company_name'],
      verify: { passed: true, checks: [] },
    };
  });

  const runExternalFill = vi.fn(async ({ outputPath }: { outputPath: string }) => {
    if (opts.externalError) throw opts.externalError;
    return {
      metadata: { name: 'Mock External Template' },
      outputPath,
      fieldsUsed: ['company_name'],
      stages: {},
    };
  });

  const runRecipe = vi.fn(async ({ outputPath }: { outputPath: string }) => {
    if (opts.recipeError) throw opts.recipeError;
    return {
      metadata: { name: 'Mock Recipe Template' },
      outputPath,
      fieldsUsed: ['company_name'],
      stages: {},
    };
  });

  vi.doMock('../src/utils/paths.js', () => ({
    findTemplateDir,
    findExternalDir,
    findRecipeDir,
    listTemplateIds,
    listExternalIds,
    listRecipeIds,
  }));

  vi.doMock('../src/core/metadata.js', () => ({
    loadMetadata,
  }));

  vi.doMock('../src/core/engine.js', () => ({
    fillTemplate,
  }));

  vi.doMock('../src/core/external/index.js', () => ({
    runExternalFill,
  }));

  vi.doMock('../src/core/recipe/index.js', () => ({
    runRecipe,
  }));

  const { runFill } = await import('../src/commands/fill.js');

  return {
    runFill,
    spies: {
      findTemplateDir,
      findExternalDir,
      findRecipeDir,
      listTemplateIds,
      listExternalIds,
      listRecipeIds,
      loadMetadata,
      fillTemplate,
      runExternalFill,
      runRecipe,
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

describe('runFill in-process coverage', () => {
  itFilling.openspec(['OA-TMP-005', 'OA-CLI-003'])('fills a template path and defaults output filename', async () => {
    const harness = await loadFillHarness({
      templateDir: '/templates/common-paper-mutual-nda',
      metadata: {
        name: 'Mutual NDA',
        allow_derivatives: true,
        required_fields: ['company_name'],
      },
    });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await allureStep('Run template fill with no explicit output path', async () => {
      await harness.runFill({
        template: 'common-paper-mutual-nda',
        values: { company_name: 'Acme Corp' },
      });
    });

    const fillCall = harness.spies.fillTemplate.mock.calls[0][0];
    await allureJsonAttachment('runFill-template-path.json', {
      fillCall,
      logs: logSpy.mock.calls.map((call) => String(call[0])),
    });

    expect(harness.spies.fillTemplate).toHaveBeenCalledTimes(1);
    expect(String(fillCall.outputPath)).toContain('common-paper-mutual-nda-filled.docx');
    expect(logSpy.mock.calls.some((call) => String(call[0]).includes('Filled'))).toBe(true);
  });

  itCompliance.openspec('OA-DST-003')('blocks template fill when allow_derivatives is false', async () => {
    const harness = await loadFillHarness({
      templateDir: '/templates/restricted-template',
      metadata: {
        name: 'Restricted Template',
        allow_derivatives: false,
        required_fields: ['company_name'],
      },
    });

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation(((code?: number) => {
        throw new Error(`EXIT_${code ?? 0}`);
      }) as never);

    await allureStep('Attempt restricted template fill', async () => {
      await expect(
        harness.runFill({ template: 'restricted-template', values: { company_name: 'Acme Corp' } })
      ).rejects.toThrow('EXIT_1');
    });

    await allureJsonAttachment('runFill-allow-derivatives-false.json', {
      stderrCalls: errorSpy.mock.calls.map((call) => String(call[0])),
    });

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(harness.spies.fillTemplate).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('allow_derivatives=false'));
  });

  itFilling.openspec('OA-TMP-006')('reports missing required fields before template fill', async () => {
    const harness = await loadFillHarness({
      templateDir: '/templates/common-paper-mutual-nda',
      metadata: {
        name: 'Mutual NDA',
        allow_derivatives: true,
        required_fields: ['company_name', 'effective_date'],
      },
    });

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation(((code?: number) => {
        throw new Error(`EXIT_${code ?? 0}`);
      }) as never);

    await allureStep('Attempt fill with missing required fields', async () => {
      await expect(
        harness.runFill({ template: 'common-paper-mutual-nda', values: { company_name: 'Acme Corp' } })
      ).rejects.toThrow('EXIT_1');
    });

    await allureJsonAttachment('runFill-missing-required-fields.json', {
      stderrCalls: errorSpy.mock.calls.map((call) => String(call[0])),
      expectedMissing: ['effective_date'],
    });

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(harness.spies.fillTemplate).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Missing required fields: effective_date'));
  });

  itFilling.openspec('OA-TMP-012')('routes external IDs to external fill pipeline', async () => {
    const harness = await loadFillHarness({
      templateDir: undefined,
      externalDir: '/external/yc-safe-valuation-cap',
      recipeDir: undefined,
    });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await allureStep('Run fill for external ID', async () => {
      await harness.runFill({
        template: 'yc-safe-valuation-cap',
        output: '/tmp/ext-output.docx',
        values: { company_name: 'Acme Corp' },
      });
    });

    await allureJsonAttachment('runFill-external-route.json', {
      externalCall: harness.spies.runExternalFill.mock.calls[0]?.[0],
      logs: logSpy.mock.calls.map((call) => String(call[0])),
    });

    expect(harness.spies.runExternalFill).toHaveBeenCalledTimes(1);
    expect(harness.spies.fillTemplate).not.toHaveBeenCalled();
    expect(harness.spies.runRecipe).not.toHaveBeenCalled();
  });

  itFilling('routes recipe IDs to recipe pipeline', async () => {
    const harness = await loadFillHarness({
      templateDir: undefined,
      externalDir: undefined,
      recipeDir: '/recipes/nvca-voting-agreement',
    });

    await harness.runFill({
      template: 'nvca-voting-agreement',
      output: '/tmp/recipe-output.docx',
      values: { company_name: 'Acme Corp' },
    });

    expect(harness.spies.runRecipe).toHaveBeenCalledTimes(1);
    expect(harness.spies.runExternalFill).not.toHaveBeenCalled();
    expect(harness.spies.fillTemplate).not.toHaveBeenCalled();
  });

  itFilling('prints available IDs and exits when target cannot be resolved', async () => {
    const harness = await loadFillHarness({
      templateDir: undefined,
      externalDir: undefined,
      recipeDir: undefined,
      availableTemplateIds: ['common-paper-mutual-nda'],
      availableExternalIds: ['yc-safe-valuation-cap'],
      availableRecipeIds: ['nvca-voting-agreement'],
    });

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`EXIT_${code ?? 0}`);
    }) as never);

    await expect(
      harness.runFill({ template: 'does-not-exist', values: {} })
    ).rejects.toThrow('EXIT_1');

    expect(errorSpy).toHaveBeenCalledWith(
      'Agreement "does-not-exist" not found in templates, external, or recipes.'
    );
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Available: common-paper-mutual-nda, yc-safe-valuation-cap, nvca-voting-agreement')
    );
  });

  itFilling('reports runtime fill errors through command error channel', async () => {
    const harness = await loadFillHarness({
      templateDir: '/templates/common-paper-mutual-nda',
      metadata: {
        name: 'Mutual NDA',
        allow_derivatives: true,
        required_fields: [],
      },
      fillError: new Error('render failed'),
    });

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`EXIT_${code ?? 0}`);
    }) as never);

    await expect(
      harness.runFill({ template: 'common-paper-mutual-nda', values: {} })
    ).rejects.toThrow('EXIT_1');

    expect(errorSpy).toHaveBeenCalledWith('Error: render failed');
  });
});
