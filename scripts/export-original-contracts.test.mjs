import { test } from 'vitest';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import canonicalize from 'canonicalize';
import { receiptMatches } from './export-original-contracts.mjs';
import { expectedOriginalCaseInventory } from './original-contract-cases.mjs';

const sha = value => createHash('sha256').update(value).digest('hex');
const digest = value => sha(canonicalize(value));

test('catalog promotion requires matching successful, complete, current evidence', () => {
  const root = mkdtempSync(join(tmpdir(), 'oa-catalog-proof-'));
  const template = join(root, 'original-fixture');
  try {
    mkdirSync(template);
    mkdirSync(join(root, 'scripts'));
    writeFileSync(join(template, 'template.mdoc'), 'source');
    writeFileSync(join(root, 'scripts/verify-original-contracts.ts'), 'verifier');
    writeFileSync(join(root, 'scripts/original-contract-cases.mjs'), 'case generator');
    const fields = [
      { name: 'name', type: 'string', description: 'Name' },
      { name: 'enabled', type: 'boolean', description: 'Choice', default: 'false' },
    ];
    const contract = { profile: 'fixture', sourceHashes: { mdoc: sha('source') },
      metadata: { fields, priority_fields: [] }, fields, publicFields: ['name', 'enabled'],
      bindings: [], sourceBindings: [], derivedGates: [], confirmClauses: [],
    };
    const inventory = expectedOriginalCaseInventory(contract);
    assert.equal(inventory.length, 3);
    const sourceFiles = { 'template.mdoc': sha('source') };
    const runtimeFiles = { 'scripts/verify-original-contracts.ts': sha('verifier'),
      'scripts/original-contract-cases.mjs': sha('case generator') };
    const receipt = {
      profile: 'oa-original-contract-verification-v1', template_id: 'original-fixture',
      status: 'verified', promotion: { eligible: true },
      compiled_contract_sha256: digest(contract),
      source: { digest: digest(sourceFiles), files: sourceFiles },
      runtime: { digest: digest(runtimeFiles), files: runtimeFiles },
      case_inventory_sha256: digest(inventory), coverage: { generated_cases: inventory.length },
      cases: inventory.map(item => ({ ...item, status: 'passed' })),
      summary: { passed: inventory.length, blocked: 0 },
    };
    assert.equal(receiptMatches(contract, receipt, template, root), true);
    assert.equal(receiptMatches(contract, undefined, template, root), false);
    for (const mutate of [
      value => { value.status = 'blocked'; },
      value => { value.promotion.eligible = false; },
      value => { value.cases[0].status = 'blocked'; },
      value => { value.summary.passed = 2; },
      value => { value.summary.blocked = 1; },
      value => { value.compiled_contract_sha256 = 'stale'; },
      value => { value.source.digest = 'stale'; },
      value => { value.template_id = 'other-template'; },
      value => { value.runtime.files = {}; },
      value => { value.source.files['../outside'] = sha('source'); },
      value => { value.coverage.generated_cases = 1; },
      value => { value.case_inventory_sha256 = 'stale'; },
      value => { value.cases.reverse(); },
      value => { value.cases[0].values_sha256 = 'wrong-inputs'; },
      value => {
        value.cases.pop(); value.summary.passed--; value.coverage.generated_cases--;
        value.case_inventory_sha256 = digest(value.cases.map(({ id, values_sha256 }) => ({ id, values_sha256 })));
      },
    ]) {
      const modified = structuredClone(receipt);
      mutate(modified);
      assert.equal(receiptMatches(contract, modified, template, root), false);
    }
    assert.equal(receiptMatches({ ...contract, tampered: true }, receipt, template, root), false);
    writeFileSync(join(root, 'scripts/verify-original-contracts.ts'), 'updated assertions');
    assert.equal(receiptMatches(contract, receipt, template, root), false);
    writeFileSync(join(root, 'scripts/verify-original-contracts.ts'), 'verifier');
    writeFileSync(join(root, 'scripts/original-contract-cases.mjs'), 'changed coverage');
    assert.equal(receiptMatches(contract, receipt, template, root), false);
    writeFileSync(join(root, 'scripts/original-contract-cases.mjs'), 'case generator');
    writeFileSync(join(template, 'template.mdoc'), 'upstream update');
    assert.equal(receiptMatches(contract, receipt, template, root), false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
