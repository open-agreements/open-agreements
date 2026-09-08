import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, vi } from 'vitest';
import {
  allureJsonAttachment,
  allureStep,
  itAllure,
} from './helpers/allure-test.js';

interface FillHarnessOptions {
  templateDir?: string;
  externalDir?: string;
  fieldSelectorDir?: string;
  availableTemplateIds?: string[];
  availableExternalIds?: string[];
  availableFieldSelectorIds?: string[];
  metadata?: {
    name: string;
    allow_derivatives: boolean;
    priority_fields: string[];
  };
  fillError?: Error;
  externalError?: Error;
  fieldSelectorError?: Error;
  warnings?: string[];
  isEmploymentTemplateId?: (templateId: string) => boolean;
  /** Route the template to the founder-separation memo family instead. */
  isFounderTemplateId?: (templateId: string) => boolean;
  memo?: Record<string, unknown>;
  memoMarkdown?: string;
}

interface FillHarness {
  runFill: (args: {
    template: string;
    output?: string;
    values: Record<string, string>;
    memo?: {
      enabled: boolean;
      format: 'json' | 'markdown' | 'both';
      jsonOutputPath?: string;
      markdownOutputPath?: string;
      jurisdiction?: string;
      baselineTemplateId?: string;
    };
  }) => Promise<void>;
  spies: {
    findTemplateDir: ReturnType<typeof vi.fn>;
    findExternalDir: ReturnType<typeof vi.fn>;
    findFieldSelectorDir: ReturnType<typeof vi.fn>;
    listTemplateIds: ReturnType<typeof vi.fn>;
    listExternalIds: ReturnType<typeof vi.fn>;
    listFieldSelectorIds: ReturnType<typeof vi.fn>;
    loadMetadata: ReturnType<typeof vi.fn>;
    fillTemplate: ReturnType<typeof vi.fn>;
    runExternalFill: ReturnType<typeof vi.fn>;
    runFieldSelector: ReturnType<typeof vi.fn>;
    generateEmploymentMemo: ReturnType<typeof vi.fn>;
    isEmploymentTemplateId: ReturnType<typeof vi.fn>;
    renderEmploymentMemoMarkdown: ReturnType<typeof vi.fn>;
    generateFounderMemo: ReturnType<typeof vi.fn>;
    renderFounderMemoMarkdown: ReturnType<typeof vi.fn>;
    resolveMemoDispatch: ReturnType<typeof vi.fn>;
  };
}

const itFilling = itAllure.epic('Filling & Rendering');
const itCompliance = itAllure.epic('Compliance & Governance');

