import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect } from 'vitest';
import { itAllure } from '../../../integration-tests/helpers/allure-test.js';
import { FilesystemProvider } from '../src/core/filesystem-provider.js';
import { MemoryProvider } from '../src/core/memory-provider.js';
import type { WorkspaceProvider } from '../src/core/provider.js';

const tempDirs: string[] = [];
const it = itAllure.epic('Platform & Distribution');

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function createFilesystemProvider(): { provider: FilesystemProvider; root: string } {
  const root = mkdtempSync(join(tmpdir(), 'oa-provider-'));
  tempDirs.push(root);
  return { provider: new FilesystemProvider(root), root };
}

function createMemoryProvider(): { provider: MemoryProvider; root: string } {
  const provider = new MemoryProvider('/test-workspace');
  return { provider, root: '/test-workspace' };
}

describe('FilesystemProvider', () => {
  it('exists returns false for missing paths and true after mkdir', () => {
    const { provider } = createFilesystemProvider();
    expect(provider.exists('forms')).toBe(false);
    provider.mkdir('forms');
    expect(provider.exists('forms')).toBe(true);
  });

  it('writeFile and readTextFile round-trip correctly', () => {
    const { provider } = createFilesystemProvider();
    provider.mkdir('drafts');
    provider.writeFile('drafts/test.txt', 'hello world');
    expect(provider.readTextFile('drafts/test.txt')).toBe('hello world');
  });

  it('readFile returns a Buffer', () => {
    const { provider } = createFilesystemProvider();
    provider.mkdir('forms');
    provider.writeFile('forms/binary.bin', Buffer.from([0x00, 0x01, 0x02]));
    const content = provider.readFile('forms/binary.bin');
    expect(Buffer.isBuffer(content)).toBe(true);
    expect(content.length).toBe(3);
  });

  it('mkdir with recursive creates nested directories', () => {
    const { provider } = createFilesystemProvider();
    provider.mkdir('forms/corporate/sub', { recursive: true });
    expect(provider.exists('forms/corporate/sub')).toBe(true);
  });

  it('readdir lists directory entries', () => {
    const { provider } = createFilesystemProvider();
    provider.mkdir('executed');
    provider.writeFile('executed/a.docx', 'a');
    provider.writeFile('executed/b.docx', 'b');
    const entries = provider.readdir('executed');
    const names = entries.map((e) => e.name).sort();
    expect(names).toEqual(['a.docx', 'b.docx']);
    expect(entries.every((e) => !e.isDirectory)).toBe(true);
  });

  it('stat returns correct FileInfo', () => {
    const { provider } = createFilesystemProvider();
    provider.mkdir('archive');
    provider.writeFile('archive/contract.pdf', 'pdf-bytes');
    const info = provider.stat('archive/contract.pdf');
    expect(info.name).toBe('contract.pdf');
    expect(info.isDirectory).toBe(false);
    expect(info.size).toBeGreaterThan(0);
    expect(info.mtime).toBeInstanceOf(Date);
  });

  it('walk recursively finds all files', () => {
    const { provider } = createFilesystemProvider();
    provider.mkdir('forms/corporate', { recursive: true });
    provider.writeFile('forms/corporate/nda.docx', 'nda');
    provider.writeFile('forms/corporate/msa.docx', 'msa');
    provider.mkdir('forms/finance', { recursive: true });
    provider.writeFile('forms/finance/safe.docx', 'safe');

    const files = provider.walk('forms');
    const names = files.map((f) => f.name).sort();
    expect(names).toEqual(['msa.docx', 'nda.docx', 'safe.docx']);
    expect(files.every((f) => !f.isDirectory)).toBe(true);
  });

  it('walk returns empty array for ENOENT', () => {
    const { provider } = createFilesystemProvider();
    expect(provider.walk('nonexistent')).toEqual([]);
  });
});

