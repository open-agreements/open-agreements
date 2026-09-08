/** Real-source validation smoke; outputs remain local, not finished documents. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const scratch = mkdtempSync(join(tmpdir(), 'oa-all-of-real-'));
const id = 'nvca-investors-rights-agreement';
const source = join(homedir(), '.open-agreements/cache', id, 'source.docx');
const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const sourceHash = hash(source);
assert.equal(sourceHash, 'be8ad13f171a343bdb53716b1d318689ae3477cdf7f1986b2e3985e1cabbd08a');
const recipe = join(scratch, 'templates/nvca-free-non-redistributable', id);
cpSync(join(root, 'templates/nvca-free-non-redistributable', id), recipe, { recursive: true });
const metadataPath = join(recipe, 'metadata.yaml');
const metadata = yaml.load(readFileSync(metadataPath, 'utf8'));
// Exercise the new contract on a real existing field and source; this temporary
// overlay is validation scaffolding, not a new legal requirement in the recipe.
metadata.fields.find(field => field.name === 'company_name').required_when = { all_of: [
  { field: 'include_standoff_pro_rata_release', equals: true },
  { field: 'include_standoff_discretionary_minimum_release', equals: true },
] };
writeFileSync(metadataPath, yaml.dump(metadata));
process.env.OPEN_AGREEMENTS_CONTENT_ROOTS = scratch;
const { runFieldSelector, extractAllText } = await import('../dist/core/field-selector/index.js');
const base = JSON.parse(readFileSync(join(root, 'integration-tests/fixtures/ira-production-full.json'), 'utf8'));
const values = { ...base, include_standoff_pro_rata_release: true, include_standoff_discretionary_minimum_release: true };
for (const company_name of [undefined, '', ' \t']) {
  const outputPath = join(scratch, `rejected-${String(company_name).length}.docx`);
  await assert.rejects(runFieldSelector({ fieldSelectorId: id, inputPath: source, outputPath,
    values: { ...values, company_name } }), error => error.code === 'INCOMPLETE_CONDITIONAL_INPUT' && error.fields.includes('company_name'));
  assert.equal(existsSync(outputPath), false);
}
const outputPath = join(scratch, 'filled.docx');
const result = await runFieldSelector({ fieldSelectorId: id, inputPath: source, outputPath, values });
assert.ok(extractAllText(outputPath).includes(base.company_name));
assert.equal(hash(source), sourceHash);
console.log(JSON.stringify({ result: 'PASS', source_sha256: sourceHash, output_sha256: hash(outputPath),
  rejected_before_output: 3, warnings: result.warnings, output_directory: scratch,
  scope: 'Validation-only temporary metadata overlay. Existing partial regression fixture and recipe warnings are not certified as a finished document.' }));
