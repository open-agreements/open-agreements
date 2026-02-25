import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
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
});