describe('MemoryProvider', () => {
  it('exists returns false for missing paths', () => {
    const { provider } = createMemoryProvider();
    expect(provider.exists('forms')).toBe(false);
  });

  it('seed creates file and parent directories', () => {
    const { provider } = createMemoryProvider();
    provider.seed('forms/corporate/nda.docx', 'NDA content');
    expect(provider.exists('forms')).toBe(true);
    expect(provider.exists('forms/corporate')).toBe(true);
    expect(provider.exists('forms/corporate/nda.docx')).toBe(true);
    expect(provider.readTextFile('forms/corporate/nda.docx')).toBe('NDA content');
  });

  it('writeFile and readTextFile round-trip', () => {
    const { provider } = createMemoryProvider();
    provider.mkdir('drafts');
    provider.writeFile('drafts/test.txt', 'hello');
    expect(provider.readTextFile('drafts/test.txt')).toBe('hello');
  });

  it('readFile throws ENOENT for missing files', () => {
    const { provider } = createMemoryProvider();
    expect(() => provider.readFile('missing.txt')).toThrow(/ENOENT/);
  });

  it('mkdir with recursive creates nested directories', () => {
    const { provider } = createMemoryProvider();
    provider.mkdir('a/b/c', { recursive: true });
    expect(provider.exists('a')).toBe(true);
    expect(provider.exists('a/b')).toBe(true);
    expect(provider.exists('a/b/c')).toBe(true);
  });

  it('readdir lists files and subdirectories', () => {
    const { provider } = createMemoryProvider();
    provider.seed('forms/corporate/nda.docx', 'nda');
    provider.seed('forms/finance/safe.docx', 'safe');
    provider.seed('forms/readme.md', 'readme');

    const entries = provider.readdir('forms');
    const names = entries.map((e) => e.name).sort();
    expect(names).toEqual(['corporate', 'finance', 'readme.md']);

    const dirs = entries.filter((e) => e.isDirectory).map((e) => e.name).sort();
    expect(dirs).toEqual(['corporate', 'finance']);

    const files = entries.filter((e) => !e.isDirectory).map((e) => e.name);
    expect(files).toEqual(['readme.md']);
  });

  it('stat returns correct info for files and directories', () => {
    const { provider } = createMemoryProvider();
    provider.mkdir('executed');
    provider.seed('executed/signed.pdf', 'pdf-data');

    const dirStat = provider.stat('executed');
    expect(dirStat.isDirectory).toBe(true);

    const fileStat = provider.stat('executed/signed.pdf');
    expect(fileStat.isDirectory).toBe(false);
    expect(fileStat.name).toBe('signed.pdf');
    expect(fileStat.size).toBe(Buffer.from('pdf-data').length);
  });

  it('stat throws ENOENT for missing paths', () => {
    const { provider } = createMemoryProvider();
    expect(() => provider.stat('nope')).toThrow(/ENOENT/);
  });

  it('walk recursively finds all files', () => {
    const { provider } = createMemoryProvider();
    provider.seed('forms/corporate/nda.docx', 'nda');
    provider.seed('forms/finance/safe.docx', 'safe');
    provider.seed('forms/readme.md', 'readme');

    const files = provider.walk('forms');
    const paths = files.map((f) => f.relativePath).sort();
    expect(paths).toEqual([
      'forms/corporate/nda.docx',
      'forms/finance/safe.docx',
      'forms/readme.md',
    ]);
  });

  it('walk returns empty for nonexistent directory', () => {
    const { provider } = createMemoryProvider();
    expect(provider.walk('nonexistent')).toEqual([]);
  });
});

describe('MemoryProvider works with initializeWorkspace', () => {
  it('can initialize a workspace entirely in memory', async () => {
    const { initializeWorkspace } = await import('../src/core/workspace-structure.js');
    const provider = new MemoryProvider('/mem-ws');
    const result = initializeWorkspace('/mem-ws', { agents: ['claude'] }, provider);

    expect(result.createdFiles).toContain('CONTRACTS.md');
    expect(result.createdFiles).toContain('forms-catalog.yaml');
    // Lifecycle dirs are not auto-created
    expect(provider.exists('forms')).toBe(false);
    expect(provider.exists('executed')).toBe(false);
    expect(provider.exists('CONTRACTS.md')).toBe(true);
    expect(provider.readTextFile('CONTRACTS.md')).toContain('CONTRACTS.md');
  });
});
