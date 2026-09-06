import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Run after compilation and before staging/publishing. A copied declaration
// must not claim capabilities absent from the actual built runtime.
const root = resolve(process.argv[2] ?? '.');
const declared = JSON.parse(readFileSync(resolve(root, 'runtime-capabilities.json'), 'utf8'));
const { RUNTIME_CAPABILITIES } = await import(pathToFileURL(resolve(root, 'dist/core/runtime-capabilities.js')));
assert.deepEqual(declared, RUNTIME_CAPABILITIES, 'runtime-capabilities.json does not match the built runtime');
console.log('Runtime capability declaration matches built runtime.');
