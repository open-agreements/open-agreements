import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, vi } from 'vitest';
import { itAllure } from './helpers/allure-test.js';

const it = itAllure.epic('Filling & Rendering');

const {
  runRecipeMock,
  cleanDocumentMock,
  patchDocumentMock,
} = vi.hoisted(() => ({
  runRecipeMock: vi.fn(),
  cleanDocumentMock: vi.fn(),
  patchDocumentMock: vi.fn(),
}));

vi.mock('../src/core/recipe/index.js', () => ({
  runRecipe: runRecipeMock,
  cleanDocument: cleanDocumentMock,
  patchDocument: patchDocumentMock,
}));

vi.mock('../src/core/recipe/cleaner.js', () => ({
  cleanDocument: cleanDocumentMock,
}));

vi.mock('../src/core/recipe/patcher.js', () => ({
  patchDocument: patchDocumentMock,
}));

import { runRecipeCommand, runRecipeClean, runRecipePatch } from '../src/commands/recipe.js';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
  vi.restoreAllMocks();
  runRecipeMock.mockReset();
  cleanDocumentMock.mockReset();
  patchDocumentMock.mockReset();
});

describe('recipe commands', () => {
  it('runRecipeCommand exits with available recipe guidance when recipe ID is missing', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`EXIT_${code ?? 0}`);
    }) as never);

    await expect(
      runRecipeCommand({
        recipeId: 'missing-recipe-id',
      })
    ).rejects.toThrow('EXIT_1');

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith('Recipe "missing-recipe-id" not found.');
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Available recipes:'));
    expect(runRecipeMock).not.toHaveBeenCalled();
  });

  it.openspec(['OA-RCP-001', 'OA-RCP-004'])('runRecipeCommand omits inputPath to allow auto-download', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'oa-recipe-auto-'));
    tempDirs.push(outDir);

    runRecipeMock.mockResolvedValue({
      metadata: { name: 'NVCA Voting Agreement' },
      outputPath: join(outDir, 'out.docx'),
      fieldsUsed: ['company_name'],
    });

    await runRecipeCommand({
      recipeId: 'nvca-voting-agreement',
      output: join(outDir, 'out.docx'),
      keepIntermediate: false,
    });

    expect(runRecipeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        recipeId: 'nvca-voting-agreement',
        inputPath: undefined,
      })
    );
  });

  it('runRecipeCommand defaults output path when --output is omitted', async () => {
    runRecipeMock.mockResolvedValue({
      metadata: { name: 'NVCA Voting Agreement' },
      outputPath: '/tmp/nvca-voting-agreement-filled.docx',
      fieldsUsed: ['company_name'],
    });

    await runRecipeCommand({
      recipeId: 'nvca-voting-agreement',
    });

    expect(runRecipeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        outputPath: expect.stringContaining('nvca-voting-agreement-filled.docx'),
      })
    );
  });

  it.openspec('OA-RCP-002')('runRecipeCommand forwards a user-supplied input path', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'oa-recipe-input-'));
    tempDirs.push(outDir);
    const inputPath = join(outDir, 'source.docx');
    writeFileSync(inputPath, Buffer.from('docx-bytes'));

    runRecipeMock.mockResolvedValue({
      metadata: { name: 'NVCA Voting Agreement' },
      outputPath: join(outDir, 'out.docx'),
      fieldsUsed: ['company_name'],
    });

    await runRecipeCommand({
      recipeId: 'nvca-voting-agreement',
      input: inputPath,
      output: join(outDir, 'out.docx'),
    });

    expect(runRecipeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        inputPath: inputPath,
      })
    );
  });

  it.openspec('OA-RCP-003')('runRecipeCommand forwards keepIntermediate flag', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'oa-recipe-keep-'));
    tempDirs.push(outDir);

    runRecipeMock.mockResolvedValue({
      metadata: { name: 'NVCA Voting Agreement' },
      outputPath: join(outDir, 'out.docx'),
      fieldsUsed: ['company_name'],
    });

    await runRecipeCommand({
      recipeId: 'nvca-voting-agreement',
      output: join(outDir, 'out.docx'),
      keepIntermediate: true,
    });

    expect(runRecipeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        keepIntermediate: true,
      })
    );
  });

  it.openspec('OA-RCP-023')('runRecipeCommand forwards computed artifact output path', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'oa-recipe-computed-'));
    tempDirs.push(outDir);
    const computedOut = join(outDir, 'computed.json');

    runRecipeMock.mockResolvedValue({
      metadata: { name: 'NVCA Voting Agreement' },
      outputPath: join(outDir, 'out.docx'),
      fieldsUsed: ['company_name'],
      computedOutPath: computedOut,
      computedArtifact: { profile_present: true },
    });

    await runRecipeCommand({
      recipeId: 'nvca-voting-agreement',
      output: join(outDir, 'out.docx'),
      computedOut,
    });

    expect(runRecipeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        computedOutPath: computedOut,
      })
    );
  });

  it('runRecipeCommand parses values from --data JSON file', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'oa-recipe-data-'));
    tempDirs.push(outDir);
    const dataPath = join(outDir, 'values.json');
    writeFileSync(
      dataPath,
      JSON.stringify({ company_name: 'Acme Corp', board_approved: true }, null, 2),
      'utf-8'
    );

    runRecipeMock.mockResolvedValue({
      metadata: { name: 'NVCA Voting Agreement' },
      outputPath: join(outDir, 'out.docx'),
      fieldsUsed: ['company_name'],
    });

    await runRecipeCommand({
      recipeId: 'nvca-voting-agreement',
      data: dataPath,
      output: join(outDir, 'out.docx'),
    });

    expect(runRecipeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        values: { company_name: 'Acme Corp', board_approved: true },
      })
    );
  });

  it('runRecipeCommand surfaces invalid JSON data payload errors', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'oa-recipe-data-invalid-'));
    tempDirs.push(outDir);
    const dataPath = join(outDir, 'invalid-values.json');
    writeFileSync(dataPath, '{not valid json', 'utf-8');
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`EXIT_${code ?? 0}`);
    }) as never);

    await expect(
      runRecipeCommand({
        recipeId: 'nvca-voting-agreement',
        data: dataPath,
      })
    ).rejects.toThrow(SyntaxError);

    expect(exitSpy).not.toHaveBeenCalled();
    expect(runRecipeMock).not.toHaveBeenCalled();
  });

  it('runRecipeCommand reports run errors through command error channel', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'oa-recipe-error-'));
    tempDirs.push(outDir);

    runRecipeMock.mockRejectedValue(new Error('recipe run failed'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`EXIT_${code ?? 0}`);
    }) as never);

    await expect(
      runRecipeCommand({
        recipeId: 'nvca-voting-agreement',
        output: join(outDir, 'out.docx'),
      })
    ).rejects.toThrow('EXIT_1');

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith('Error: recipe run failed');
  });

  it.openspec('OA-RCP-005')('runRecipeClean invokes cleanDocument with recipe config', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'oa-recipe-clean-'));
    tempDirs.push(outDir);
    const inputPath = join(outDir, 'source.docx');
    writeFileSync(inputPath, Buffer.from('docx-bytes'));

    cleanDocumentMock.mockResolvedValue(undefined);

    await runRecipeClean({
      input: inputPath,
      output: join(outDir, 'cleaned.docx'),
      recipe: 'nvca-voting-agreement',
    });

    expect(cleanDocumentMock).toHaveBeenCalledTimes(1);
    expect(cleanDocumentMock.mock.calls[0][0]).toContain('source.docx');
    expect(cleanDocumentMock.mock.calls[0][1]).toContain('cleaned.docx');
    expect(cleanDocumentMock.mock.calls[0][2]).toEqual(expect.objectContaining({ removeFootnotes: expect.any(Boolean) }));
  });

  it('runRecipeClean writes extracted guidance when requested', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'oa-recipe-guidance-'));
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

    await runRecipeClean({
      input: inputPath,
      output: outputPath,
      recipe: 'nvca-voting-agreement',
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

  it('runRecipeClean computes extract guidance hashes when clean.json is absent', async () => {
    const rootDir = mkdtempSync(join(tmpdir(), 'oa-recipe-root-no-clean-'));
    const recipeId = 'fixture-no-clean-config';
    const recipeDir = join(rootDir, 'content', 'recipes', recipeId);
    mkdirSync(recipeDir, { recursive: true });
    tempDirs.push(rootDir);

    const outDir = mkdtempSync(join(tmpdir(), 'oa-recipe-clean-no-config-'));
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
      await runRecipeClean({
        input: inputPath,
        output: join(outDir, 'cleaned.docx'),
        recipe: recipeId,
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

  it('runRecipeClean reports cleaner errors', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'oa-recipe-clean-error-'));
    tempDirs.push(outDir);
    const inputPath = join(outDir, 'source.docx');
    writeFileSync(inputPath, Buffer.from('docx-bytes'));

    cleanDocumentMock.mockRejectedValue(new Error('clean failed'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`EXIT_${code ?? 0}`);
    }) as never);

    await expect(
      runRecipeClean({
        input: inputPath,
        output: join(outDir, 'cleaned.docx'),
        recipe: 'nvca-voting-agreement',
      })
    ).rejects.toThrow('EXIT_1');

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith('Error: clean failed');
  });

  it.openspec('OA-RCP-006')('runRecipePatch invokes patchDocument with recipe replacements', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'oa-recipe-patch-'));
    tempDirs.push(outDir);
    const inputPath = join(outDir, 'source.docx');
    writeFileSync(inputPath, Buffer.from('docx-bytes'));

    patchDocumentMock.mockResolvedValue(undefined);

    await runRecipePatch({
      input: inputPath,
      output: join(outDir, 'patched.docx'),
      recipe: 'nvca-voting-agreement',
    });

    expect(patchDocumentMock).toHaveBeenCalledTimes(1);
    expect(patchDocumentMock.mock.calls[0][0]).toContain('source.docx');
    expect(patchDocumentMock.mock.calls[0][1]).toContain('patched.docx');
    expect(patchDocumentMock.mock.calls[0][2]).toEqual(expect.any(Object));
  });

  it('runRecipePatch reports patching errors', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'oa-recipe-patch-error-'));
    tempDirs.push(outDir);
    const inputPath = join(outDir, 'source.docx');
    writeFileSync(inputPath, Buffer.from('docx-bytes'));

    patchDocumentMock.mockRejectedValue(new Error('patch failed'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`EXIT_${code ?? 0}`);
    }) as never);

    await expect(
      runRecipePatch({
        input: inputPath,
        output: join(outDir, 'patched.docx'),
        recipe: 'nvca-voting-agreement',
      })
    ).rejects.toThrow('EXIT_1');

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith('Error: patch failed');
  });
});
