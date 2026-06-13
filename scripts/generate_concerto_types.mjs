#!/usr/bin/env node
/**
 * Generate TypeScript interfaces from Concerto (.cto) models.
 *
 * Usage: node scripts/generate_concerto_types.mjs
 *
 * Reads all .cto files from concerto/ and generates TypeScript
 * interfaces in concerto/generated/. Uses vendored dependencies
 * from concerto/deps/ for offline builds.
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, existsSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const CONCERTO_DIR = 'concerto';
const DEPS_DIR = join(CONCERTO_DIR, 'deps');
const OUTPUT_DIR = join(CONCERTO_DIR, 'generated');

const ctoFiles = readdirSync(CONCERTO_DIR).filter(f => f.endsWith('.cto'));

if (ctoFiles.length === 0) {
  console.log('No .cto files found in concerto/');
  process.exit(0);
}

// Clean output directory
if (existsSync(OUTPUT_DIR)) {
  rmSync(OUTPUT_DIR, { recursive: true });
}
mkdirSync(OUTPUT_DIR, { recursive: true });

// Build model args as an argument array so file paths are never passed through
// a shell (avoids command injection from .cto file names).
const modelArgs = ctoFiles.flatMap(f => ['--model', join(CONCERTO_DIR, f)]);

// Include vendored deps if available
let depArgs = [];
if (existsSync(DEPS_DIR)) {
  // Exclude copies of source models (concerto get copies them into deps/)
  const sourceBasenames = new Set(ctoFiles);
  const depFiles = readdirSync(DEPS_DIR).filter(f => f.endsWith('.cto') && !sourceBasenames.has(f));
  depArgs = depFiles.flatMap(f => ['--model', join(DEPS_DIR, f)]);
}

// Generate TypeScript (offline if deps are vendored)
const offlineArgs = depArgs.length > 0 ? ['--offline'] : [];
console.log(`Compiling ${ctoFiles.length} Concerto model(s) to TypeScript...`);
execFileSync(
  'npx',
  [
    '-y', '@accordproject/concerto-cli@3.19.0', 'compile',
    ...modelArgs,
    ...depArgs,
    '--target', 'TypeScript',
    '--output', OUTPUT_DIR,
    ...offlineArgs,
  ],
  { stdio: 'inherit' }
);

console.log(`Generated TypeScript interfaces in ${OUTPUT_DIR}/`);
