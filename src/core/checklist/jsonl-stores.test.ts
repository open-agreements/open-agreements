import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { appendJsonl, readJsonl } from './jsonl-stores.js';

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'oa-jsonl-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('jsonl-stores', () => {
  it('reads empty array from non-existent file', () => {
    expect(readJsonl('/tmp/nonexistent-oa-test.jsonl')).toEqual([]);
  });

  it('appends and reads records', async () => {
    const dir = makeTempDir();
    const filePath = join(dir, 'test.jsonl');

    await appendJsonl(filePath, { id: 1, name: 'first' });
    await appendJsonl(filePath, { id: 2, name: 'second' });

    const records = readJsonl<{ id: number; name: string }>(filePath);
    expect(records).toHaveLength(2);
    expect(records[0]).toEqual({ id: 1, name: 'first' });
    expect(records[1]).toEqual({ id: 2, name: 'second' });
  });

  it('creates parent directories automatically', async () => {
    const dir = makeTempDir();
    const filePath = join(dir, 'nested', 'deep', 'test.jsonl');

    await appendJsonl(filePath, { value: 42 });
    const records = readJsonl(filePath);
    expect(records).toHaveLength(1);
  });
});
