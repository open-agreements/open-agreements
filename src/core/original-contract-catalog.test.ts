import { mkdirSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtempSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadMetadata, type FieldDefinition, type TemplateMetadata } from './metadata.js';
import { compileOriginalContract } from './original-contract.js';
import {
  discoverOriginalTemplateDirs,
  generateVerificationCases,
  ORIGINALS_ROOTS,
  verifyOriginalCatalog,
} from '../../scripts/verify-original-contracts.js';
import {
  expectedOriginalCaseInventory,
  generateOriginalVerificationCases,
} from '../../scripts/original-contract-cases.mjs';

describe('OpenAgreements original contract catalog', () => {
  it('discovers every filesystem template directory and fails closed on incomplete entries', () => {
    const discovered = discoverOriginalTemplateDirs();
    expect(discovered.length).toBeGreaterThan(0);
    expect(discovered).toHaveLength(81);
    expect(discovered.map((dir) => basename(dir))).toContain('openagreements-privacy-policy');
    expect(new Set(discovered).size).toBe(discovered.length);

    const fixture = mkdtempSync(join(tmpdir(), 'oa-original-discovery-'));
    mkdirSync(join(fixture, 'complete'));
    writeFileSync(join(fixture, 'complete', 'metadata.yaml'), 'name: fixture\n');
    writeFileSync(join(fixture, 'complete', 'template.mdoc'), 'fixture\n');
    writeFileSync(join(fixture, 'complete', 'template.docx'), 'not relevant to discovery\n');
    mkdirSync(join(fixture, 'incomplete'));
    writeFileSync(join(fixture, 'incomplete', 'metadata.yaml'), 'name: incomplete\n');
    expect(() => discoverOriginalTemplateDirs(fixture)).toThrow(/incomplete.*template\.mdoc/);
  });

  it('compiles all 81 discovered templates but keeps each unverified until evidence passes', async () => {
    const discovered = discoverOriginalTemplateDirs();
    for (const templateDir of discovered) {
      const contract = await compileOriginalContract(templateDir);
      expect(contract.profile, basename(templateDir)).toBe('oa-original-source-contract-v1');
      expect(contract.status, basename(templateDir)).toBe('compiled-unverified');
      expect(contract.metadata.fields, basename(templateDir)).toEqual(loadMetadata(templateDir).fields);
    }
  }, 120_000);

  it('generates bounded typed cases recursively, including safe attestation handling', () => {
    const fields: FieldDefinition[] = [
      { name: 'choice', type: 'enum', description: 'choice', options: ['a', 'b'] },
      { name: 'flag', type: 'boolean', description: 'flag' },
      {
        name: 'confirmed', type: 'boolean', description: 'real fact', default: 'false',
        statutory_compliance_representation: true,
        authority_url: 'https://example.test/law', confirm_note: 'verify the real fact',
      },
      {
        name: 'rows', type: 'array', description: 'rows',
        items: [{ name: 'label', type: 'string', description: 'label' }],
      },
    ];
    const metadata = { fields, priority_fields: [] } as unknown as TemplateMetadata;
    const cases = generateVerificationCases(metadata);
    expect(cases.some((item) => item.values.choice === 'a')).toBe(true);
    expect(cases.some((item) => item.values.choice === 'b')).toBe(true);
    expect(cases.some((item) => item.values.flag === false)).toBe(true);
    expect(cases.some((item) => item.values.flag === true)).toBe(true);
    expect(cases.every((item) => item.values.confirmed === false)).toBe(true);
    expect(new Set(cases.map((item) => (item.values.rows as unknown[]).length))).toEqual(new Set([0, 1, 2]));
    const twoRows = cases.find((item) => (item.values.rows as unknown[]).length === 2)!;
    expect(twoRows.values.rows).toEqual([
      { label: expect.stringContaining('ROW_1') },
      { label: expect.stringContaining('ROW_2') },
    ]);
  });

  it('plans canonical scalar branches from source bindings and inventories every exact input', async () => {
    const privacyDir = discoverOriginalTemplateDirs().find((dir) => basename(dir) === 'openagreements-privacy-policy')!;
    const contract = await compileOriginalContract(privacyDir);
    const cases = generateOriginalVerificationCases(contract);
    expect(cases.map((item) => item.id)).toEqual(expect.arrayContaining([
      'branch-sensitive_data_categories-empty',
      'branch-sensitive_data_categories-present',
    ]));
    const inventory = expectedOriginalCaseInventory(contract);
    expect(inventory).toHaveLength(cases.length);
    expect(inventory.map((item) => item.id)).toEqual(cases.map((item) => item.id));
    expect(inventory.every((item) => /^[a-f0-9]{64}$/.test(item.values_sha256))).toBe(true);
  });

  it.runIf(process.env.RUN_ORIGINAL_CONTRACT_EVIDENCE === '1')(
    'produces passing, revision-tied evidence for the entire discovered catalog',
    async () => {
      const output = mkdtempSync(join(tmpdir(), 'oa-original-evidence-'));
      const receipts = await verifyOriginalCatalog(ORIGINALS_ROOTS, output);
      expect(receipts).toHaveLength(discoverOriginalTemplateDirs().length);
      expect(receipts.every((receipt) => receipt.status === 'verified')).toBe(true);
      expect(receipts.every((receipt) => receipt.promotion.eligible)).toBe(true);
      expect(receipts.every((receipt) => receipt.source.digest.length === 64)).toBe(true);
      expect(receipts.every((receipt) => receipt.runtime.digest.length === 64)).toBe(true);
    },
    900_000,
  );
});
