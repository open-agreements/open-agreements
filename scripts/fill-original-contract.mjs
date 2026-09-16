#!/usr/bin/env node
/** Fill a locally verified canonical original. No network requests or sends. */
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { receiptMatches } from './export-original-contracts.mjs';
import { buildOriginalRuntime } from './build-original-contracts.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const options = { evidence: join(root, '.cache/original-contracts') };
for (let i = 0; i < args.length; i++) {
  const key = args[i].replace(/^--/, '');
  if (!['template', 'values', 'output', 'evidence'].includes(key) || !args[i].startsWith('--') || !args[i + 1]) {
    throw new Error(`Unknown or incomplete argument: ${args[i]}`);
  }
  if (key !== 'evidence' && options[key]) throw new Error(`Duplicate argument: --${key}`);
  options[key] = args[++i];
}
if (!options.template || !options.values || !options.output) {
  throw new Error('Usage: node scripts/fill-original-contract.mjs --template <id> --values <JSON> --output <DOCX> [--evidence <directory>]');
}
if (!/^openagreements-[a-z0-9-]+$/.test(options.template)) throw new Error('Invalid original template ID');
const matches = ['openagreements-cc-by-4.0', 'openagreements-cc0-1.0']
  .map(group => join(root, 'templates', group, options.template))
  .filter(path => existsSync(join(path, 'template.mdoc')));
if (matches.length !== 1) throw new Error(`Expected exactly one canonical original: ${options.template}`);
buildOriginalRuntime();
const { compileOriginalContract, fillOriginalContract } = await import('../dist/core/original-contract.js');
const contract = await compileOriginalContract(matches[0]);
const receiptPath = join(resolve(options.evidence), options.template, 'receipt.json');
let receipt;
try { receipt = JSON.parse(readFileSync(receiptPath, 'utf8')); } catch { /* fail closed below */ }
if (!receiptMatches(contract, receipt, matches[0], root)) {
  throw new Error(`Missing, failed, or stale verification: ${receiptPath}. Re-run the original-contract verification before filling.`);
}
const values = JSON.parse(readFileSync(resolve(options.values), 'utf8'));
const output = resolve(options.output);
if (existsSync(output)) throw new Error(`Refusing to overwrite existing output: ${output}`);
mkdirSync(dirname(output), { recursive: true });
const result = await fillOriginalContract(matches[0], contract, values, output);
console.log(JSON.stringify({
  template_id: options.template, output, verification_cases: receipt.summary.passed,
  fields_used: result.fieldsUsed, warnings: result.warnings,
  scope: 'Local canonical-renderer pilot; human review required before signing or publication.',
}, null, 2));
