#!/usr/bin/env node
/**
 * Generate TypeScript interfaces from Concerto (.cto) models.
 *
 * Usage: node scripts/generate_concerto_types.mjs
 *
 * Reads all .cto files from concerto/ and generates TypeScript
 * interfaces in concerto/generated/.
 */
import { execSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const CONCERTO_DIR = 'concerto';
const OUTPUT_DIR = join(CONCERTO_DIR, 'generated');

const ctoFiles = readdirSync(CONCERTO_DIR).filter(f => f.endsWith('.cto'));

if (ctoFiles.length === 0) {
  console.log('No .cto files found in concerto/');
  process.exit(0);
}

const modelArgs = ctoFiles.map(f => `--model ${join(CONCERTO_DIR, f)}`).join(' ');

// Generate TypeScript
console.log(`Compiling ${ctoFiles.length} Concerto model(s) to TypeScript...`);
execSync(
  `npx @accordproject/concerto-cli compile ${modelArgs} --target TypeScript --output ${OUTPUT_DIR}`,
  { stdio: 'inherit' }
);

console.log(`Generated TypeScript interfaces in ${OUTPUT_DIR}/`);
