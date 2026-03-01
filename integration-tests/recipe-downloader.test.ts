import { afterEach, describe, expect, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  allureJsonAttachment,
  allureStep,
  itAllure,
} from './helpers/allure-test.js';

interface DownloaderHarness {
  ensureSourceDocx: (recipeId: string, metadata: { name: string; source_url: string; source_sha256?: string }) => Promise<string>;
  homeDir: string;
}

const it = itAllure.epic('Filling & Rendering');
const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
  vi.unmock('node:os');
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.resetModules();
});

function sha256(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex');
}

function toArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

function cachePath(homeDir: string, recipeId: string): string {
  return join(homeDir, '.open-agreements', 'cache', recipeId, 'source.docx');
}

async function loadDownloaderHarness(): Promise<DownloaderHarness> {
  vi.resetModules();

  const homeDir = mkdtempSync(join(tmpdir(), 'oa-downloader-home-'));
  tempDirs.push(homeDir);

  vi.doMock('node:os', () => ({
    homedir: () => homeDir,
  }));

  const module = await import('../src/core/recipe/downloader.js');

  return {
    ensureSourceDocx: module.ensureSourceDocx,
    homeDir,
  };
}

describe('ensureSourceDocx cache and integrity behavior', () => {
  it('returns cached file when source_sha256 matches and avoids network fetch', async () => {
    const harness = await loadDownloaderHarness();
    const recipeId = 'fixture-recipe';
    const bytes = Buffer.from('cached-template-bytes');
    const path = cachePath(harness.homeDir, recipeId);
    mkdirSync(join(harness.homeDir, '.open-agreements', 'cache', recipeId), { recursive: true });
    writeFileSync(path, bytes);

    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await allureStep('Ensure source returns cached path', async () =>
      harness.ensureSourceDocx(recipeId, {
        name: 'Fixture Recipe',
        source_url: 'https://example.com/source.docx',
        source_sha256: sha256(bytes),
      })
    );

    await allureJsonAttachment('recipe-downloader-cache-hit.json', {
      result,
      cachePath: path,
      fetchCalls: fetchMock.mock.calls,
    });

    expect(result).toBe(path);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('re-downloads and replaces cache when cached hash mismatches expected hash', async () => {
    const harness = await loadDownloaderHarness();
    const recipeId = 'fixture-recipe';
    const staleBytes = Buffer.from('stale-cached-bytes');
    const freshBytes = Buffer.from('fresh-downloaded-bytes');
    const path = cachePath(harness.homeDir, recipeId);

    mkdirSync(join(harness.homeDir, '.open-agreements', 'cache', recipeId), { recursive: true });
    writeFileSync(path, staleBytes);

    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      arrayBuffer: async () => toArrayBuffer(freshBytes),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await harness.ensureSourceDocx(recipeId, {
      name: 'Fixture Recipe',
      source_url: 'https://example.com/source.docx',
      source_sha256: sha256(freshBytes),
    });

    const diskBytes = readFileSync(path);

    await allureJsonAttachment('recipe-downloader-cache-redownload.json', {
      result,
      cachePath: path,
      fetchCalls: fetchMock.mock.calls.length,
      staleHash: sha256(staleBytes),
      freshHash: sha256(freshBytes),
      diskHash: sha256(diskBytes),
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result).toBe(path);
    expect(diskBytes.equals(freshBytes)).toBe(true);
  });

  it('throws a clear download error on non-OK HTTP responses', async () => {
    const harness = await loadDownloaderHarness();

    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      harness.ensureSourceDocx('fixture-recipe', {
        name: 'Fixture Recipe',
        source_url: 'https://example.com/missing.docx',
      })
    ).rejects.toThrow('Failed to download fixture-recipe: HTTP 404 Not Found');

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('throws integrity mismatch when downloaded bytes do not match source_sha256', async () => {
    const harness = await loadDownloaderHarness();

    const downloaded = Buffer.from('downloaded-but-wrong-bytes');
    const expectedHash = sha256(Buffer.from('different-bytes'));

    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      arrayBuffer: async () => toArrayBuffer(downloaded),
    }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      harness.ensureSourceDocx('fixture-recipe', {
        name: 'Fixture Recipe',
        source_url: 'https://example.com/source.docx',
        source_sha256: expectedHash,
      })
    ).rejects.toThrow('Integrity check failed for fixture-recipe');

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('uses cached file without hash checks when source_sha256 is absent', async () => {
    const harness = await loadDownloaderHarness();
    const recipeId = 'fixture-recipe';
    const bytes = Buffer.from('cache-without-hash');
    const path = cachePath(harness.homeDir, recipeId);

    mkdirSync(join(harness.homeDir, '.open-agreements', 'cache', recipeId), { recursive: true });
    writeFileSync(path, bytes);

    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await harness.ensureSourceDocx(recipeId, {
      name: 'Fixture Recipe',
      source_url: 'https://example.com/source.docx',
    });

    await allureJsonAttachment('recipe-downloader-no-hash-cache.json', {
      result,
      exists: existsSync(result),
      fetchCalls: fetchMock.mock.calls.length,
    });

    expect(result).toBe(path);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
