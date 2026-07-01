import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, vi } from 'vitest';
import { itAllure } from './helpers/allure-test.js';

const it = itAllure.epic('Filling & Rendering');

const {
  runFieldSelectorMock,
  cleanDocumentMock,
  patchDocumentMock,
} = vi.hoisted(() => ({
  runFieldSelectorMock: vi.fn(),
  cleanDocumentMock: vi.fn(),
  patchDocumentMock: vi.fn(),
}));

vi.mock('../src/core/field-selector/index.js', () => ({
  runFieldSelector: runFieldSelectorMock,
  cleanDocument: cleanDocumentMock,
  patchDocument: patchDocumentMock,
}));

vi.mock('../src/core/field-selector/cleaner.js', () => ({
  cleanDocument: cleanDocumentMock,
}));

vi.mock('../src/core/field-selector/patcher.js', () => ({
  patchDocument: patchDocumentMock,
}));

import { runFieldSelectorCommand, runFieldSelectorClean, runFieldSelectorPatch } from '../src/commands/field-selector.js';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
  vi.restoreAllMocks();
  runFieldSelectorMock.mockReset();
  cleanDocumentMock.mockReset();
  patchDocumentMock.mockReset();
});

describe('fieldSelector commands', () => {
  it('runFieldSelectorCommand exits with available fieldSelector guidance when fieldSelector ID is missing', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`EXIT_${code ?? 0}`);
    }) as never);

    await expect(
      runFieldSelectorCommand({
        fieldSelectorId: 'missing-field-selector-id',
      })
    ).rejects.toThrow('EXIT_1');

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith('Field-selector "missing-field-selector-id" not found.');
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Available field-selectors:'));
    expect(runFieldSelectorMock).not.toHaveBeenCalled();
  });

  it('runFieldSelectorCommand omits inputPath to allow auto-download', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'oa-field-selector-auto-'));
    tempDirs.push(outDir);

    runFieldSelectorMock.mockResolvedValue({
      metadata: { name: 'NVCA Voting Agreement' },
      outputPath: join(outDir, 'out.docx'),
      fieldsUsed: ['company_name'],
    });

    await runFieldSelectorCommand({
      fieldSelectorId: 'nvca-voting-agreement',
      output: join(outDir, 'out.docx'),
      keepIntermediate: false,
    });

    expect(runFieldSelectorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        fieldSelectorId: 'nvca-voting-agreement',
        inputPath: undefined,
      })
    );
  });

  it('runFieldSelectorCommand defaults output path when --output is omitted', async () => {
    runFieldSelectorMock.mockResolvedValue({
      metadata: { name: 'NVCA Voting Agreement' },
      outputPath: '/tmp/nvca-voting-agreement-filled.docx',
      fieldsUsed: ['company_name'],
    });

    await runFieldSelectorCommand({
      fieldSelectorId: 'nvca-voting-agreement',
    });

    expect(runFieldSelectorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        outputPath: expect.stringContaining('nvca-voting-agreement-filled.docx'),
      })
    );
  });

  it('runFieldSelectorCommand forwards a user-supplied input path', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'oa-field-selector-input-'));
    tempDirs.push(outDir);
    const inputPath = join(outDir, 'source.docx');
    writeFileSync(inputPath, Buffer.from('docx-bytes'));

    runFieldSelectorMock.mockResolvedValue({
      metadata: { name: 'NVCA Voting Agreement' },
      outputPath: join(outDir, 'out.docx'),
      fieldsUsed: ['company_name'],
    });

    await runFieldSelectorCommand({
      fieldSelectorId: 'nvca-voting-agreement',
      input: inputPath,
      output: join(outDir, 'out.docx'),
    });

    expect(runFieldSelectorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        inputPath: inputPath,
      })
    );
  });

  it('runFieldSelectorCommand forwards keepIntermediate flag', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'oa-field-selector-keep-'));
    tempDirs.push(outDir);

    runFieldSelectorMock.mockResolvedValue({
      metadata: { name: 'NVCA Voting Agreement' },
      outputPath: join(outDir, 'out.docx'),
      fieldsUsed: ['company_name'],
    });

    await runFieldSelectorCommand({
      fieldSelectorId: 'nvca-voting-agreement',
      output: join(outDir, 'out.docx'),
      keepIntermediate: true,
    });

    expect(runFieldSelectorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        keepIntermediate: true,
      })
    );
  });

  it('runFieldSelectorCommand forwards computed artifact output path', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'oa-field-selector-computed-'));
    tempDirs.push(outDir);
    const computedOut = join(outDir, 'computed.json');

    runFieldSelectorMock.mockResolvedValue({
      metadata: { name: 'NVCA Voting Agreement' },
      outputPath: join(outDir, 'out.docx'),
      fieldsUsed: ['company_name'],
      computedOutPath: computedOut,
      computedArtifact: { profile_present: true },
    });

    await runFieldSelectorCommand({
      fieldSelectorId: 'nvca-voting-agreement',
      output: join(outDir, 'out.docx'),
      computedOut,
    });

    expect(runFieldSelectorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        computedOutPath: computedOut,
      })
    );
  });

  it('runFieldSelectorCommand parses values from --data JSON file', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'oa-field-selector-data-'));
    tempDirs.push(outDir);
    const dataPath = join(outDir, 'values.json');
    writeFileSync(
      dataPath,
      JSON.stringify({ company_name: 'Acme Corp', board_approved: true }, null, 2),
      'utf-8'
    );

    runFieldSelectorMock.mockResolvedValue({
      metadata: { name: 'NVCA Voting Agreement' },
      outputPath: join(outDir, 'out.docx'),
      fieldsUsed: ['company_name'],
    });

    await runFieldSelectorCommand({
      fieldSelectorId: 'nvca-voting-agreement',
      data: dataPath,
      output: join(outDir, 'out.docx'),
    });

    expect(runFieldSelectorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        values: { company_name: 'Acme Corp', board_approved: true },
      })
    );
  });

  it('runFieldSelectorCommand surfaces invalid JSON data payload errors', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'oa-field-selector-data-invalid-'));
    tempDirs.push(outDir);
    const dataPath = join(outDir, 'invalid-values.json');
    writeFileSync(dataPath, '{not valid json', 'utf-8');
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`EXIT_${code ?? 0}`);
    }) as never);

    await expect(
      runFieldSelectorCommand({
        fieldSelectorId: 'nvca-voting-agreement',
        data: dataPath,
      })
    ).rejects.toThrow(SyntaxError);

    expect(exitSpy).not.toHaveBeenCalled();
    expect(runFieldSelectorMock).not.toHaveBeenCalled();
  });

  it('runFieldSelectorCommand reports run errors through command error channel', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'oa-field-selector-error-'));
    tempDirs.push(outDir);

    runFieldSelectorMock.mockRejectedValue(new Error('fieldSelector run failed'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`EXIT_${code ?? 0}`);
    }) as never);

    await expect(
      runFieldSelectorCommand({
        fieldSelectorId: 'nvca-voting-agreement',
        output: join(outDir, 'out.docx'),
      })
    ).rejects.toThrow('EXIT_1');

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith('Error: fieldSelector run failed');
  });

  it('runFieldSelectorClean invokes cleanDocument with fieldSelector config', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'oa-field-selector-clean-'));
    tempDirs.push(outDir);
    const inputPath = join(outDir, 'source.docx');
    writeFileSync(inputPath, Buffer.from('docx-bytes'));

    cleanDocumentMock.mockResolvedValue(undefined);

    await runFieldSelectorClean({
      input: inputPath,
      output: join(outDir, 'cleaned.docx'),
      fieldSelector: 'nvca-voting-agreement',
    });

    expect(cleanDocumentMock).toHaveBeenCalledTimes(1);
    expect(cleanDocumentMock.mock.calls[0][0]).toContain('source.docx');
    expect(cleanDocumentMock.mock.calls[0][1]).toContain('cleaned.docx');
    expect(cleanDocumentMock.mock.calls[0][2]).toEqual(expect.objectContaining({ removeFootnotes: expect.any(Boolean) }));
  });

  it('runFieldSelectorClean writes extracted guidance when requested', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'oa-field-selector-guidance-'));
    tempDirs.push(outDir);
    const inputPath = join(outDir, 'source.docx');
    const outputPath = join(outDir, 'cleaned.docx');
    const extractGuidance = join(outDir, 'guidance.json');
    writeFileSync(inputPath, Buffer.from('docx-bytes'));

    cleanDocumentMock.mockResolvedValue({
      guidance: {
        extractedFrom: {
          sourceHash: 'source-hash',
          configHash: 'config-hash',
        },
        entries: [{ source: 'pattern', part: 'word/document.xml', index: 0, text: 'Remove this' }],
      },
    });

    await runFieldSelectorClean({
      input: inputPath,
      output: outputPath,
      fieldSelector: 'nvca-voting-agreement',
      extractGuidance,
    });

    const guidance = JSON.parse(readFileSync(extractGuidance, 'utf-8'));
    expect(guidance.entries).toHaveLength(1);
    expect(cleanDocumentMock).toHaveBeenCalledWith(
      expect.stringContaining('source.docx'),
      expect.stringContaining('cleaned.docx'),
      expect.any(Object),
      expect.objectContaining({
        extractGuidance: true,
        sourceHash: expect.any(String),
        configHash: expect.any(String),
      })
    );
  });

  it('runFieldSelectorClean computes extract guidance hashes when clean.json is absent', async () => {
    const rootDir = mkdtempSync(join(tmpdir(), 'oa-field-selector-root-no-clean-'));
    const fieldSelectorId = 'fixture-no-clean-config';
    const fieldSelectorDir = join(rootDir, 'field-selectors', fieldSelectorId);
    mkdirSync(fieldSelectorDir, { recursive: true });
    tempDirs.push(rootDir);

    const outDir = mkdtempSync(join(tmpdir(), 'oa-field-selector-clean-no-config-'));
    tempDirs.push(outDir);
    const inputPath = join(outDir, 'source.docx');
    const extractGuidance = join(outDir, 'guidance.json');
    writeFileSync(inputPath, Buffer.from('docx-bytes'));

    cleanDocumentMock.mockResolvedValue({
      guidance: {
        extractedFrom: {
          sourceHash: 'source-hash',
          configHash: 'config-hash',
        },
        entries: [],
      },
    });

    const prevRoots = process.env.OPEN_AGREEMENTS_CONTENT_ROOTS;
    process.env.OPEN_AGREEMENTS_CONTENT_ROOTS = rootDir;

    try {
      await runFieldSelectorClean({
        input: inputPath,
        output: join(outDir, 'cleaned.docx'),
        fieldSelector: fieldSelectorId,
        extractGuidance,
      });
    } finally {
      if (prevRoots === undefined) {
        delete process.env.OPEN_AGREEMENTS_CONTENT_ROOTS;
      } else {
        process.env.OPEN_AGREEMENTS_CONTENT_ROOTS = prevRoots;
      }
    }

    expect(cleanDocumentMock.mock.calls[0]?.[3]).toEqual(
      expect.objectContaining({
        extractGuidance: true,
        sourceHash: expect.any(String),
        configHash: expect.any(String),
      })
    );
  });

  it('runFieldSelectorClean reports cleaner errors', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'oa-field-selector-clean-error-'));
    tempDirs.push(outDir);
    const inputPath = join(outDir, 'source.docx');
    writeFileSync(inputPath, Buffer.from('docx-bytes'));

    cleanDocumentMock.mockRejectedValue(new Error('clean failed'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`EXIT_${code ?? 0}`);
    }) as never);

    await expect(
      runFieldSelectorClean({
        input: inputPath,
        output: join(outDir, 'cleaned.docx'),
        fieldSelector: 'nvca-voting-agreement',
      })
    ).rejects.toThrow('EXIT_1');

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith('Error: clean failed');
  });

  it('runFieldSelectorPatch invokes patchDocument with fieldSelector replacements', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'oa-field-selector-patch-'));
    tempDirs.push(outDir);
    const inputPath = join(outDir, 'source.docx');
    writeFileSync(inputPath, Buffer.from('docx-bytes'));

    patchDocumentMock.mockResolvedValue({ outputPath: '', zeroMatchKeys: [] });

    await runFieldSelectorPatch({
      input: inputPath,
      output: join(outDir, 'patched.docx'),
      fieldSelector: 'nvca-voting-agreement',
    });

    expect(patchDocumentMock).toHaveBeenCalledTimes(1);
    expect(patchDocumentMock.mock.calls[0][0]).toContain('source.docx');
    expect(patchDocumentMock.mock.calls[0][1]).toContain('patched.docx');
    expect(patchDocumentMock.mock.calls[0][2]).toEqual(expect.any(Object));
  });

  it('runFieldSelectorPatch reports patching errors', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'oa-field-selector-patch-error-'));
    tempDirs.push(outDir);
    const inputPath = join(outDir, 'source.docx');
    writeFileSync(inputPath, Buffer.from('docx-bytes'));

    patchDocumentMock.mockRejectedValue(new Error('patch failed'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`EXIT_${code ?? 0}`);
    }) as never);

    await expect(
      runFieldSelectorPatch({
        input: inputPath,
        output: join(outDir, 'patched.docx'),
        fieldSelector: 'nvca-voting-agreement',
      })
    ).rejects.toThrow('EXIT_1');

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith('Error: patch failed');
  });
});