async function loadFillHarness(opts: FillHarnessOptions = {}): Promise<FillHarness> {
  vi.resetModules();

  const findTemplateDir = vi.fn(() => opts.templateDir);
  const findExternalDir = vi.fn(() => opts.externalDir);
  const findFieldSelectorDir = vi.fn(() => opts.fieldSelectorDir);
  const listTemplateIds = vi.fn(() => opts.availableTemplateIds ?? []);
  const listExternalIds = vi.fn(() => opts.availableExternalIds ?? []);
  const listFieldSelectorIds = vi.fn(() => opts.availableFieldSelectorIds ?? []);

  const loadMetadata = vi.fn(() => opts.metadata ?? {
    name: 'Mock Template',
    allow_derivatives: true,
    priority_fields: ['company_name'],
  });

  const fillTemplate = vi.fn(async ({ outputPath }: { outputPath: string }) => {
    if (opts.fillError) throw opts.fillError;
    return {
      metadata: { name: 'Mock Template' },
      outputPath,
      fieldsUsed: ['company_name'],
      providedFieldsUsed: ['company_name'],
      fillCommandCount: 1,
      warnings: opts.warnings ?? [],
      verify: { passed: true, checks: [] },
    };
  });

  const runExternalFill = vi.fn(async ({ outputPath }: { outputPath: string }) => {
    if (opts.externalError) throw opts.externalError;
    return {
      metadata: { name: 'Mock External Template' },
      outputPath,
      fieldsUsed: ['company_name'],
      providedFieldsUsed: ['company_name'],
      fillCommandCount: 1,
      warnings: opts.warnings ?? [],
      stages: {},
    };
  });

  const runFieldSelector = vi.fn(async ({ outputPath }: { outputPath: string }) => {
    if (opts.fieldSelectorError) throw opts.fieldSelectorError;
    return {
      metadata: { name: 'Mock FieldSelector Template' },
      outputPath,
      fieldsUsed: ['company_name'],
      providedFieldsUsed: ['company_name'],
      fillCommandCount: 1,
      warnings: opts.warnings ?? [],
      stages: {},
    };
  });

  const isEmploymentTemplateId = vi.fn((templateId: string) => {
    if (opts.isEmploymentTemplateId) {
      return opts.isEmploymentTemplateId(templateId);
    }
    return templateId.includes('employment');
  });

  const generateEmploymentMemo = vi.fn((input: Record<string, unknown>) => {
    return opts.memo ?? {
      templateId: input.templateId,
      riskSummary: 'Low risk',
    };
  });

  const renderEmploymentMemoMarkdown = vi.fn(() => {
    return opts.memoMarkdown ?? '# Employment Memo\n\nNo additional risks.';
  });

  const isFounderTemplateId = vi.fn((templateId: string) =>
    opts.isFounderTemplateId ? opts.isFounderTemplateId(templateId) : false
  );

  const generateFounderMemo = vi.fn((input: Record<string, unknown>) => {
    return opts.memo ?? { templateId: input.templateId, matter_family: 'founder-separation' };
  });

  const renderFounderMemoMarkdown = vi.fn(() => {
    return opts.memoMarkdown ?? '# Founder Separation Companion Memo\n\nNo unresolved facts.';
  });

  // Mirrors the real family dispatch: founder first, then employment, else
  // unsupported. The command under test must route on the resolved family.
  const resolveMemoDispatch = vi.fn((templateId: string) => {
    if (isFounderTemplateId(templateId)) {
      return { family: 'founder-separation', templateId, profileId: templateId };
    }
    if (isEmploymentTemplateId(templateId)) {
      return { family: 'employment', templateId, profileId: templateId };
    }
    return undefined;
  });

  const buildUnsupportedMemoFamilyMessage = vi.fn(
    (templateId: string) =>
      `Memo generation is not available for template "${templateId}". Templates that support --memo: ...`
  );

  vi.doMock('../src/utils/paths.js', () => ({
    findTemplateDir,
    findExternalDir,
    findFieldSelectorDir,
    listTemplateIds,
    listExternalIds,
    listFieldSelectorIds,
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

  vi.doMock('../src/core/field-selector/index.js', () => ({
    runFieldSelector,
  }));

  vi.doMock('../src/core/employment/memo.js', () => ({
    generateEmploymentMemo,
    isEmploymentTemplateId,
    renderEmploymentMemoMarkdown,
  }));

  vi.doMock('../src/core/founder/memo.js', () => ({
    generateFounderMemo,
    isFounderTemplateId,
    renderFounderMemoMarkdown,
  }));

  vi.doMock('../src/core/memo/families.js', () => ({
    resolveMemoDispatch,
    buildUnsupportedMemoFamilyMessage,
  }));

  const { runFill } = await import('../src/commands/fill.js');

  return {
    runFill,
    spies: {
      findTemplateDir,
      findExternalDir,
      findFieldSelectorDir,
      listTemplateIds,
      listExternalIds,
      listFieldSelectorIds,
      loadMetadata,
      fillTemplate,
      runExternalFill,
      runFieldSelector,
      generateEmploymentMemo,
      isEmploymentTemplateId,
      renderEmploymentMemoMarkdown,
      generateFounderMemo,
      renderFounderMemoMarkdown,
      resolveMemoDispatch,
    },
  };
}

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
  vi.restoreAllMocks();
  vi.resetModules();
});

describe('runFill in-process coverage', () => {
  itFilling('prints structured patch warnings from each fill route', async () => {
    const warning = 'patch: 1 replacement key(s) had zero matches: [Unseen Carrier]';
    for (const route of ['templateDir', 'externalDir', 'fieldSelectorDir'] as const) {
      const harness = await loadFillHarness({ [route]: '/templates/example', warnings: [warning] });
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      vi.spyOn(console, 'log').mockImplementation(() => {});

      await harness.runFill({ template: 'example', values: { company_name: 'Acme Corp' } });

      expect(warnSpy).toHaveBeenCalledExactlyOnceWith(`Warning: ${warning}`);
      vi.restoreAllMocks();
    }
  });

  itFilling('fills a template path and defaults output filename', async () => {
    const harness = await loadFillHarness({
      templateDir: '/templates/common-paper-mutual-nda',
      metadata: {
        name: 'Mutual NDA',
        allow_derivatives: true,
        priority_fields: ['company_name'],
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

  itCompliance('blocks template fill when allow_derivatives is false', async () => {
    const harness = await loadFillHarness({
      templateDir: '/templates/restricted-template',
      metadata: {
        name: 'Restricted Template',
        allow_derivatives: false,
        priority_fields: ['company_name'],
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

  itFilling('warns about missing priority fields but continues fill', async () => {
    const harness = await loadFillHarness({
      templateDir: '/templates/common-paper-mutual-nda',
      metadata: {
        name: 'Mutual NDA',
        allow_derivatives: true,
        priority_fields: ['company_name', 'effective_date'],
      },
    });

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await allureStep('Fill with missing priority fields proceeds with warning', async () => {
      await harness.runFill({ template: 'common-paper-mutual-nda', values: { company_name: 'Acme Corp' } });
    });

    await allureJsonAttachment('runFill-missing-priority-fields.json', {
      warnCalls: warnSpy.mock.calls.map((call) => String(call[0])),
      expectedMissing: ['effective_date'],
    });

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('priority fields are unfilled'));
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('effective_date'));
    expect(harness.spies.fillTemplate).toHaveBeenCalled();
  });

  itFilling('routes external IDs to external fill pipeline', async () => {
    const harness = await loadFillHarness({
      templateDir: undefined,
      externalDir: '/external/yc-safe-valuation-cap',
      fieldSelectorDir: undefined,
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
    expect(harness.spies.runFieldSelector).not.toHaveBeenCalled();
  });

  itFilling('routes fieldSelector IDs to fieldSelector pipeline', async () => {
    const harness = await loadFillHarness({
      templateDir: undefined,
      externalDir: undefined,
      fieldSelectorDir: '/fieldSelectors/nvca-voting-agreement',
    });

    await harness.runFill({
      template: 'nvca-voting-agreement',
      output: '/tmp/field-selector-output.docx',
      values: { company_name: 'Acme Corp' },
    });

    expect(harness.spies.runFieldSelector).toHaveBeenCalledTimes(1);
    expect(harness.spies.runExternalFill).not.toHaveBeenCalled();
    expect(harness.spies.fillTemplate).not.toHaveBeenCalled();
  });

  itFilling('prints available IDs and exits when target cannot be resolved', async () => {
    const harness = await loadFillHarness({
      templateDir: undefined,
      externalDir: undefined,
      fieldSelectorDir: undefined,
      availableTemplateIds: ['common-paper-mutual-nda'],
      availableExternalIds: ['yc-safe-valuation-cap'],
      availableFieldSelectorIds: ['nvca-voting-agreement'],
    });

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`EXIT_${code ?? 0}`);
    }) as never);

    await expect(
      harness.runFill({ template: 'does-not-exist', values: {} })
    ).rejects.toThrow('EXIT_1');

    expect(errorSpy).toHaveBeenCalledWith(
      'Agreement "does-not-exist" not found in templates, external, or field-selectors.'
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
        priority_fields: [],
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

  itFilling('rejects memo generation for a template outside every memo family', async () => {
    const harness = await loadFillHarness({
      templateDir: '/templates/common-paper-mutual-nda',
      metadata: {
        name: 'Mutual NDA',
        allow_derivatives: true,
        priority_fields: [],
      },
      isEmploymentTemplateId: () => false,
    });

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`EXIT_${code ?? 0}`);
    }) as never);

    await expect(
      harness.runFill({
        template: 'common-paper-mutual-nda',
        values: {},
        memo: {
          enabled: true,
          format: 'json',
        },
      })
    ).rejects.toThrow('EXIT_1');

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(harness.spies.fillTemplate).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Memo generation is not available for template "common-paper-mutual-nda"')
    );
    // The error must point at what IS supported, not only at what is not.
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Templates that support --memo')
    );
  });

  itFilling('writes memo artifacts for a founder-separation template', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'oa-fill-founder-memo-'));
    tempDirs.push(outDir);
    const outputPath = join(outDir, 'repurchase-notice.docx');

    const harness = await loadFillHarness({
      templateDir: '/templates/openagreements-founder-share-repurchase-notice',
      metadata: {
        name: 'Founder Share Repurchase Election Notice',
        allow_derivatives: true,
        priority_fields: [],
      },
      isEmploymentTemplateId: () => false,
      isFounderTemplateId: (templateId) => templateId.startsWith('openagreements-founder-'),
      memo: { template_id: 'openagreements-founder-share-repurchase-notice', matter_family: 'founder-separation' },
      memoMarkdown: '# Founder Separation Companion Memo',
    });

    await harness.runFill({
      template: 'openagreements-founder-share-repurchase-notice',
      output: outputPath,
      values: {},
      memo: { enabled: true, format: 'both' },
    });

    expect(harness.spies.generateFounderMemo).toHaveBeenCalledTimes(1);
    expect(harness.spies.generateEmploymentMemo).not.toHaveBeenCalled();

    const jsonPath = outputPath.replace(/\.docx$/, '.memo.json');
    const markdownPath = outputPath.replace(/\.docx$/, '.memo.md');
    expect(existsSync(jsonPath)).toBe(true);
    expect(existsSync(markdownPath)).toBe(true);
    expect(JSON.parse(readFileSync(jsonPath, 'utf-8')).matter_family).toBe('founder-separation');
    expect(readFileSync(markdownPath, 'utf-8')).toContain('# Founder Separation Companion Memo');
  });

  itFilling('writes memo artifacts for employment templates with default output paths', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'oa-fill-memo-'));
    tempDirs.push(outDir);
    const outputPath = join(outDir, 'offer-letter.docx');
    const memoData = {
      templateId: 'openagreements-employment-offer-letter',
      riskSummary: 'Medium',
    };

    const harness = await loadFillHarness({
      templateDir: '/templates/openagreements-employment-offer-letter',
      metadata: {
        name: 'Employment Offer Letter',
        allow_derivatives: true,
        priority_fields: [],
      },
      isEmploymentTemplateId: (templateId) => templateId.startsWith('openagreements-employment'),
      memo: memoData,
      memoMarkdown: '# Memo\n\nGenerated memo content.',
    });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await harness.runFill({
      template: 'openagreements-employment-offer-letter',
      output: outputPath,
      values: { company_name: 'Acme Corp' },
      memo: {
        enabled: true,
        format: 'both',
      },
    });

    const expectedJsonPath = resolve(outDir, 'offer-letter.memo.json');
    const expectedMarkdownPath = resolve(outDir, 'offer-letter.memo.md');
    const memoJson = JSON.parse(readFileSync(expectedJsonPath, 'utf-8'));
    const memoMarkdown = readFileSync(expectedMarkdownPath, 'utf-8');

    expect(harness.spies.generateEmploymentMemo).toHaveBeenCalledTimes(1);
    expect(harness.spies.generateEmploymentMemo).toHaveBeenCalledWith(
      expect.objectContaining({
        templateId: 'openagreements-employment-offer-letter',
        jurisdiction: undefined,
      })
    );
    expect(harness.spies.renderEmploymentMemoMarkdown).toHaveBeenCalledWith(memoData);
    expect(memoJson).toEqual(memoData);
    expect(memoMarkdown).toContain('# Memo');
    expect(logSpy).toHaveBeenCalledWith(`Memo JSON: ${expectedJsonPath}`);
    expect(logSpy).toHaveBeenCalledWith(`Memo Markdown: ${expectedMarkdownPath}`);
  });

  itFilling('honors custom memo output path overrides', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'oa-fill-memo-custom-'));
    tempDirs.push(outDir);
    const outputPath = join(outDir, 'offer-letter.docx');
    const customJsonPath = join(outDir, 'custom-memo.json');

    const harness = await loadFillHarness({
      templateDir: '/templates/openagreements-employment-offer-letter',
      metadata: {
        name: 'Employment Offer Letter',
        allow_derivatives: true,
        priority_fields: [],
      },
      isEmploymentTemplateId: () => true,
      memo: { summary: 'Custom output path test' },
    });

    await harness.runFill({
      template: 'openagreements-employment-offer-letter',
      output: outputPath,
      values: { company_name: 'Acme Corp' },
      memo: {
        enabled: true,
        format: 'json',
        jsonOutputPath: customJsonPath,
      },
    });

    expect(() => JSON.parse(readFileSync(customJsonPath, 'utf-8'))).not.toThrow();
  });

  itFilling('supports markdown-only memo output without writing JSON', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'oa-fill-memo-markdown-only-'));
    tempDirs.push(outDir);
    const customMarkdownPath = join(outDir, 'memo-only.md');

    const harness = await loadFillHarness({
      templateDir: '/templates/openagreements-employment-offer-letter',
      metadata: {
        name: 'Employment Offer Letter',
        allow_derivatives: true,
        priority_fields: [],
      },
      isEmploymentTemplateId: () => true,
      memoMarkdown: '# Markdown only',
    });

    await harness.runFill({
      template: 'openagreements-employment-offer-letter',
      output: join(outDir, 'offer-letter.docx'),
      values: { company_name: 'Acme Corp' },
      memo: {
        enabled: true,
        format: 'markdown',
        markdownOutputPath: customMarkdownPath,
      },
    });

    expect(existsSync(customMarkdownPath)).toBe(true);
    expect(existsSync(join(outDir, 'offer-letter.memo.json'))).toBe(false);
  });

  itFilling('derives memo basename from output paths without file names', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'oa-fill-memo-root-output-'));
    tempDirs.push(outDir);
    const customJsonPath = join(outDir, 'root-derived.json');

    const harness = await loadFillHarness({
      templateDir: '/templates/openagreements-employment-offer-letter',
      metadata: {
        name: 'Employment Offer Letter',
        allow_derivatives: true,
        priority_fields: [],
      },
      isEmploymentTemplateId: () => true,
    });

    await harness.runFill({
      template: 'openagreements-employment-offer-letter',
      output: '/',
      values: { company_name: 'Acme Corp' },
      memo: {
        enabled: true,
        format: 'json',
        jsonOutputPath: customJsonPath,
      },
    });

    expect(existsSync(customJsonPath)).toBe(true);
  });
});
