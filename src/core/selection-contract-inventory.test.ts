import { it, expect } from 'vitest';
import { readdirSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { compileSelectionContract } from './selection-contract.js';
import { seconds } from '../../integration-tests/helpers/timeouts.js';

it('records bounded compiler coverage without promoting unverified candidates', async () => {
  const rows: { path: string; status: string; reason?: string }[] = [];
  const walk = async (path: string): Promise<void> => {
    if (existsSync(join(path, 'metadata.yaml'))) {
      try {
        await compileSelectionContract(path);
        rows.push({ path, status: 'compiled-unverified' });
      } catch (e) {
        rows.push({ path, status: 'blocked', reason: String(e) });
      }
      return;
    }
    for (const entry of readdirSync(path, { withFileTypes: true })) if (entry.isDirectory()) await walk(join(path, entry.name));
  };
  await walk(resolve('templates'));
  mkdirSync('.cache/common-paper-declarative', { recursive: true });
  writeFileSync('.cache/common-paper-declarative/inventory.json', JSON.stringify(rows, null, 2));
  console.log(rows.filter(r => r.status === 'compiled-unverified'));
  expect(rows.length).toBeGreaterThan(50);
// This is a whole-corpus scan, not a five-second microbenchmark. Keep a finite
// budget that scales with the existing coverage-run timeout mechanism.
}, seconds(30));
