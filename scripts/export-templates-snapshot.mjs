/**
 * Export templates-snapshot.json — a build artifact for downstream consumers.
 *
 * This file is committed to version control so any consumer (websites, other
 * repos, third parties) can read it directly from GitHub without cloning,
 * installing dependencies, or compiling TypeScript.
 *
 * Usage:
 *   node scripts/export-templates-snapshot.mjs
 *   node scripts/export-templates-snapshot.mjs --check  (exits non-zero if snapshot is stale)
 */

import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SNAPSHOT_PATH = resolve(ROOT, 'data', 'templates-snapshot.json');
const CLI = resolve(ROOT, 'bin', 'open-agreements.js');

const isCheck = process.argv.includes('--check');

const raw = execFileSync('node', [CLI, 'list', '--json'], {
  encoding: 'utf-8',
  timeout: 30000,
  cwd: ROOT,
});

const fresh = JSON.stringify(JSON.parse(raw), null, 2) + '\n';

if (isCheck) {
  if (!existsSync(SNAPSHOT_PATH)) {
    console.error('data/templates-snapshot.json does not exist. Run: node scripts/export-templates-snapshot.mjs');
    process.exit(1);
  }
  const existing = readFileSync(SNAPSHOT_PATH, 'utf-8');
  if (existing !== fresh) {
    console.error('data/templates-snapshot.json is stale. Run: node scripts/export-templates-snapshot.mjs');
    process.exit(1);
  }
  console.log('data/templates-snapshot.json is up to date.');
  process.exit(0);
}

writeFileSync(SNAPSHOT_PATH, fresh, 'utf-8');
const data = JSON.parse(fresh);
console.log(`Exported ${data.items.length} templates to data/templates-snapshot.json`);
