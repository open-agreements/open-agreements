#!/usr/bin/env node
/** Local, source-checkout catalog. Nothing is fetched, published, or deployed. */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import canonicalize from 'canonicalize';
import { buildOriginalRuntime } from './build-original-contracts.mjs';
import { expectedOriginalCaseInventory } from './original-contract-cases.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sha = value => createHash('sha256').update(value).digest('hex');
const digest = value => sha(canonicalize(value));

function matchingFiles(base, files) {
  if (!files || typeof files !== 'object' || !Object.keys(files).length) return false;
  return Object.entries(files).every(([name, hash]) => {
    const path = resolve(base, name);
    const rel = relative(base, path);
    return !isAbsolute(name) && rel !== '..' && !rel.startsWith('../') &&
      existsSync(path) && sha(readFileSync(path)) === hash;
  });
}

/** Fail closed on absent, stale, incomplete, or unsuccessful local evidence. */
export function receiptMatches(contract, receipt, templateDir, root = ROOT) {
  try {
    const expected = expectedOriginalCaseInventory(contract);
    const actual = receipt?.cases?.map(item => ({ id: item.id, values_sha256: item.values_sha256 }));
    return receipt?.profile === 'oa-original-contract-verification-v1' &&
      receipt.template_id === basename(templateDir) &&
      receipt.status === 'verified' && receipt.promotion?.eligible === true &&
      receipt.compiled_contract_sha256 === digest(contract) &&
      receipt.summary?.blocked === 0 && receipt.summary?.passed > 0 &&
      Array.isArray(receipt.cases) && receipt.cases.length === receipt.summary.passed &&
      receipt.coverage?.generated_cases === expected.length &&
      expected.length > 0 && new Set(expected.map(item => item.id)).size === expected.length &&
      receipt.case_inventory_sha256 === digest(expected) &&
      canonicalize(actual) === canonicalize(expected) &&
      receipt.cases.every(item => item.status === 'passed') &&
      matchingFiles(templateDir, receipt.source?.files) &&
      matchingFiles(root, receipt.runtime?.files) &&
      receipt.source.digest === digest(receipt.source.files) &&
      receipt.runtime.digest === digest(receipt.runtime.files) &&
      receipt.runtime.files['scripts/verify-original-contracts.ts'] ===
        sha(readFileSync(join(root, 'scripts/verify-original-contracts.ts'))) &&
      receipt.runtime.files['scripts/original-contract-cases.mjs'] ===
        sha(readFileSync(join(root, 'scripts/original-contract-cases.mjs')));
  } catch { return false; }
}

export async function exportOriginalCatalog({ outputDir, evidenceDir, verifiedOnly = false }) {
  // Build must have succeeded first. This experimental renderer requires the
  // source checkout; it is not an independently portable/npm-distributed pack.
  buildOriginalRuntime();
  const { compileOriginalContract } = await import('../dist/core/original-contract.js');
  const output = resolve(outputDir);
  const evidence = resolve(evidenceDir);
  mkdirSync(join(output, 'contracts'), { recursive: true });
  const entries = [];
  const seen = new Set();
  for (const group of ['openagreements-cc-by-4.0', 'openagreements-cc0-1.0']) {
    const parent = join(ROOT, 'templates', group);
    for (const entry of readdirSync(parent, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (!entry.isDirectory()) throw new Error(`Unexpected originals entry: ${group}/${entry.name}`);
      const id = entry.name;
      if (!/^[a-z0-9-]+$/.test(id) || seen.has(id)) throw new Error(`Invalid/duplicate ID: ${id}`);
      seen.add(id);
      const templateDir = join(parent, id);
      try {
        const contract = await compileOriginalContract(templateDir);
        const receiptPath = join(evidence, id, 'receipt.json');
        let receipt;
        try { receipt = JSON.parse(readFileSync(receiptPath, 'utf8')); } catch { /* unverified */ }
        const verified = receiptMatches(contract, receipt, templateDir);
        const manifest = `contracts/${id}.json`;
        writeFileSync(join(output, manifest), `${JSON.stringify(contract, null, 2)}\n`);
        entries.push({
          template_id: id, name: contract.metadata.name, category: contract.metadata.category,
          description: contract.metadata.description, license: contract.license,
          version: contract.metadata.version, stability: contract.metadata.stability ?? 'experimental',
          status: verified ? 'verified' : 'compiled-unverified',
          requires_source_checkout: true, standalone_portable: false,
          rendering_notes: contract.renderingNotes,
          contract: manifest, contract_sha256: digest(contract),
          canonical_field_count: contract.fields.length, public_field_count: contract.publicFields.length,
          public_fields: contract.publicFields,
          // ai_only is a source projection label, not a reason to discard inputs
          // needed for correct conditions. Consumers must expose/collect these.
          canonical_input_fields: contract.fields.filter(field => !field.derived && !field.derived_gate),
          source: relative(ROOT, templateDir),
          ...(verified ? { verification: { cases: receipt.summary.passed, coverage: receipt.coverage,
            receipt: relative(output, receiptPath) } } : {}),
        });
      } catch (error) {
        entries.push({ template_id: id, status: 'blocked', reason: error.message });
      }
    }
  }
  const summary = {
    discovered: entries.length,
    verified: entries.filter(entry => entry.status === 'verified').length,
    compiled_unverified: entries.filter(entry => entry.status === 'compiled-unverified').length,
    blocked: entries.filter(entry => entry.status === 'blocked').length,
  };
  const catalog = {
    profile: 'oa-original-local-catalog-v1', summary,
    scope: 'OpenAgreements originals; local source-checkout pilot, not a published Stella integration',
    selection_guidance: 'Use each source description and field help; this catalog does not make a legal suitability determination.',
    verified_only: verifiedOnly,
    entries: verifiedOnly ? entries.filter(entry => entry.status === 'verified') : entries,
  };
  writeFileSync(join(output, 'catalog.json'), `${JSON.stringify(catalog, null, 2)}\n`);
  return catalog;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  let outputDir = join(ROOT, '.cache/original-contracts/export');
  let evidenceDir = join(ROOT, '.cache/original-contracts');
  let verifiedOnly = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--verified-only') verifiedOnly = true;
    else if (args[i] === '--output' && args[i + 1]) outputDir = args[++i];
    else if (args[i] === '--evidence' && args[i + 1]) evidenceDir = args[++i];
    else throw new Error(`Unknown or incomplete argument: ${args[i]}`);
  }
  const result = await exportOriginalCatalog({ outputDir, evidenceDir, verifiedOnly });
  console.log(JSON.stringify(result.summary));
  if (result.summary.blocked) process.exitCode = 1;
}
