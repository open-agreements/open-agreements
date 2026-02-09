import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { readdirSync, existsSync } from 'node:fs';
import { ExternalMetadataSchema } from '../src/core/metadata.js';
import { validateExternal } from '../src/core/validation/external.js';

const ROOT = new URL('..', import.meta.url).pathname;
const BIN = join(ROOT, 'bin/open-agreements.js');
const EXTERNAL_DIR = join(ROOT, 'external');

describe('ExternalMetadataSchema', () => {
  it('accepts valid external metadata', () => {
    const result = ExternalMetadataSchema.safeParse({
      name: 'Test SAFE',
      source_url: 'https://example.com/safe',
      version: '1.0',
      license: 'CC-BY-ND-4.0',
      allow_derivatives: false,
      attribution_text: 'Based on Example SAFE',
      source_sha256: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      fields: [],
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing source_sha256', () => {
    const result = ExternalMetadataSchema.safeParse({
      name: 'Test SAFE',
      source_url: 'https://example.com/safe',
      version: '1.0',
      license: 'CC-BY-ND-4.0',
      allow_derivatives: false,
      attribution_text: 'Based on Example SAFE',
      fields: [],
    });
    expect(result.success).toBe(false);
  });

  it('accepts CC-BY-ND-4.0 license', () => {
    const result = ExternalMetadataSchema.safeParse({
      name: 'Test',
      source_url: 'https://example.com',
      version: '1.0',
      license: 'CC-BY-ND-4.0',
      allow_derivatives: false,
      attribution_text: 'Attribution',
      source_sha256: 'a'.repeat(64),
      fields: [],
    });
    expect(result.success).toBe(true);
  });

  it('rejects non-CC license', () => {
    const result = ExternalMetadataSchema.safeParse({
      name: 'Test',
      source_url: 'https://example.com',
      version: '1.0',
      license: 'MIT',
      allow_derivatives: false,
      attribution_text: 'Attribution',
      source_sha256: 'a'.repeat(64),
      fields: [],
    });
    expect(result.success).toBe(false);
  });
});

describe('External template validation', () => {
  const externalIds = existsSync(EXTERNAL_DIR)
    ? readdirSync(EXTERNAL_DIR, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
    : [];

  it.each(externalIds)('validates %s', (id) => {
    const dir = join(EXTERNAL_DIR, id);
    const result = validateExternal(dir, id);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});

describe('External fill end-to-end', () => {
  it('fills yc-safe-valuation-cap with sample values', () => {
    const output = '/tmp/test-ext-valuation-cap.docx';
    const result = execSync(
      `node ${BIN} fill yc-safe-valuation-cap` +
      ` --set company_name="Test Co"` +
      ` --set investor_name="Investor LLC"` +
      ` --set purchase_amount="50,000"` +
      ` --set valuation_cap="5,000,000"` +
      ` --set date_of_safe="January 1, 2026"` +
      ` --set state_of_incorporation="Delaware"` +
      ` --set governing_law_jurisdiction="California"` +
      ` --set company="Test Co"` +
      ` --set name="Alice"` +
      ` --set title="CEO"` +
      ` -o ${output}`,
      { cwd: ROOT, encoding: 'utf-8', timeout: 30_000 }
    );
    expect(result).toContain('Filled');
    expect(result).toContain(output);
    expect(existsSync(output)).toBe(true);
  });

  it('fills yc-safe-pro-rata-side-letter with sample values', () => {
    const output = '/tmp/test-ext-pro-rata.docx';
    const result = execSync(
      `node ${BIN} fill yc-safe-pro-rata-side-letter` +
      ` --set company_name="Test Co"` +
      ` --set investor_name="Investor LLC"` +
      ` --set date_of_safe="January 1, 2026"` +
      ` --set company_name_caps="TEST CO"` +
      ` --set investor_name_caps="INVESTOR LLC"` +
      ` --set name="Alice"` +
      ` --set title="CEO"` +
      ` -o ${output}`,
      { cwd: ROOT, encoding: 'utf-8', timeout: 30_000 }
    );
    expect(result).toContain('Filled');
    expect(existsSync(output)).toBe(true);
  });
});

describe('list includes external templates', () => {
  it('list --json includes yc-safe templates', () => {
    const output = execSync(`node ${BIN} list --json`, {
      cwd: ROOT,
      encoding: 'utf-8',
      timeout: 10_000,
    });
    const parsed = JSON.parse(output);
    const names = parsed.items.map((i: any) => i.name);
    expect(names).toContain('yc-safe-valuation-cap');
    expect(names).toContain('yc-safe-discount');
    expect(names).toContain('yc-safe-mfn');
    expect(names).toContain('yc-safe-pro-rata-side-letter');
  });

  it('external templates have CC-BY-ND-4.0 license', () => {
    const output = execSync(`node ${BIN} list --json`, {
      cwd: ROOT,
      encoding: 'utf-8',
      timeout: 10_000,
    });
    const parsed = JSON.parse(output);
    const ycItems = parsed.items.filter((i: any) => i.name.startsWith('yc-safe-'));
    expect(ycItems.length).toBe(4);
    for (const item of ycItems) {
      expect(item.license).toBe('CC-BY-ND-4.0');
      expect(item.source).toBe('Y Combinator');
    }
  });
});
